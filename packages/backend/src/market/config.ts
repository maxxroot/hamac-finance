import { PRICE_PROVIDERS, type Asset, type PriceProvider } from "@hamac/core";
import { eq } from "drizzle-orm";
import type { BackendContext } from "../context";
import * as t from "../db/schema";
import { nowIso } from "../repo";
import { chainFor, DEFAULT_PROVIDER_ORDER, type ProviderSetting } from "./index";
import type { TwelveDataUsage } from "./twelvedata";

/** Réglages des sources de cours. Les clés sont à part : jamais envoyées à l'interface ni exportées. */
export const MARKET_CONFIG_KEY = "market.config";
export const MARKET_SECRETS_KEY = "market.secrets";
export const MARKET_USAGE_KEY = "market.usage";

export async function readSetting<T>(ctx: BackendContext, key: string): Promise<T | null> {
  const row = await ctx.db.select().from(t.settings).where(eq(t.settings.key, key)).get();
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

export async function loadMarketState(ctx: BackendContext): Promise<MarketState> {
  const [config, secrets, usage] = await Promise.all([
    readSetting<{ order?: ProviderSetting[] }>(ctx, MARKET_CONFIG_KEY),
    readSetting<{ twelveDataKey?: string | null }>(ctx, MARKET_SECRETS_KEY),
    readSetting<TwelveDataUsage>(ctx, MARKET_USAGE_KEY),
  ]);
  return { order: normalizeOrder(config?.order), twelveDataKey: secrets?.twelveDataKey ?? null, usage };
}

/** Nombre de titres pouvant solliciter Twelve Data à chaque actualisation (pire cas : toutes les sources avant lui échouent). */
export function twelveDataAssets(assets: readonly Asset[], state: Pick<MarketState, "order" | "twelveDataKey">): number {
  if (!state.twelveDataKey) return 0;
  return assets.filter((a) => !a.archived && chainFor(a, state.order, true).chain.includes("twelvedata")).length;
}
