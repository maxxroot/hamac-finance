import type { AssetKind } from "@hamac/core";
import { type Fetcher, getJson, MarketError, type Quote } from "../http";

/**
 * Euronext (site public, sans clé) : historique de clôture par ISIN et place de cotation.
 * Adresses non documentées, susceptibles de changer : une panne fait passer à la source suivante.
 */
const BASE = "https://live.euronext.com/en";

/**
 * Places retenues, par préférence. Le fichier d'historique n'indique pas la devise :
 * Amsterdam est exclue, car on y trouve des lignes en dollars (la source suivante prend le relais).
 */
const EUR_MARKETS = ["XPAR", "ALXP", "XMLI", "XBRU", "ALXB", "XLIS", "ALXL", "XMSM", "XESM", "ETFP", "MTAA"];

const marketCache = new Map<string, string>();

interface SearchHit {
  isin?: string;
  mic?: string;
}

async function marketFor(fetcher: Fetcher, isin: string): Promise<string> {
  const known = marketCache.get(isin);
  if (known) return known;
  const res = await fetcher(`${BASE}/instrumentSearch/searchJSON?q=${encodeURIComponent(isin)}`);
  if (res.status === 429) throw new MarketError("Euronext limite l'accès, réessayez plus tard.");
  let hits: SearchHit[];
  try {
    hits = JSON.parse(await res.text()) as SearchHit[];
  } catch {
    throw new MarketError("Euronext est momentanément indisponible.");
  }
  const mics = new Set(hits.filter((h) => h.isin === isin && h.mic).map((h) => h.mic!));
  if (!mics.size) throw new MarketError("Euronext ne connaît pas cet ISIN.");
  const mic = EUR_MARKETS.find((m) => mics.has(m));
  if (!mic) throw new MarketError("Ce titre n'a pas de cotation sûrement en euros sur Euronext.");
  marketCache.set(isin, mic);
  return mic;
}

export interface EuronextHit {
  isin: string;
  name: string;
  kind: AssetKind;
  ticker: string | null;
  mic: string;
}

/** « etvs » : ETC et ETN. Les ETN sur crypto, rangés au même endroit, sont écartés : ce ne sont pas des matières premières. */
const KIND_BY_SECTION: Record<string, AssetKind> = { etfs: "etf", etvs: "etc", equities: "action", funds: "fonds" };

const decodeHtml = (s: string) => s.replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();

/** Recherche par nom ou code : une ligne par ISIN, sur sa place en euros quand elle existe. */
export async function euronextSearch(fetcher: Fetcher, query: string): Promise<EuronextHit[]> {
  const rows = await getJson<Array<{ isin?: string; mic?: string; label?: string; link?: string }>>(fetcher, `${BASE}/instrumentSearch/searchJSON?q=${encodeURIComponent(query)}`);
  const byIsin = new Map<string, EuronextHit>();
  const rank = (mic: string) => (EUR_MARKETS.includes(mic) ? EUR_MARKETS.indexOf(mic) : EUR_MARKETS.length);
  for (const r of rows) {
    const kind = KIND_BY_SECTION[/\/product\/([a-z-]+)\//.exec(r.link ?? "")?.[1] ?? ""];
    const name = /<a [^>]*>([^<]+)<\/a>/.exec(r.label ?? "")?.[1];
    if (!kind || !name || !r.isin || !r.mic || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(r.isin)) continue;
    if (kind === "etc" && /btc|bitcoin|ether|crypto|solana/i.test(name)) continue;
    const known = byIsin.get(r.isin);
    if (known && rank(known.mic) <= rank(r.mic)) continue;
    byIsin.set(r.isin, { isin: r.isin, name: decodeHtml(name), kind, ticker: /<span class='symbol'>([^<]+)/.exec(r.label ?? "")?.[1]?.trim() ?? null, mic: r.mic });
  }
  return [...byIsin.values()];
}

/** « 06/11/2026;683.48;692.33;683.48;692.33;692.33;… » → date et clôture (à défaut, dernier cours). */
export function parseEuronextCsv(csv: string): Quote[] {
  const out: Quote[] = [];
  for (const line of csv.split(/\r?\n/)) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4});/.exec(line);
    if (!m) continue;
    const cols = line.split(";");
    const price = Number(cols[5]) || Number(cols[4]);
    if (price > 0) out.push({ date: `${m[3]}-${m[2]}-${m[1]}`, price });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function euronextHistory(fetcher: Fetcher, isin: string, from: string, to: string): Promise<Quote[]> {
  const mic = await marketFor(fetcher, isin);
  const q = new URLSearchParams({ format: "csv", decimal_separator: ".", date_form: "d/m/Y", op: "", adjusted: "Y", base100: "", startdate: from, enddate: to });
  const res = await fetcher(`${BASE}/ajax/AwlHistoricalPrice/getFullDownloadAjax/${isin}-${mic}?${q}`, { headers: { Accept: "text/csv,*/*" } });
  if (res.status === 429) throw new MarketError("Euronext limite l'accès, réessayez plus tard.");
  if (!res.ok) throw new MarketError(`Réponse ${res.status} d'Euronext.`);
  const quotes = parseEuronextCsv(await res.text());
  if (!quotes.length) throw new MarketError("Euronext ne renvoie pas d'historique pour ce titre.");
  return quotes;
}
