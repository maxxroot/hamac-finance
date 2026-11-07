import type { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const KEEP = 30;

/**
 * Sauvegarde quotidienne : une copie cohérente de la base par jour (VACUUM INTO),
 * en gardant les 30 dernières. Sans effet si la copie du jour existe déjà.
 */
export function dailyBackup(raw: DatabaseSync, dir: string, now = new Date()): string | null {
  mkdirSync(dir, { recursive: true });
  const day = now.toISOString().slice(0, 10);
  const target = join(dir, `hamac-${day}.sqlite`);
  if (existsSync(target)) return null;
  raw.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  const files = readdirSync(dir)
    .filter((f) => /^hamac-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f))
    .sort();
  for (const old of files.slice(0, Math.max(0, files.length - KEEP))) rmSync(join(dir, old));
  return target;
}
