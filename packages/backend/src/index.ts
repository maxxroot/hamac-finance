import { procedures, RpcError, type ProcName, type RpcResult } from "@hamac/api";
import { backupBeforeMigration } from "./backup";
import type { BackendContext } from "./context";
import type { PgProvider } from "./db/driver";
import { migrate, pendingMigrations } from "./db/migrate";
import { drizzleFor, enterTenant, rawFor } from "./db/postgres";
import { handlers } from "./handlers";
import { defaultFetcher, type Fetcher } from "./market";
import { refreshPrices } from "./market/refresh";
import type { SharedMarket } from "./market/shared";
import { BASE_REFRESH_MINUTES } from "./market/twelvedata";

export interface BackendOptions {
  provider: PgProvider;
  market: SharedMarket;
  isAdmin: boolean;
  /** UUID du tenant : son schéma et son rôle PostgreSQL. */
  tenantId: string;
  appVersion: string;
  /** Signale la perte de la connexion : l'appelant doit rouvrir ce backend. */
  onLost?: () => void;
  /** Dossier des copies faites avant une migration ; null pour désactiver (tests, base en mémoire). */
  backupsDir: string | null;
  /** Actualise les cours au démarrage, puis à un rythme qui respecte les quotas des sources. */
  autoRefreshPrices?: boolean;
  /** Libellé affiché pour la base : ne jamais exposer le serveur. */
  displayPath?: string;
  /** Client HTTP (injectable pour les tests). */
  fetcher?: Fetcher;
}

export interface Backend {
  /** Point d'entrée unique : valide l'entrée, exécute, valide la sortie. Ne lève jamais. */
  dispatch(name: string, input: unknown): Promise<RpcResult<unknown>>;
  close(): void;
}

export async function createBackend(opts: BackendOptions): Promise<Backend> {
  const session = await opts.provider.session(opts.onLost);
  try {
    await enterTenant(session, opts.tenantId);
    const raw = rawFor(session);
    const base = { raw, appVersion: opts.appVersion };
    // Avant toute migration : si la copie échoue, on s'arrête plutôt que de modifier les données sans filet.
    const pending = opts.backupsDir ? await pendingMigrations(raw) : [];
    if (opts.backupsDir && pending.length) {
      try {
        await backupBeforeMigration({ ...base, schemaVersion: "avant-migration" }, opts.backupsDir, pending[0]!);
      } catch (err) {
        throw new Error(`Sauvegarde impossible avant la mise à jour de la base : ${(err as Error).message}`);
      }
    }
    const schemaVersion = await migrate(raw);
    const ctx: BackendContext = {
      ...base,
      db: drizzleFor(session),
      schemaVersion,
      backupsDir: opts.backupsDir,
      fetcher: opts.fetcher ?? defaultFetcher,
      market: opts.market,
      isAdmin: opts.isAdmin,
      displayPath: opts.displayPath ?? "Base PostgreSQL de l'instance",
    };
    return startBackend(ctx, { autoRefreshPrices: opts.autoRefreshPrices });
  } catch (err) {
    await session.end().catch(() => undefined);
    throw err;
  }
}

/** Assemble un backend sur une base déjà ouverte et migrée, quel que soit son moteur. */
export function startBackend(ctx: BackendContext, opts: { autoRefreshPrices?: boolean }): Backend {
  // Les appels sont traités un par un sur la connexion du tenant,
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
      if (priceTimer) clearTimeout(priceTimer);
      void ctx.raw.close().catch((err) => console.error("[hamac] fermeture de la base :", err));
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
export type { PgProvider, PgSession } from "./db/driver";
export { postgresProvider, rawFor, waitForDatabase } from "./db/postgres";
export { SharedMarket } from "./market/shared";
export { seedDemo } from "./demo";
