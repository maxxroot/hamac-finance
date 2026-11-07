import { procedures, RpcError, type ProcName, type RpcResult } from "@hamac/api";
import { dailyBackup } from "./backup";
import type { BackendContext } from "./context";
import { migrate } from "./db/migrate";
import { openSqlite } from "./db/sqlite";
import { handlers } from "./handlers";

export interface BackendOptions {
  databasePath: string;
  mode: "desktop" | "web";
  appVersion: string;
  /** Dossier des sauvegardes quotidiennes ; null pour désactiver (tests, base en mémoire). */
  backupsDir: string | null;
}

export interface Backend {
  /** Point d'entrée unique : valide l'entrée, exécute, valide la sortie. Ne lève jamais. */
  dispatch(name: string, input: unknown): Promise<RpcResult<unknown>>;
  close(): void;
}

export function createBackend(opts: BackendOptions): Backend {
  const { raw, db } = openSqlite(opts.databasePath);
  const schemaVersion = migrate(raw);
  const ctx: BackendContext = { db, raw, schemaVersion, ...opts };

  const backup = () => {
    if (!opts.backupsDir) return;
    try {
      dailyBackup(raw, opts.backupsDir);
    } catch (err) {
      console.error("[hamac] sauvegarde impossible :", err);
    }
  };
  backup();
  const backupTimer = opts.backupsDir ? setInterval(backup, 6 * 3600_000) : null;
  backupTimer?.unref?.();

  // Les appels sont traités un par un : la base est mono-utilisateur par fichier,
  // et cela garantit qu'une écriture n'est jamais entrelacée avec une autre.
  let queue: Promise<unknown> = Promise.resolve();

  async function run(name: string, input: unknown): Promise<RpcResult<unknown>> {
    if (!(name in procedures)) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Procédure inconnue : ${name}` } };
    }
    const proc = procedures[name as ProcName];
    const parsed = proc.input.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: { code: "VALIDATION", message: "Entrée invalide", details: parsed.error.issues } };
    }
    try {
      const handler = handlers[name as ProcName] as (i: unknown, c: BackendContext) => Promise<unknown>;
      const out = proc.output.parse(await handler(parsed.data, ctx));
      return { ok: true, data: out };
    } catch (err) {
      if (err instanceof RpcError) {
        return { ok: false, error: { code: err.code, message: err.message, details: err.details } };
      }
      console.error(`[hamac] ${name} :`, err);
      return { ok: false, error: { code: "INTERNAL", message: (err as Error).message ?? "Erreur interne" } };
    }
  }

  return {
    dispatch(name, input) {
      const result = queue.then(() => run(name, input));
      queue = result.catch(() => undefined);
      return result;
    },
    close() {
      if (backupTimer) clearInterval(backupTimer);
      raw.close();
    },
  };
}
