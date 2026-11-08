import type { PriceStatus } from "@hamac/api";
import { PRICE_PROVIDER_LABELS, type Asset, type PriceProvider } from "@hamac/core";
import { eq } from "drizzle-orm";
import type { BackendContext } from "../context";
import * as t from "../db/schema";
import { mapAsset, nowIso, PRICE_STATUS_KEY } from "../repo";
import { loadMarketState, MARKET_USAGE_KEY, twelveDataAssets, writeSetting } from "./config";
import { MarketError, type Quote } from "./http";
import { chainFor, fetchFrom } from "./index";
import { refreshIntervalMinutes, TD_DAILY_LIMIT, TwelveDataBudget } from "./twelvedata";

const today = () => new Date().toISOString().slice(0, 10);

/** Accès exclusif à la base (file des appels). Le réseau se fait hors de cette file, pour ne pas bloquer l'interface. */
export type Exclusive = <T>(fn: () => Promise<T>) => Promise<T>;

/** Écart maximal avec le dernier cours connu d'une autre source, au-delà : devise ou cotation différente. */
const MAX_JUMP = 0.25;

interface LastPrice {
  date: string;
  price: number;
  source: string;
}

/** Rejette un cours incohérent avec celui d'une autre source (classique : ligne en dollars). */
export function assertPlausible(asset: Pick<Asset, "kind">, provider: PriceProvider, quotes: readonly Quote[], last: LastPrice | undefined): void {
  const q = quotes.at(-1);
  if (!q || !last || last.source === provider || asset.kind === "crypto") return;
  if (Math.abs(Date.parse(q.date) - Date.parse(last.date)) > 30 * 86_400_000) return;
  if (Math.abs(q.price / last.price - 1) > MAX_JUMP) {
    throw new MarketError(`Cours incohérent (${q.price.toLocaleString("fr-FR")} € contre ${last.price.toLocaleString("fr-FR")} € connu) : devise ou cotation différente ?`);
  }
}

/**
 * Récupère les cours manquants de chaque titre à cours automatique, en suivant sa chaîne de sources.
 * Un cours saisi à la main n'est jamais écrasé par un cours automatique du même jour.
 */
export async function refreshPrices(ctx: BackendContext, exclusive: Exclusive = (fn) => fn()): Promise<PriceStatus> {
  const { assets, market, last } = await exclusive(async () => {
    const assets = (await ctx.db.select().from(t.assets).where(eq(t.assets.archived, false)).all()).map(mapAsset);
    const market = await loadMarketState(ctx);
    const rows = await ctx.raw.all<LastPrice & { assetId: string }>('SELECT asset_id AS "assetId", date, price, source FROM prices p WHERE date = (SELECT MAX(date) FROM prices WHERE asset_id = p.asset_id)');
    return { assets, market, last: new Map(rows.map((r) => [r.assetId, r])) };
  });
  const budget = market.twelveDataKey ? new TwelveDataBudget(market.twelveDataKey, market.usage) : null;
  const env = { twelveDataKey: market.twelveDataKey, budget, web: ctx.mode === "web" };
  const hasKey = !!market.twelveDataKey;
  const errors: PriceStatus["errors"] = [];
  const lines: NonNullable<PriceStatus["assets"]> = [];
  let updated = 0;
  const day = today();
  const upsert = `INSERT INTO prices (asset_id, date, price, source) VALUES (?, ?, ?, ?)
     ON CONFLICT (asset_id, date) DO UPDATE SET price = excluded.price, source = excluded.source WHERE prices.source <> 'manuel'`;
  const lastAuto = "SELECT MAX(date) AS d FROM prices WHERE asset_id = ? AND source <> 'manuel'";

  for (const asset of assets) {
    if (asset.priceSource !== "auto") continue;
    const { chain, reason } = chainFor(asset, market.order, hasKey);
    if (!chain.length) {
      if (asset.kind !== "obligation") lines.push({ assetId: asset.id, name: asset.name, provider: null, lastDate: last.get(asset.id)?.date ?? null, message: reason, tried: [] });
      continue;
    }
    const tried: Array<{ provider: PriceProvider; message: string }> = [];
    let done = false;
    for (const provider of chain) {
      try {
        const known = await exclusive(async () => (await ctx.raw.get<{ d: string | null }>(lastAuto, [asset.id]))?.d ?? null);
        // On re-télécharge les derniers jours connus (cours de clôture qui a pu changer).
        const since = known ? new Date(Date.parse(known) - 86_400_000 * 3).toISOString().slice(0, 10) : null;
        const quotes = await fetchFrom(ctx.fetcher, provider, asset, since, day, env);
        assertPlausible(asset, provider, quotes, last.get(asset.id));
        await exclusive(() =>
          ctx.raw.transaction(async () => {
            for (const q of quotes) await ctx.raw.run(upsert, [asset.id, q.date, q.price, provider]);
          }),
        );
        if (quotes.length) updated++;
        lines.push({ assetId: asset.id, name: asset.name, provider, lastDate: quotes.at(-1)?.date ?? last.get(asset.id)?.date ?? null, message: null, tried });
        done = true;
        break;
      } catch (e) {
        tried.push({ provider, message: (e as Error).message });
      }
    }
    if (!done) {
      const message = tried.map((x) => (tried.length > 1 ? `${PRICE_PROVIDER_LABELS[x.provider]} : ${x.message}` : x.message)).join(" · ");
      errors.push({ assetId: asset.id, name: asset.name, message });
      lines.push({ assetId: asset.id, name: asset.name, provider: null, lastDate: last.get(asset.id)?.date ?? null, message: "Aucune source n'a répondu", tried });
    }
  }

  const n = twelveDataAssets(assets, market);
  const intervalMinutes = refreshIntervalMinutes(n);
  const now = Date.now();
  const status: PriceStatus = {
    at: nowIso(),
    updated,
    errors,
    assets: lines,
    nextAt: new Date(now + intervalMinutes * 60_000).toISOString(),
    twelveData: budget ? { used: budget.usage.used, limit: TD_DAILY_LIMIT, assets: n, intervalMinutes } : null,
  };
  await exclusive(async () => {
    if (budget) await writeSetting(ctx, MARKET_USAGE_KEY, budget.usage);
    await writeSetting(ctx, PRICE_STATUS_KEY, status);
  });
  return status;
}
