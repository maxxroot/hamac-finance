import { type Fetcher, getJson, isoDay, MarketError, type Quote } from "../http";

/**
 * Yahoo Finance (non officiel) : exige un cookie et un jeton « crumb ».
 * Au mieux : Yahoo peut refuser l'accès selon le réseau ; l'erreur est alors remontée telle quelle.
 */
let session: { cookie: string; crumb: string; at: number } | null = null;

async function getSession(fetcher: Fetcher) {
  if (session && Date.now() - session.at < 3600_000) return session;
  const res = await fetcher("https://fc.yahoo.com/", { redirect: "manual" });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const crumbRes = await fetcher("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { Cookie: cookie } });
  if (crumbRes.status === 429) throw new MarketError("Yahoo refuse l'accès depuis ce réseau (trop de requêtes). Saisissez le cours à la main ou réessayez plus tard.");
  const crumb = (await crumbRes.text()).trim();
  if (!crumbRes.ok || !crumb) throw new MarketError("Yahoo : session refusée.");
  session = { cookie, crumb, at: Date.now() };
  return session;
}

interface Chart {
  chart?: { result?: Array<{ meta?: { currency?: string; regularMarketPrice?: number; regularMarketTime?: number }; timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }>; error?: { description?: string } };
}

/** Période à demander à Yahoo pour combler l'écart depuis le dernier cours connu. */
export function yahooRange(since: string | null, today: string): "5d" | "1y" | "2y" {
  if (!since) return "2y";
  const days = (Date.parse(today) - Date.parse(since)) / 86_400_000;
  return days <= 4 ? "5d" : days <= 360 ? "1y" : "2y";
}

/** Cotations en sous-unité (pence, cents sud-africains, agorot) : devise et diviseur. */
const MINOR_UNITS: Record<string, { currency: string; divisor: number }> = { GBp: { currency: "GBP", divisor: 100 }, GBX: { currency: "GBP", divisor: 100 }, ZAc: { currency: "ZAR", divisor: 100 }, ILA: { currency: "ILS", divisor: 100 } };

/** Cours dans la devise attendue du titre ; une cotation dans une autre devise est refusée. */
export async function yahooHistory(fetcher: Fetcher, symbol: string, range: "5d" | "1y" | "2y" | "10y", currency = "EUR"): Promise<Quote[]> {
  const s = await getSession(fetcher);
  const j = await getJson<Chart>(fetcher, `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&crumb=${encodeURIComponent(s.crumb)}`, {
    headers: { Cookie: s.cookie },
  });
  const r = j.chart?.result?.[0];
  if (!r) throw new MarketError(j.chart?.error?.description ?? `Yahoo ne connaît pas le symbole ${symbol}.`);
  const quoted = r.meta?.currency ?? currency;
  const minor = MINOR_UNITS[quoted];
  const divisor = minor && minor.currency === currency ? minor.divisor : 1;
  if (quoted !== currency && divisor === 1) {
    throw new MarketError(currency === "EUR" ? `Cotation en ${quoted} : choisissez la cotation en euros (ex. suffixe .PA), ou indiquez la devise ${quoted} sur la fiche du titre.` : `Cotation en ${quoted}, alors que le titre est en ${currency} : vérifiez le symbole ou la devise du titre.`);
  }
  const closes = r.indicators?.quote?.[0]?.close ?? [];
  const points = (r.timestamp ?? []).map((t, i) => ({ date: isoDay(t * 1000), price: (closes[i] ?? Number.NaN) / divisor })).filter((p) => Number.isFinite(p.price));
  if (r.meta?.regularMarketPrice && r.meta.regularMarketTime) points.push({ date: isoDay(r.meta.regularMarketTime * 1000), price: r.meta.regularMarketPrice / divisor });
  return points;
}

/** Suffixe Yahoo pour un code de place OpenFIGI. */
export const YAHOO_SUFFIX: Record<string, string> = {
  FP: ".PA",
  NA: ".AS",
  BB: ".BR",
  PL: ".LS",
  GY: ".DE",
  GR: ".F",
  IM: ".MI",
  SM: ".MC",
  SW: ".SW",
  LN: ".L",
  US: "",
  UN: "",
  UW: "",
};
