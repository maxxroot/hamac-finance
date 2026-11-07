import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

/**
 * Ouvre la base avec le SQLite intégré à Node (aucun module natif à compiler),
 * et branche Drizzle dessus via son pilote « proxy ».
 */
export function openSqlite(path: string) {
  const raw = new DatabaseSync(path);
  raw.exec("PRAGMA journal_mode = WAL;");
  raw.exec("PRAGMA foreign_keys = ON;");
  raw.exec("PRAGMA busy_timeout = 5000;");
  raw.exec("PRAGMA synchronous = NORMAL;");

  const db = drizzle(
    async (sql, params, method) => {
      const stmt = raw.prepare(sql);
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

  return { raw, db };
}

export type Db = ReturnType<typeof openSqlite>["db"];
export type RawDb = DatabaseSync;
