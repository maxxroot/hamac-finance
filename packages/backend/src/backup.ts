import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { MARKET_SECRETS_KEY } from "./market/config";

const KEEP = 30;

/**
 * Sauvegarde quotidienne : une copie cohérente de la base par jour (VACUUM INTO),
 * en gardant les 30 dernières. Sans effet si la copie du jour existe déjà.
 */
/** Copie cohérente de la base, sans les clés d'API personnelles (effacées pour de bon par le second VACUUM). */
function copyWithoutSecrets(raw: DatabaseSync, target: string): void {
  raw.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  const copy = new DatabaseSync(target);
  try {
    if (copy.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get()) {
      const { changes } = copy.prepare("DELETE FROM settings WHERE key = ?").run(MARKET_SECRETS_KEY);
      if (Number(changes) > 0) copy.exec("VACUUM");
    }
  } finally {
    copy.close();
  }
}

/** Copie conservée avant une migration, hors rotation : une migration peut supprimer des données. */
export function backupBeforeMigration(raw: DatabaseSync, dir: string, tag: string): string | null {
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `hamac-avant-${tag}.sqlite`);
  if (existsSync(target)) return null;
  copyWithoutSecrets(raw, target);
  return target;
}

export function dailyBackup(raw: DatabaseSync, dir: string, now = new Date()): string | null {
  mkdirSync(dir, { recursive: true });
  const day = now.toISOString().slice(0, 10);
  const target = join(dir, `hamac-${day}.sqlite`);
  if (existsSync(target)) return null;
  copyWithoutSecrets(raw, target);
  const files = readdirSync(dir)
    .filter((f) => /^hamac-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f))
    .sort();
  for (const old of files.slice(0, Math.max(0, files.length - KEEP))) rmSync(join(dir, old));
  return target;
}
