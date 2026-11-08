import { DatabaseSync, type StatementSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { RawDb, SqlValue } from "./driver";
import * as schema from "./schema";

/**
 * Ouvre la base avec le SQLite intégré à Node (aucun module natif à compiler),
 * et branche Drizzle dessus via son pilote « proxy ».
 */
export function openSqlite(path: string) {
  const file = new DatabaseSync(path);
  file.exec("PRAGMA journal_mode = WAL;");
  file.exec("PRAGMA foreign_keys = ON;");
  file.exec("PRAGMA busy_timeout = 5000;");
  file.exec("PRAGMA synchronous = NORMAL;");

  const db = drizzle(
    async (sql, params, method) => {
      const stmt = file.prepare(sql);
      // Lignes en tableaux : requis par Drizzle (évite les collisions de noms dans les jointures).
      stmt.setReturnArrays(true);
      const args = params as Array<null | number | bigint | string | Uint8Array>;
      if (method === "run") {
        stmt.run(...args);
        return { rows: [] };
      }
      if (method === "get") {
        // Aucune ligne → rows undefined, pour que Drizzle renvoie undefined (et non un objet vide).
        const row = stmt.get(...args) as unknown as unknown[] | undefined;
        return { rows: row } as { rows: unknown[] };
      }
      return { rows: stmt.all(...args) as unknown as unknown[][] };
    },
    { schema },
  );

  return { file, raw: sqliteRaw(file), db };
}

export type Db = ReturnType<typeof openSqlite>["db"];

function sqliteRaw(file: DatabaseSync): RawDb {
  const statements = new Map<string, StatementSync>();
  const prepare = (query: string) => {
    let stmt = statements.get(query);
    if (!stmt) statements.set(query, (stmt = file.prepare(query)));
    return stmt;
  };
  const atomically = async <T>(fn: () => Promise<T>): Promise<T> => {
    file.exec("BEGIN IMMEDIATE");
    try {
      const out = await fn();
      file.exec("COMMIT");
      return out;
    } catch (e) {
      file.exec("ROLLBACK");
      throw e;
    }
  };
  return {
    dialect: "sqlite",
    all: async <T>(query: string, params: readonly SqlValue[] = []) => prepare(query).all(...params) as T[],
    get: async <T>(query: string, params: readonly SqlValue[] = []) => prepare(query).get(...params) as T | undefined,
    run: async (query, params = []) => void prepare(query).run(...params),
    exec: async (query) => file.exec(query),
    transaction: atomically,
    async replaceAll(fn) {
      file.exec("PRAGMA foreign_keys = OFF");
      try {
        return await atomically(fn);
      } finally {
        file.exec("PRAGMA foreign_keys = ON");
      }
    },
    brokenReferences: async () => file.prepare("PRAGMA foreign_key_check").all().length,
    columns: async (table) => (file.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name),
    version: async () => (file.prepare("SELECT sqlite_version() AS v").get() as { v: string }).v,
    close: async () => {
      statements.clear();
      file.close();
    },
  };
}
