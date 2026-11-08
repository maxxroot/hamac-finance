import type { RawDb } from "./driver";
import { migrations } from "./migrations.generated";

async function appliedTags(raw: RawDb): Promise<Set<string>> {
  return new Set((await raw.all<{ tag: string }>("SELECT tag FROM _hamac_migrations")).map((r) => r.tag));
}

/** Migrations à appliquer sur un tenant existant ; vide pour un tenant neuf, qui n'a rien à protéger. */
export async function pendingMigrations(raw: RawDb): Promise<string[]> {
  if (!(await raw.get<{ t: string | null }>("SELECT to_regclass('_hamac_migrations')::text AS t"))?.t) return [];
  const applied = await appliedTags(raw);
  return migrations.filter((m) => !applied.has(m.tag)).map((m) => m.tag);
}

/** Applique, dans l'ordre et chacune en transaction, les migrations embarquées manquantes. Renvoie la version du schéma. */
export async function migrate(raw: RawDb): Promise<string> {
  await raw.exec("CREATE TABLE IF NOT EXISTS _hamac_migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = await appliedTags(raw);
  for (const m of migrations) {
    if (applied.has(m.tag)) continue;
    try {
      await raw.transaction(async () => {
        for (const statement of m.sql.split("--> statement-breakpoint")) if (statement.trim()) await raw.exec(statement);
        await raw.run("INSERT INTO _hamac_migrations (tag, applied_at) VALUES (?, ?)", [m.tag, new Date().toISOString()]);
      });
    } catch (err) {
      throw new Error(`Échec de la migration ${m.tag} : ${(err as Error).message}`);
    }
  }
  return migrations.at(-1)?.tag ?? "vide";
}
