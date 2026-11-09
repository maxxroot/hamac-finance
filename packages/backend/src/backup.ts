import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { BackendContext } from "./context";
import { exportDump } from "./dump";

type DumpContext = Pick<BackendContext, "raw" | "schemaVersion" | "appVersion">;

/** Sauvegarde JSON compressée d'un tenant, restaurable dans Paramètres › Application une fois décompressée. */
async function write(ctx: DumpContext, target: string): Promise<void> {
  writeFileSync(target, gzipSync(JSON.stringify(await exportDump(ctx))), { mode: 0o600 });
}

/** Copie conservée avant une migration, qui peut supprimer des données. */
export async function backupBeforeMigration(ctx: DumpContext, dir: string, tag: string): Promise<string | null> {
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `hamac-avant-${tag}.json.gz`);
  if (existsSync(target)) return null;
  await write(ctx, target);
  return target;
}
