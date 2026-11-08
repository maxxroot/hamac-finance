import { procedures, RpcError, type ProcName, type RpcResult } from "@hamac/api";
import { backupBeforeMigration, dailyBackup } from "./backup";
import type { BackendContext } from "./context";
import { migrate, pendingMigrations } from "./db/migrate";
import { openSqlite } from "./db/sqlite";
import { handlers } from "./handlers";
import { defaultFetcher, type Fetcher } from "./market";
import { refreshPrices } from "./market/refresh";
import { BASE_REFRESH_MINUTES } from "./market/twelvedata";

export interface BackendOptions {
  databasePath: string;
  mode: "desktop" | "web";
  appVersion: string;
  /** Dossier des sauvegardes quotidiennes ; null pour désactiver (tests, base en mémoire). */
  backupsDir: string | null;
  /** Actualise les cours au démarrage, puis à un rythme qui respecte les quotas des sources. */
  autoRefreshPrices?: boolean;
  /** Libellé affiché à la place du chemin de la base (mode web : ne pas exposer le serveur). */
  displayPath?: string;
  /** Client HTTP (injectable pour les tests). */
  fetcher?: Fetcher;
}

export interface Backend {
  /** Point d'entrée unique : valide l'entrée, exécute, valide la sortie. Ne lève jamais. */
  dispatch(name: string, input: unknown): Promise<RpcResult<unknown>>;
  close(): void;
}

export function createBackend(opts: BackendOptions): Backend {
  const { raw, db } = openSqlite(opts.databasePath);
  // Avant toute migration : si la copie échoue, on s'arrête plutôt que de modifier la base sans filet.
  const pending = opts.backupsDir ? pendingMigrations(raw) : [];
  if (opts.backupsDir && pending.length) {
    try {
      backupBeforeMigration(raw, opts.backupsDir, pending[0]!);
    } catch (err) {
      raw.close();
      throw new Error(`Sauvegarde impossible avant la mise à jour de la base : ${(err as Error).message}`);
    }
  }
  const schemaVersion = migrate(raw);
  const ctx: BackendContext = { db, raw, schemaVersion, ...opts, fetcher: opts.fetcher ?? defaultFetcher };

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

  let priceTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  /** Passe dans la file des appels : les écritures restent une par une pendant que le réseau travaille à côté. */
  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = queue.then(() => {
      if (closed) throw new Error("Base fermée");
      return fn();
    });
    queue = result.catch(() => undefined);
    return result;
  };

  // Une seule actualisation à la fois ; elle ne bloque pas les autres appels (limites par minute des sources).
  let refreshing: Promise<RpcResult<unknown>> | null = null;
  const refresh = (): Promise<RpcResult<unknown>> => {
    refreshing ??= refreshPrices(ctx, exclusive)
      .then((data): RpcResult<unknown> => ({ ok: true, data: procedures["prices.refresh"].output.parse(data) }))
      .catch((err: Error): RpcResult<unknown> => ({ ok: false, error: { code: "INTERNAL", message: err.message ?? "Erreur interne" } }))
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  };

  const backend: Backend = {
    dispatch(name, input) {
      if (name === "prices.refresh") return refresh();
      const result = queue.then(() => run(name, input));
      queue = result.catch(() => undefined);
      return result;
    },
    close() {
      closed = true;
      if (backupTimer) clearInterval(backupTimer);
      if (priceTimer) clearTimeout(priceTimer);
      raw.close();
    },
  };

  if (opts.autoRefreshPrices) {
    // Chaque passage fixe la date du suivant, calculée d'après le quota des sources.
    const tick = async () => {
      const res = await refresh();
      if (closed) return;
      const next = res.ok ? Date.parse((res.data as { nextAt?: string }).nextAt ?? "") : NaN;
      priceTimer = setTimeout(() => void tick(), Number.isFinite(next) ? Math.max(60_000, next - Date.now()) : BASE_REFRESH_MINUTES * 60_000);
      priceTimer.unref?.();
    };
    priceTimer = setTimeout(() => void tick(), 3_000);
    priceTimer.unref?.();
  }
  return backend;
}
export { seedDemo } from "./demo";
