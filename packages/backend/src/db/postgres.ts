import { drizzle } from "drizzle-orm/pg-proxy";
import pg from "pg";
import type { PgProvider, PgSession, RawDb, SqlValue } from "./driver";
import * as schema from "./schema";

/** Les entiers 64 bits (centimes, COUNT) arrivent en nombres, pas en chaînes. */
const types = {
  getTypeParser: ((oid: number, format?: "text" | "binary") => (oid === 20 ? (v: string) => Number(v) : pg.types.getTypeParser(oid, format as "text"))) as typeof pg.types.getTypeParser,
};

export function postgresProvider(connectionString: string): PgProvider {
  return {
    async session(onLost) {
      const client = new pg.Client({ connectionString, types });
      client.on("error", () => onLost?.());
      client.on("end", () => onLost?.());
      await client.connect();
      // Une connexion n'exécute qu'une requête à la fois : les appels simultanés attendent leur tour.
      let last: Promise<unknown> = Promise.resolve();
      return {
        query<T>(text: string, params: readonly unknown[] = [], arrays = false) {
          const run = last.then(() => client.query({ text, values: [...params], ...(arrays ? { rowMode: "array" as const } : {}) })).then((res) => res.rows as T[]);
          last = run.catch(() => undefined);
          return run;
        },
        end: () => client.end(),
      };
    },
    close: async () => undefined,
  };
}

/** Attend que PostgreSQL accepte les connexions (démarrage simultané avec le serveur). */
export async function waitForDatabase(provider: PgProvider, tries = 30, delayMs = 1000): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      const session = await provider.session();
      await session.end();
      return;
    } catch (err) {
      if (i >= tries) throw new Error(`PostgreSQL injoignable : ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/** Remplace les « ? » hors chaînes et identifiants par les paramètres numérotés de PostgreSQL. */
export function positional(query: string): string {
  let out = "";
  let n = 0;
  let quote: string | null = null;
  for (const ch of query) {
    if (quote) {
      if (ch === quote) quote = null;
      out += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
    } else out += ch === "?" ? `$${++n}` : ch;
  }
  return out;
}

export function rawFor(session: PgSession): RawDb {
  const all = <T>(query: string, params: readonly SqlValue[] = []) => session.query<T>(positional(query), params);
  return {
    all,
    get: async <T>(query: string, params?: readonly SqlValue[]) => (await all<T>(query, params))[0],
    run: async (query, params) => void (await all(query, params)),
    exec: async (query) => void (await session.query(query)),
    async transaction(fn) {
      await session.query("BEGIN");
      try {
        const out = await fn();
        await session.query("COMMIT");
        return out;
      } catch (e) {
        await session.query("ROLLBACK");
        throw e;
      }
    },
    columns: async (table) =>
      (await session.query<{ name: string; type: string }>("SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1", [table])),
    version: async () => (await session.query<{ v: string }>("SHOW server_version")).map((r) => Object.values(r)[0] as string)[0] ?? "?",
    close: () => session.end(),
  };
}

export function drizzleFor(session: PgSession) {
  return drizzle(async (sql, params, method) => ({ rows: await session.query<never>(sql, params, method === "all") }), { schema });
}

export type Db = ReturnType<typeof drizzleFor>;

/** Noms PostgreSQL d'un tenant. L'identifiant est un UUID : rien d'autre n'entre dans un nom SQL. */
export function tenantNames(tenantId: string): { schema: string; role: string } {
  const hex = tenantId.replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error("Identifiant de tenant invalide.");
  return { schema: `t_${hex}`, role: `hamac_t_${hex}` };
}

/**
 * Crée au besoin le tenant, puis place la connexion dans son rôle et son schéma.
 * Chaque tenant a son rôle sans droit de connexion, seul propriétaire de son schéma : même une
 * erreur applicative ne peut pas lire les données d'un autre tenant ni les comptes de l'instance.
 */
export async function enterTenant(session: PgSession, tenantId: string): Promise<void> {
  const { schema: name, role } = tenantNames(tenantId);
  await session.query("RESET ROLE");
  if (!(await session.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role])).length) await session.query(`CREATE ROLE "${role}" NOLOGIN`);
  await session.query(`GRANT "${role}" TO CURRENT_USER`);
  await session.query(`CREATE SCHEMA IF NOT EXISTS "${name}" AUTHORIZATION "${role}"`);
  await session.query(`SET ROLE "${role}"`);
  await session.query(`SET search_path TO "${name}"`);
}
