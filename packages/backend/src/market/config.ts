import { PRICE_PROVIDERS, type PriceProvider } from "@hamac/core";
import { one } from "../db/driver";
import { eq } from "drizzle-orm";
import type { BackendContext } from "../context";
import * as t from "../db/schema";
import { nowIso } from "../db/units";
import { chainFor, DEFAULT_PROVIDER_ORDER, type MarketAsset, type ProviderSetting } from "./index";
import type { TwelveDataUsage } from "./sources/twelvedata";

/** Ancien emplacement de la clé d'API dans les données d'un tenant : jamais restauré ni exporté. */
export const MARKET_SECRETS_KEY = "market.secrets";

export async function readSetting<T>(ctx: BackendContext, key: string): Promise<T | null> {
  const row = await ctx.db.select().from(t.settings).where(eq(t.settings.key, key)).limit(1).then(one);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function writeSetting(ctx: BackendContext, key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  const updatedAt = nowIso();
  await ctx.db.insert(t.settings).values({ key, value: json, updatedAt }).onConflictDoUpdate({ target: t.settings.key, set: { value: json, updatedAt } });
}

/** Ordre enregistré, complété des fournisseurs ajoutés depuis ; « url » reste propre à chaque titre. */
export function normalizeOrder(stored: readonly ProviderSetting[] | null | undefined): ProviderSetting[] {
  const valid = (stored ?? []).filter((o) => o.id !== "url" && PRICE_PROVIDERS.includes(o.id));
  const seen = new Set<PriceProvider>();
  const out = valid.filter((o) => !seen.has(o.id) && seen.add(o.id));
  for (const id of DEFAULT_PROVIDER_ORDER) if (!seen.has(id)) out.push({ id, enabled: true });
  return out;
}

export interface MarketState {
  order: ProviderSetting[];
  twelveDataKey: string | null;
  usage: TwelveDataUsage | null;
}

/** Nombre de titres pouvant solliciter Twelve Data à chaque actualisation (pire cas : toutes les sources avant lui échouent). */
export function twelveDataAssets(assets: readonly MarketAsset[], state: Pick<MarketState, "order" | "twelveDataKey">): number {
  if (!state.twelveDataKey) return 0;
  return assets.filter((a) => chainFor(a, state.order, true).chain.includes("twelvedata")).length;
}
