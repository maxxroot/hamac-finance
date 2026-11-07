import { addMonths, type Asset } from "@hamac/core";
import { coingeckoHistory, coingeckoSearch } from "./coingecko";
import { type Fetcher, MarketError, type Quote } from "./http";
import { justEtfHistory } from "./justetf";
import { figiByIsin, figiSearch, ISIN_RE, type Candidate } from "./openfigi";
import { yahooHistory } from "./yahoo";

export type { Candidate, Fetcher, Quote };
export { defaultFetcher } from "./http";
export { parseBondTicker } from "./openfigi";

export type Provider = "justetf" | "yahoo" | "coingecko";

/** Fournisseur à utiliser pour un titre, ou la raison pour laquelle il n'y en a pas. */
export function providerFor(asset: Asset): { provider: Provider; key: string } | { provider: null; reason: string } {
  if (asset.priceSource !== "auto") return { provider: null, reason: "Cours manuel ou calculé" };
  if (asset.kind === "crypto") return asset.symbol ? { provider: "coingecko", key: asset.symbol } : { provider: null, reason: "Identifiant CoinGecko manquant (ex. bitcoin)" };
  if (asset.kind === "obligation") return { provider: null, reason: "Obligation : valeur calculée" };
  if ((asset.kind === "etf" || asset.kind === "fonds") && asset.isin) return { provider: "justetf", key: asset.isin };
  if (asset.symbol) return { provider: "yahoo", key: asset.symbol };
  return { provider: null, reason: "Ni ISIN d'ETF ni symbole : saisissez le cours à la main" };
}

/** Cours depuis `since` (exclu) jusqu'à aujourd'hui. Premier chargement : deux ans d'historique. */
export async function fetchQuotes(fetcher: Fetcher, asset: Asset, since: string | null, today: string): Promise<Quote[]> {
  const p = providerFor(asset);
  if (!p.provider) throw new MarketError(p.reason);
  const from = since ?? addMonths(today, -24);
  let quotes: Quote[];
  switch (p.provider) {
    case "justetf":
      quotes = await justEtfHistory(fetcher, p.key, from, today);
      break;
    case "coingecko": {
      const days = Math.ceil((Date.parse(today) - Date.parse(from)) / 86_400_000) + 1;
      quotes = await coingeckoHistory(fetcher, p.key, days);
      break;
    }
    case "yahoo":
      quotes = await yahooHistory(fetcher, p.key, since ? "5d" : "2y");
      break;
  }
  return quotes.filter((q) => (!since || q.date > since) && q.date <= today);
}

/** Recherche de titres : ISIN → OpenFIGI ; texte → OpenFIGI + CoinGecko. */
export async function searchAssets(fetcher: Fetcher, query: string): Promise<{ candidates: Candidate[]; errors: string[] }> {
  const q = query.trim();
  const errors: string[] = [];
  if (!q) return { candidates: [], errors };
  if (ISIN_RE.test(q.toUpperCase())) {
    try {
      return { candidates: await figiByIsin(fetcher, q.toUpperCase()), errors };
    } catch (e) {
      return { candidates: [], errors: [(e as Error).message] };
    }
  }
  const [figi, crypto] = await Promise.allSettled([figiSearch(fetcher, q), coingeckoSearch(fetcher, q)]);
  const candidates: Candidate[] = [];
  if (crypto.status === "fulfilled")
    candidates.push(
      ...crypto.value.slice(0, 3).map((c): Candidate => ({ source: "coingecko", kind: "crypto", name: c.name, isin: null, symbol: c.id, exchange: null, couponRate: null, maturityDate: null, detail: `${c.symbol.toUpperCase()} · CoinGecko` })),
    );
  else errors.push(`CoinGecko : ${crypto.reason?.message ?? "erreur"}`);
  if (figi.status === "fulfilled") candidates.unshift(...figi.value);
  else errors.push(`OpenFIGI : ${figi.reason?.message ?? "erreur"}`);
  return { candidates, errors };
}
