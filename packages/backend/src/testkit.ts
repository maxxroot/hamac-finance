import { PGlite } from "@electric-sql/pglite";
import type { PgProvider, PgSession } from "./db/driver";
import { createBackend, SharedMarket, type Backend, type BackendOptions } from "./index";
import type { Fetcher } from "./market";

/**
 * PostgreSQL en mémoire pour les tests. PGlite n'a qu'une connexion : chaque session y rejoue
 * son rôle et son schéma quand vient son tour, ce qui reproduit des connexions séparées.
 */
export function pgliteProvider(): PgProvider {
  const db = new PGlite();
  let current: { state: string[] } | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async session() {
      const self = { state: [] as string[] };
      const session: PgSession = {
        query<T>(text: string, params: readonly unknown[] = [], arrays = false) {
          const run = queue.then(async () => {
            if (current !== self) {
              await db.exec("RESET ROLE; RESET search_path");
              for (const s of self.state) await db.exec(s);
              current = self;
            }
            if (/^\s*RESET ROLE/i.test(text)) self.state = [];
            else if (/^\s*SET (ROLE|search_path)/i.test(text)) self.state.push(text);
            const res = await db.query<T>(text, [...params], arrays ? { rowMode: "array" } : undefined);
            return res.rows;
          });
          queue = run.catch(() => undefined);
          return run;
        },
        end: async () => undefined,
      };
      return session;
    },
    close: () => db.close(),
  };
}

let shared: PgProvider | null = null;
export const testProvider = () => (shared ??= pgliteProvider());

/** Un backend sur un tenant neuf. */
export async function testBackend(opts: Partial<BackendOptions> = {}): Promise<Backend> {
  const provider = testProvider();
  return createBackend({ provider, tenantId: crypto.randomUUID(), appVersion: "test", backupsDir: null, isAdmin: true, ...opts, market: opts.market ?? (await testMarket(opts.fetcher)) });
}

/** Une base de cours vide. */
export async function testMarket(fetcher?: Fetcher): Promise<SharedMarket> {
  const market = await SharedMarket.open(testProvider(), fetcher);
  await (await testProvider().session()).query("TRUNCATE marche.instruments, marche.quotes, marche.config CASCADE");
  return market;
}
