import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { BackendContext } from "./context";
import { exportDump } from "./dump";

const KEEP = 30;
type DumpContext = Pick<BackendContext, "raw" | "schemaVersion" | "appVersion">;

/** Sauvegarde JSON compressée d'un tenant, restaurable dans Paramètres › Application une fois décompressée. */
async function write(ctx: DumpContext, target: string): Promise<void> {
  writeFileSync(target, gzipSync(JSON.stringify(await exportDump(ctx))), { mode: 0o600 });
}

/** Copie conservée avant une migration, hors rotation : une migration peut supprimer des données. */
export async function backupBeforeMigration(ctx: DumpContext, dir: string, tag: string): Promise<string | null> {
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `hamac-avant-${tag}.json.gz`);
  if (existsSync(target)) return null;
  await write(ctx, target);
  return target;
}

/** Une sauvegarde par jour, les 30 dernières conservées. Sans effet si celle du jour existe déjà. */
export async function dailyBackup(ctx: DumpContext, dir: string, now = new Date()): Promise<string | null> {
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `hamac-${now.toISOString().slice(0, 10)}.json.gz`);
  if (existsSync(target)) return null;
  await write(ctx, target);
  const files = readdirSync(dir)
    .filter((f) => /^hamac-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f))
    .sort();
  for (const old of files.slice(0, Math.max(0, files.length - KEEP))) rmSync(join(dir, old));
  return target;
}
