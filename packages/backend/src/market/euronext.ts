import { type Fetcher, MarketError, type Quote } from "./http";

/**
 * Euronext (site public, sans clé) : historique de clôture par ISIN et place de cotation.
 * Adresses non documentées, susceptibles de changer : une panne fait passer à la source suivante.
 */
const BASE = "https://live.euronext.com/en";

/** Places cotant en euros, par préférence. Amsterdam en dernier : on y trouve aussi des lignes en dollars. */
const EUR_MARKETS = ["XPAR", "ALXP", "XMLI", "XBRU", "ALXB", "XLIS", "ALXL", "XMSM", "XESM", "ETFP", "MTAA", "XAMS", "ALXA"];

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
  if (!mic) throw new MarketError("Ce titre n'est pas coté en euros sur Euronext.");
  marketCache.set(isin, mic);
  return mic;
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
