import { type Fetcher, MarketError, type Quote } from "./http";

/**
 * Twelve Data (clé personnelle). Offre gratuite : 800 requêtes par jour, 8 par minute,
 * marché américain seulement (Euronext demande une offre payante).
 * Le quota est compté ici et jamais dépassé, même avec une instance web allumée en permanence.
 */
export const TD_DAILY_LIMIT = 800;
/** Marge de 5 % : d'autres appels peuvent exister (site de Twelve Data, autre outil). */
export const safeLimit = (dailyLimit: number) => Math.max(1, Math.floor((dailyLimit * 95) / 100));
export const TD_SAFE_LIMIT = safeLimit(TD_DAILY_LIMIT);
export const TD_PER_MINUTE = 8;
/** Rythme par défaut ; le quota peut seulement le ralentir. */
export const BASE_REFRESH_MINUTES = 30;

/**
 * Intervalle entre deux actualisations pour que `assets` titres passant par Twelve Data
 * restent sous le quota journalier : au plus 1440 / intervalle passages × `assets` requêtes.
 */
export function refreshIntervalMinutes(assets: number, base = BASE_REFRESH_MINUTES, dailyLimit = TD_DAILY_LIMIT): number {
  if (assets <= 0) return base;
  return Math.max(base, Math.min(1440, Math.ceil((1440 * assets) / safeLimit(dailyLimit))));
}

export interface TwelveDataUsage {
  day: string;
  used: number;
}

interface Shared extends TwelveDataUsage {
  calls: number[];
}

/** Compteurs par clé, partagés entre les bases : deux comptes web peuvent utiliser la même clé. */
const shared = new Map<string, Shared>();
/** Symboles refusés (hors offre) : inutile de redépenser une requête pendant 24 h. */
const refused = new Map<string, { until: number; message: string }>();

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export class TwelveDataBudget {
  private state: Shared;

  constructor(
    key: string,
    stored: TwelveDataUsage | null,
    private dailyLimit: number = TD_DAILY_LIMIT,
    private now: () => number = Date.now,
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {
    const day = utcDay(this.now());
    const cur = shared.get(key);
    const state: Shared = cur ?? { day, used: 0, calls: [] };
    shared.set(key, state);
    this.state = state;
    this.roll();
    if (stored?.day === day) state.used = Math.max(state.used, stored.used);
  }

  private roll() {
    const day = utcDay(this.now());
    if (this.state.day !== day) {
      this.state.day = day;
      this.state.used = 0;
    }
  }

  get usage(): TwelveDataUsage {
    this.roll();
    return { day: this.state.day, used: this.state.used };
  }

  /** Réserve une requête, en attendant si besoin la limite par minute. Lève une erreur si le quota du jour est atteint. */
  async acquire(): Promise<void> {
    for (;;) {
      this.roll();
      if (this.state.used >= safeLimit(this.dailyLimit)) throw new MarketError("Quota Twelve Data du jour atteint.");
      const t = this.now();
      this.state.calls = this.state.calls.filter((c) => t - c < 60_000);
      if (this.state.calls.length < TD_PER_MINUTE) break;
      await this.sleep(this.state.calls[0]! + 60_050 - t);
    }
    this.state.calls.push(this.now());
    this.state.used++;
  }

  /** Twelve Data a répondu « quota dépassé » : plus aucun appel aujourd'hui. */
  exhaust() {
    this.roll();
    this.state.used = this.dailyLimit;
  }
}

/** Suffixe Yahoo → code de place (MIC) ; sans suffixe, marché américain. */
const MIC_BY_SUFFIX: Record<string, string> = { PA: "XPAR", AS: "XAMS", BR: "XBRU", LS: "XLIS", DE: "XETR", F: "XFRA", MI: "XMIL", MC: "XMAD", SW: "XSWX", L: "XLON" };

export function twelveDataSymbol(symbol: string): { symbol: string; mic: string | null } {
  const m = /^(.+)\.([A-Z]{1,2})$/.exec(symbol);
  const mic = m ? MIC_BY_SUFFIX[m[2]!] : undefined;
  return m && mic ? { symbol: m[1]!, mic } : { symbol, mic: null };
}

interface Series {
  status?: string;
  code?: number;
  message?: string;
  meta?: { currency?: string };
  values?: Array<{ datetime: string; close: string }>;
}

export async function twelveDataHistory(fetcher: Fetcher, key: string, budget: TwelveDataBudget, rawSymbol: string, from: string): Promise<Quote[]> {
  const cacheKey = `${key}:${rawSymbol}`;
  const no = refused.get(cacheKey);
  if (no && no.until > Date.now()) throw new MarketError(no.message);
  await budget.acquire();
  const { symbol, mic } = twelveDataSymbol(rawSymbol);
  const q = new URLSearchParams({ symbol, interval: "1day", start_date: from, outputsize: "5000", apikey: key });
  if (mic) q.set("mic_code", mic);
  const res = await fetcher(`https://api.twelvedata.com/time_series?${q}`);
  let j: Series;
  try {
    j = (await res.json()) as Series;
  } catch {
    throw new MarketError(`Réponse ${res.status} illisible de Twelve Data.`);
  }
  const code = j.status === "error" ? (j.code ?? res.status) : res.ok ? 200 : res.status;
  if (code === 429) {
    budget.exhaust();
    throw new MarketError("Twelve Data signale un quota dépassé : plus d'appel aujourd'hui.");
  }
  if (code === 401) throw new MarketError("Clé Twelve Data refusée.");
  if (code === 403 || code === 404 || code === 400) {
    const message = `${symbol}${mic ? ` (${mic})` : ""} n'est pas couvert par votre offre Twelve Data.`;
    refused.set(cacheKey, { until: Date.now() + 86_400_000, message });
    throw new MarketError(message);
  }
  if (code !== 200) throw new MarketError(`Réponse ${code} de Twelve Data.`);
  if (j.meta?.currency && j.meta.currency !== "EUR") throw new MarketError(`Cotation en ${j.meta.currency} : choisissez la cotation en euros.`);
  const quotes = (j.values ?? []).map((v) => ({ date: v.datetime.slice(0, 10), price: Number(v.close) })).filter((p) => p.price > 0);
  if (!quotes.length) throw new MarketError("Twelve Data ne renvoie aucun cours pour ce titre.");
  return quotes.sort((a, b) => a.date.localeCompare(b.date));
}
