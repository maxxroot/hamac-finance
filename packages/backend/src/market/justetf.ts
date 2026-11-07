import { type Fetcher, getJson, MarketError, type Quote } from "./http";

/** justETF : cours des ETF (et ETC) en euros, par ISIN. */
interface JustEtfChart {
  latestQuote?: { raw: number };
  latestQuoteDate?: string;
  series?: Array<{ date: string; value: { raw: number } }>;
}

export async function justEtfHistory(fetcher: Fetcher, isin: string, from: string, to: string): Promise<Quote[]> {
  const url = `https://www.justetf.com/api/etfs/${encodeURIComponent(isin)}/performance-chart?locale=fr&currency=EUR&valuesType=MARKET_VALUE&reduceData=false&includeDividends=false&dateFrom=${from}&dateTo=${to}`;
  const j = await getJson<JustEtfChart>(fetcher, url);
  const points = (j.series ?? []).map((p) => ({ date: p.date, price: p.value.raw })).filter((p) => p.price > 0);
  if (j.latestQuote && j.latestQuoteDate && !points.some((p) => p.date === j.latestQuoteDate)) points.push({ date: j.latestQuoteDate, price: j.latestQuote.raw });
  if (!points.length) throw new MarketError("justETF ne connaît pas cet ISIN (ce n'est peut-être pas un ETF).");
  return points;
}
