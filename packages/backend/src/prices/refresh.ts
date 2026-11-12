import type { PriceStatus } from "@hamac/api";
import { PRICE_PROVIDER_LABELS, type PriceProvider } from "@hamac/core";
import { eq } from "drizzle-orm";
import type { BackendContext } from "../context";
import * as t from "../db/schema";
import { mapAsset, PRICE_STATUS_KEY } from "../repo";
import { nowIso } from "../db/units";
import { writeSetting } from "../market/config";
import { chainFor, fetchFrom, instrumentKey, isPersonal } from "../market/index";
import { assertPlausible, type LastPrice } from "../market/plausible";
import { TwelveDataBudget } from "../market/sources/twelvedata";

const today = () => new Date().toISOString().slice(0, 10);

/** Accès exclusif à la connexion du tenant. Le réseau se fait hors de cette file, pour ne pas bloquer l'interface. */
export type Exclusive = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Actualise les cours d'un tenant : ses titres cotés via la base commune, ses adresses personnalisées
 * dans ses propres données. Un cours saisi à la main n'est jamais écrasé par un cours automatique du même jour.
 */
export async function refreshPrices(ctx: BackendContext, exclusive: Exclusive = (fn) => fn()): Promise<PriceStatus> {
  const { assets, last } = await exclusive(async () => {
    const assets = (await ctx.db.select().from(t.assets).where(eq(t.assets.archived, false))).map(mapAsset);
    const rows = await ctx.raw.all<LastPrice & { assetId: string }>('SELECT asset_id AS "assetId", date, price, source FROM prices p WHERE date = (SELECT MAX(date) FROM prices WHERE asset_id = p.asset_id)');
    return { assets, last: new Map(rows.map((r) => [r.assetId, r])) };
  });
  const updatedKeys = await ctx.market.refresh(assets);
  const market = await ctx.market.state();
  const known = await ctx.market.instruments(assets.flatMap((a) => instrumentKey(a) ?? []));
  const hasKey = !!market.twelveDataKey;
  const errors: PriceStatus["errors"] = [];
  const lines: NonNullable<PriceStatus["assets"]> = [];
  let updated = 0;
  const day = today();
  const upsert = `INSERT INTO prices (asset_id, date, price, source) VALUES (?, ?, ?, ?)
     ON CONFLICT (asset_id, date) DO UPDATE SET price = excluded.price, source = excluded.source WHERE prices.source <> 'manuel'`;
  const lastAuto = "SELECT MAX(date) AS d FROM prices WHERE asset_id = ? AND source <> 'manuel'";

  for (const asset of assets) {
    const key = instrumentKey(asset);
    if (key) {
      const inst = known.get(key);
      if (updatedKeys.has(key)) updated++;
      const lastDate = inst?.lastDate ?? last.get(asset.id)?.date ?? null;
      if (inst?.failed) errors.push({ assetId: asset.id, name: asset.name, message: inst.tried.map((x) => (inst.tried.length > 1 ? `${PRICE_PROVIDER_LABELS[x.provider]} : ${x.message}` : x.message)).join(" · ") });
      lines.push({ assetId: asset.id, name: asset.name, provider: inst?.provider ?? null, lastDate, message: inst?.message ?? null, tried: inst?.tried ?? [] });
      continue;
    }
    // Sans clé ici : une adresse personnalisée ne consomme pas le quota commun.
    const { chain, reason } = isPersonal(asset) ? chainFor(asset, market.order, false) : chainFor(asset, market.order, hasKey);
    if (!isPersonal(asset) || !chain.length) {
      if (asset.kind !== "obligation") lines.push({ assetId: asset.id, name: asset.name, provider: null, lastDate: last.get(asset.id)?.date ?? null, message: reason ?? "Cours manuel ou calculé", tried: [] });
      continue;
    }
    const tried: Array<{ provider: PriceProvider; message: string }> = [];
    let done = false;
    for (const provider of chain) {
      try {
        const lastKnown = await exclusive(async () => (await ctx.raw.get<{ d: string | null }>(lastAuto, [asset.id]))?.d ?? null);
        // On re-télécharge les derniers jours connus (cours de clôture qui a pu changer).
        const since = lastKnown ? new Date(Date.parse(lastKnown) - 86_400_000 * 3).toISOString().slice(0, 10) : null;
        const quotes = await fetchFrom(ctx.fetcher, provider, asset, since, day, { twelveDataKey: null, budget: null, web: true });
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

  const n = await ctx.market.twelveDataCount(market);
  const intervalMinutes = ctx.market.intervalMinutes(n);
  const status: PriceStatus = {
    at: nowIso(),
    updated,
    errors,
    assets: lines,
    nextAt: new Date(Date.now() + intervalMinutes * 60_000).toISOString(),
    twelveData: market.twelveDataKey ? { used: new TwelveDataBudget(market.twelveDataKey, market.usage, ctx.market.dailyLimit).usage.used, limit: ctx.market.dailyLimit, assets: n, intervalMinutes } : null,
  };
  await exclusive(() => writeSetting(ctx, PRICE_STATUS_KEY, status));
  return status;
}
