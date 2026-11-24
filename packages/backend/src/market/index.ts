import { addMonths, currencyOf, EUR, PRICE_PROVIDER_LABELS, type Asset, type PriceProvider } from "@hamac/core";
import { coingeckoHistory, coingeckoSearch } from "./sources/coingecko";
import { customQuote } from "./sources/custom";
import { euronextHistory, euronextSearch } from "./sources/euronext";
import { type Fetcher, MarketError, type Quote } from "./http";
import { justEtfHistory } from "./sources/justetf";
import { figiByIsin, figiSearch, ISIN_RE, type Candidate } from "./sources/openfigi";
import { twelveDataHistory, type TwelveDataBudget } from "./sources/twelvedata";
import { yahooHistory, yahooRange } from "./sources/yahoo";

export type { Candidate, Fetcher, Quote };
export { defaultFetcher } from "./http";
export { parseBondTicker } from "./sources/openfigi";

/** Ordre par défaut de la chaîne : sources sans clé d'abord, Yahoo en dernier recours. */
export const DEFAULT_PROVIDER_ORDER: PriceProvider[] = ["justetf", "euronext", "twelvedata", "yahoo", "coingecko"];

/** Ce qu'il faut savoir d'un titre pour trouver son cours. */
export type MarketAsset = Pick<Asset, "kind" | "isin" | "symbol" | "priceSource" | "priceProvider" | "priceUrl" | "pricePath" | "currency">;

/** Adresse personnalisée : propre à la personne, jamais dans la base commune. */
export const isPersonal = (a: MarketAsset): boolean => !!a.priceUrl && !!a.pricePath && (a.priceProvider == null || a.priceProvider === "url");

/**
 * Identité d'un titre dans la base commune, ou null s'il n'y figure pas. L'ISIN seul ne suffit pas :
 * le symbole distingue les places de cotation et les devises. Un titre en devise porte sa devise dans la clé
 * (les cours sont dans cette devise) ; un titre en euros garde la clé d'avant les devises.
 */
export function instrumentKey(a: MarketAsset): string | null {
  if (a.priceSource !== "auto" || isPersonal(a) || a.priceProvider === "url" || a.kind === "obligation" || a.kind === "scpi" || (!a.isin && !a.symbol)) return null;
  const currency = currencyOf(a);
  return [a.kind, (a.isin ?? "").toUpperCase(), (a.symbol ?? "").toUpperCase(), a.priceProvider ?? "auto", ...(currency === EUR ? [] : [currency])].join("|");
}

export interface ProviderSetting {
  id: PriceProvider;
  enabled: boolean;
}

export const defaultProviderSettings = (): ProviderSetting[] => DEFAULT_PROVIDER_ORDER.map((id) => ({ id, enabled: true }));

/** Ce fournisseur peut-il donner le cours de ce titre ? */
export function supports(p: PriceProvider, asset: MarketAsset, hasTwelveDataKey: boolean): boolean {
  const crypto = asset.kind === "crypto";
  switch (p) {
    case "justetf":
      return (asset.kind === "etf" || asset.kind === "etc" || asset.kind === "fonds") && !!asset.isin;
    case "euronext":
      // Les places retenues cotent en euros.
      return !crypto && !!asset.isin && currencyOf(asset) === EUR;
    case "twelvedata":
      return !crypto && !!asset.symbol && hasTwelveDataKey;
    case "yahoo":
      return !crypto && !!asset.symbol;
    case "coingecko":
      return crypto && !!asset.symbol;
    case "url":
      return !!asset.priceUrl && !!asset.pricePath;
  }
}

/** Sources à essayer pour un titre, dans l'ordre, ou la raison pour laquelle il n'y en a pas. */
export function chainFor(asset: MarketAsset, order: readonly ProviderSetting[], hasTwelveDataKey: boolean): { chain: PriceProvider[]; reason: string | null } {
  if (asset.priceSource !== "auto") return { chain: [], reason: "Cours manuel ou calculé" };
  if (asset.kind === "obligation") return { chain: [], reason: "Obligation : valeur calculée" };
  if (asset.kind === "scpi" && asset.priceProvider !== "url") return { chain: [], reason: "SCPI : prix de part saisi à la main" };
  if (asset.priceProvider) {
    if (supports(asset.priceProvider, asset, hasTwelveDataKey)) return { chain: [asset.priceProvider], reason: null };
    if (asset.priceProvider === "twelvedata" && !hasTwelveDataKey) return { chain: [], reason: "Clé Twelve Data non configurée sur le serveur" };
    if (asset.priceProvider === "url") return { chain: [], reason: "Adresse ou chemin du prix manquant" };
    return { chain: [], reason: `${PRICE_PROVIDER_LABELS[asset.priceProvider]} ne peut pas donner le cours de ce titre (ISIN ou symbole manquant)` };
  }
  const chain = [...(supports("url", asset, hasTwelveDataKey) ? (["url"] as PriceProvider[]) : []), ...order.filter((o) => o.enabled && o.id !== "url" && supports(o.id, asset, hasTwelveDataKey)).map((o) => o.id)];
  if (chain.length) return { chain, reason: null };
  if (asset.kind === "crypto") return { chain, reason: "Identifiant CoinGecko manquant (ex. bitcoin), ou source désactivée" };
  return { chain, reason: asset.isin || asset.symbol ? "Aucune source active ne couvre ce titre" : "Ni ISIN ni symbole : saisissez le cours à la main" };
}

export interface MarketEnv {
  twelveDataKey: string | null;
  budget: TwelveDataBudget | null;
  /** Instance web : les adresses personnalisées ne peuvent pas viser le réseau interne. */
  web: boolean;
}

/** Cours d'un titre chez un fournisseur, depuis `since` (exclu). Premier chargement : deux ans d'historique. */
export async function fetchFrom(fetcher: Fetcher, provider: PriceProvider, asset: MarketAsset, since: string | null, today: string, env: MarketEnv): Promise<Quote[]> {
  const from = since ?? addMonths(today, -24);
  let quotes: Quote[];
  switch (provider) {
    case "justetf":
      quotes = await justEtfHistory(fetcher, asset.isin!, from, today, false, currencyOf(asset));
      break;
    case "euronext":
      quotes = await euronextHistory(fetcher, asset.isin!, from, today);
      break;
    case "twelvedata":
      if (!env.twelveDataKey || !env.budget) throw new MarketError("Clé Twelve Data manquante.");
      quotes = await twelveDataHistory(fetcher, env.twelveDataKey, env.budget, asset.symbol!, from, currencyOf(asset));
      break;
    case "coingecko": {
      const days = Math.ceil((Date.parse(today) - Date.parse(from)) / 86_400_000) + 1;
      quotes = await coingeckoHistory(fetcher, asset.symbol!, days);
      break;
    }
    case "yahoo":
      quotes = await yahooHistory(fetcher, asset.symbol!, yahooRange(since, today), currencyOf(asset));
      break;
    case "url":
      quotes = await customQuote(fetcher, asset, today, env.web);
      break;
  }
  return quotes.filter((q) => (!since || q.date > since) && q.date <= today);
}

/** Date de départ demandée pour un historique complet : chaque source répond à partir de ce qu'elle a. */
const LONG_HISTORY_FROM = "2000-01-01";

export interface LongHistory {
  quotes: Quote[];
  /** Vrai si les dividendes distribués sont inclus, comme s'ils étaient réinvestis. */
  dividends: boolean;
}

/** Historique le plus long possible chez un fournisseur, pour comparer des titres sur plusieurs années. */
export async function fetchLongHistory(fetcher: Fetcher, provider: PriceProvider, asset: MarketAsset, today: string): Promise<LongHistory> {
  const within = (quotes: Quote[]) => quotes.filter((q) => q.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  switch (provider) {
    case "justetf":
      return { quotes: within(await justEtfHistory(fetcher, asset.isin!, LONG_HISTORY_FROM, today, true)), dividends: true };
    case "euronext":
      return { quotes: within(await euronextHistory(fetcher, asset.isin!, LONG_HISTORY_FROM, today)), dividends: false };
    case "yahoo":
      return { quotes: within(await yahooHistory(fetcher, asset.symbol!, "10y")), dividends: false };
    case "coingecko":
      return { quotes: within(await coingeckoHistory(fetcher, asset.symbol!, 365)), dividends: false };
    case "twelvedata":
    case "url":
      throw new MarketError("Cette source ne sert pas aux comparaisons.");
  }
}

/** Recherche de titres : ISIN → OpenFIGI ; texte → Euronext (qui donne l'ISIN, donc les cours) + OpenFIGI + CoinGecko. */
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
  const [euronext, figi, crypto] = await Promise.allSettled([euronextSearch(fetcher, q), figiSearch(fetcher, q), coingeckoSearch(fetcher, q)]);
  const candidates: Candidate[] = [];
  const listed: Candidate[] =
    euronext.status === "fulfilled"
      ? euronext.value.slice(0, 8).map((h) => ({ source: "euronext", kind: h.kind, name: h.name, isin: h.isin, symbol: h.kind === "action" && h.ticker && (h.mic === "XPAR" || h.mic === "ALXP") ? `${h.ticker}.PA` : null, exchange: h.mic, couponRate: null, maturityDate: null, detail: `${h.ticker ?? ""} · ${h.mic}` }))
      : [];
  if (euronext.status === "rejected") errors.push(`Euronext : ${euronext.reason?.message ?? "erreur"}`);
  const symbols = new Set(listed.map((c) => c.symbol).filter(Boolean));
  if (crypto.status === "fulfilled")
    candidates.push(
      ...crypto.value.slice(0, 3).map((c): Candidate => ({ source: "coingecko", kind: "crypto", name: c.name, isin: null, symbol: c.id, exchange: null, couponRate: null, maturityDate: null, detail: `${c.symbol.toUpperCase()} · CoinGecko` })),
    );
  else errors.push(`CoinGecko : ${crypto.reason?.message ?? "erreur"}`);
  if (figi.status === "fulfilled") {
    // Quand Euronext a répondu, les lignes sans ISIN ni symbole n'apporteraient qu'un titre impossible à coter.
    const useful = figi.value.filter((c) => !symbols.has(c.symbol) && (euronext.status === "rejected" || c.kind === "obligation" || c.isin != null || c.symbol != null));
    candidates.unshift(...listed, ...useful);
  } else candidates.unshift(...listed);
  if (figi.status === "rejected") errors.push(`OpenFIGI : ${figi.reason?.message ?? "erreur"}`);
  return { candidates, errors };
}
