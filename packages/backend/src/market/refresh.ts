import type { PriceStatus } from "@hamac/api";
import { eq, sql } from "drizzle-orm";
import type { BackendContext } from "../context";
import * as t from "../db/schema";
import { mapAsset, nowIso, PRICE_STATUS_KEY } from "../repo";
import { fetchQuotes, providerFor } from "./index";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Récupère les cours manquants de chaque titre à cours automatique.
 * Un cours saisi à la main n'est jamais écrasé par un cours automatique du même jour.
 */
export async function refreshPrices(ctx: BackendContext): Promise<PriceStatus> {
  const assets = (await ctx.db.select().from(t.assets).where(eq(t.assets.archived, false)).all()).map(mapAsset);
  const errors: PriceStatus["errors"] = [];
  let updated = 0;
  const day = today();
  const upsert = ctx.raw.prepare(
    `INSERT INTO prices (asset_id, date, price, source) VALUES (?, ?, ?, ?)
     ON CONFLICT (asset_id, date) DO UPDATE SET price = excluded.price, source = excluded.source WHERE prices.source <> 'manuel'`,
  );
  for (const asset of assets) {
    const p = providerFor(asset);
    if (!p.provider) continue;
    try {
      const last = await ctx.db.select({ d: sql<string | null>`MAX(${t.prices.date})` }).from(t.prices).where(sql`${t.prices.assetId} = ${asset.id} AND ${t.prices.source} <> 'manuel'`).get();
      // On re-télécharge le dernier jour connu (cours de clôture qui a pu changer).
      const since = last?.d ? new Date(Date.parse(last.d) - 86_400_000 * 3).toISOString().slice(0, 10) : null;
      const quotes = await fetchQuotes(ctx.fetcher, asset, since, day);
      ctx.raw.exec("BEGIN");
      try {
        for (const q of quotes) upsert.run(asset.id, q.date, q.price, p.provider);
        ctx.raw.exec("COMMIT");
      } catch (e) {
        ctx.raw.exec("ROLLBACK");
        throw e;
      }
      if (quotes.length) updated++;
    } catch (e) {
      errors.push({ assetId: asset.id, name: asset.name, message: (e as Error).message });
    }
  }
  const status: PriceStatus = { at: nowIso(), updated, errors };
  const value = JSON.stringify(status);
  await ctx.db.insert(t.settings).values({ key: PRICE_STATUS_KEY, value, updatedAt: status.at }).onConflictDoUpdate({ target: t.settings.key, set: { value, updatedAt: status.at } });
  return status;
}
