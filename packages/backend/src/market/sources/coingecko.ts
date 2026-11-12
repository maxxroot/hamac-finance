import { type Fetcher, getJson, isoDay, type Quote } from "../http";

const BASE = "https://api.coingecko.com/api/v3";

/** Historique quotidien en euros (le dernier point est le cours actuel). */
export async function coingeckoHistory(fetcher: Fetcher, id: string, days: number): Promise<Quote[]> {
  const j = await getJson<{ prices?: Array<[number, number]> }>(fetcher, `${BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=eur&days=${Math.max(1, Math.min(365, days))}&interval=daily`);
  const byDay = new Map<string, number>();
  for (const [t, p] of j.prices ?? []) byDay.set(isoDay(t), p);
  return [...byDay.entries()].map(([date, price]) => ({ date, price }));
}

export interface CryptoCandidate {
  id: string;
  symbol: string;
  name: string;
}

export async function coingeckoSearch(fetcher: Fetcher, query: string): Promise<CryptoCandidate[]> {
  const j = await getJson<{ coins?: Array<{ id: string; symbol: string; name: string }> }>(fetcher, `${BASE}/search?query=${encodeURIComponent(query)}`);
  return (j.coins ?? []).slice(0, 6).map((c) => ({ id: c.id, symbol: c.symbol, name: c.name }));
}
