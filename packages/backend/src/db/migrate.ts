import type { DatabaseSync } from "node:sqlite";
import { migrations } from "./migrations.generated";

/** Migrations à appliquer sur une base existante ; vide pour une base neuve, qui n'a rien à protéger. */
export function pendingMigrations(raw: DatabaseSync): string[] {
  if (!raw.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_hamac_migrations'").get()) return [];
  const applied = new Set((raw.prepare("SELECT tag FROM _hamac_migrations").all() as Array<{ tag: string }>).map((r) => r.tag));
  return migrations.filter((m) => !applied.has(m.tag)).map((m) => m.tag);
}

/**
 * Applique, dans l'ordre et en transaction, les migrations embarquées non encore appliquées.
 * Renvoie l'étiquette de la dernière migration (= version du schéma).
 */
export function migrate(raw: DatabaseSync): string {
  raw.exec(`CREATE TABLE IF NOT EXISTS _hamac_migrations (
    tag TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(
    (raw.prepare("SELECT tag FROM _hamac_migrations").all() as Array<{ tag: string }>).map((r) => r.tag),
  );
  for (const m of migrations) {
    if (applied.has(m.tag)) continue;
    raw.exec("BEGIN IMMEDIATE");
    try {
      for (const statement of m.sql.split("--> statement-breakpoint")) {
        if (statement.trim()) raw.exec(statement);
      }
      raw.prepare("INSERT INTO _hamac_migrations (tag, applied_at) VALUES (?, ?)").run(m.tag, new Date().toISOString());
      raw.exec("COMMIT");
    } catch (err) {
      raw.exec("ROLLBACK");
      throw new Error(`Échec de la migration ${m.tag} : ${(err as Error).message}`);
    }
  }
  return migrations.at(-1)?.tag ?? "vide";
}
