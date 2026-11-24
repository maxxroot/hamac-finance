import { PGlite } from "@electric-sql/pglite";
import type { PgProvider, PgSession } from "./db/driver";
import { createBackend, SharedMarket, type Backend, type BackendOptions, type MarketConfig } from "./index";
import type { Fetcher } from "./market";

/**
 * PostgreSQL en mémoire pour les tests. PGlite n'a qu'une connexion : chaque session y rejoue
 * son rôle et son schéma quand vient son tour, ce qui reproduit des connexions séparées.
 */
export function pgliteProvider(): PgProvider {
  const db = new PGlite();
  let current: { state: string[] } | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async session() {
      const self = { state: [] as string[] };
      const session: PgSession = {
        query<T>(text: string, params: readonly unknown[] = [], arrays = false) {
          const run = queue.then(async () => {
            if (current !== self) {
              await db.exec("RESET ROLE; RESET search_path");
              for (const s of self.state) await db.exec(s);
              current = self;
            }
            if (/^\s*RESET ROLE/i.test(text)) self.state = [];
            else if (/^\s*SET (ROLE|search_path)/i.test(text)) self.state.push(text);
            const res = await db.query<T>(text, [...params], arrays ? { rowMode: "array" } : undefined);
            return res.rows;
          });
          queue = run.catch(() => undefined);
          return run;
        },
        end: async () => undefined,
      };
      return session;
    },
    close: () => db.close(),
  };
}

let shared: PgProvider | null = null;
export const testProvider = () => (shared ??= pgliteProvider());

/** Un backend sur un tenant neuf. */
export async function testBackend(opts: Partial<BackendOptions> = {}): Promise<Backend> {
  const provider = testProvider();
  return createBackend({ provider, tenantId: crypto.randomUUID(), appVersion: "test", backupsDir: null, isAdmin: true, ...opts, market: opts.market ?? (await testMarket(opts.fetcher)) });
}

/** Sans client réseau fourni, les tests ne sortent jamais : toute requête échoue comme une panne. */
export const offlineFetcher: Fetcher = async () => {
  throw new Error("Réseau coupé pendant les tests.");
};

/** Une base de cours vide. */
export async function testMarket(fetcher?: Fetcher, config?: Partial<MarketConfig>): Promise<SharedMarket> {
  const market = await SharedMarket.open(testProvider(), fetcher ?? offlineFetcher, undefined, { compositionSpacingMs: 0, ...config });
  await (await testProvider().session()).query("TRUNCATE marche.instruments, marche.quotes, marche.config, marche.series, marche.compositions, marche.composition_links, marche.fx_rates, marche.fx_status CASCADE");
  return market;
}

/**
 * Faux site Amundi au format réel (montants fictifs). `known` : ISIN connus d'Amundi, avec leur réplication
 * (« Direct(Physical) », « Indirect(Swap Based) ») et, au besoin, leur nom. iShares ne connaît rien.
 */
export function amundiFake(known: Record<string, string | { replication: string; name: string }>, opts: { down?: () => boolean } = {}): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (opts.down?.()) return new Response("panne", { status: 500 });
    if (url.includes("amundietf")) {
      const isin = (JSON.parse(String(init?.body)) as { productIds: string[] }).productIds[0]!;
      const fund = known[isin];
      if (!fund) return Response.json({ products: [] });
      const { replication, name } = typeof fund === "string" ? { replication: fund, name: `Amundi ${isin}` } : fund;
      return Response.json({
        products: [
          {
            productId: isin,
            characteristics: { FUND_REPLICATION_METHODOLOGY: replication, SHARE_MARKETING_NAME: name },
            composition: {
              compositionData: [
                { compositionCharacteristics: { date: "2026-11-09", type: "EQUITY_ORDINARY", isin: "US0378331005", name: "APPLE INC", weight: 0.6, currency: "USD", sector: "Information Technology", countryOfRisk: "United States" } },
                { compositionCharacteristics: { date: "2026-11-09", type: "EQUITY_ORDINARY", isin: "FR0000120271", name: "TOTALENERGIES SE", weight: 0.4, currency: "EUR", sector: "Energy", countryOfRisk: "France" } },
              ],
            },
          },
        ],
      });
    }
    if (url.includes("core-search")) return Response.json({ results: [] });
    return new Response("introuvable", { status: 404 });
  }) as Fetcher & { calls: string[] };
  f.calls = calls;
  return f;
}

/**
 * Fausse API de la BCE au format réel (CSV, colonnes de `detail=dataonly`) : `rates` donne, par devise, les taux
 * (unités pour 1 €) de chaque jour publié ; seuls ceux depuis `startPeriod` sont renvoyés.
 */
export function ecbFake(rates: Record<string, Record<string, number>>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const m = /EXR\/D\.([A-Z]{3})\.EUR\.SP00\.A\?startPeriod=(\d{4}-\d{2}-\d{2})/.exec(url);
    if (!m) return new Response("inconnu", { status: 400 });
    const [, currency, since] = m as unknown as [string, string, string];
    const rows = Object.entries(rates[currency] ?? {}).filter(([d]) => d >= since).sort();
    if (!rows.length) return new Response("No results found.", { status: 404 });
    const csv = ["KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE", ...rows.map(([d, r]) => `EXR.D.${currency}.EUR.SP00.A,D,${currency},EUR,SP00,A,${d},${r}`)].join("\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv" } });
  }) as Fetcher & { calls: string[] };
  f.calls = calls;
  return f;
}
