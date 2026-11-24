import type { Asset, PriceProvider } from "@hamac/core";
import { MarketError, type Quote } from "./http";

/** Écart maximal avec le dernier cours connu d'une autre source, au-delà : devise ou cotation différente. */
const MAX_JUMP = 0.25;

export interface LastPrice {
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
    throw new MarketError(`Cours incohérent (${q.price.toLocaleString("fr-FR")} contre ${last.price.toLocaleString("fr-FR")} connu) : devise ou cotation différente ?`);
  }
}
