import type { AssetKind } from "@hamac/core";
import { type Fetcher, getJson } from "./http";
import { YAHOO_SUFFIX } from "./yahoo";

/** OpenFIGI (Bloomberg, gratuit) : identifie tout titre par ISIN ou par nom. */
interface FigiRecord {
  name?: string;
  ticker?: string;
  exchCode?: string;
  securityType?: string;
  securityType2?: string;
  marketSector?: string;
  securityDescription?: string;
}

export interface Candidate {
  source: "openfigi" | "coingecko";
  kind: AssetKind;
  name: string;
  isin: string | null;
  symbol: string | null;
  exchange: string | null;
  couponRate: number | null;
  maturityDate: string | null;
  detail: string;
}

export const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/** « FRTR 3 05/25/33 OAT » → coupon 3 %, échéance 2033-05-25. */
export function parseBondTicker(ticker: string): { couponRate: number; maturityDate: string } | null {
  const m = ticker.match(/\s(\d+(?:\.\d+)?)\s+(\d{2})\/(\d{2})\/(\d{2,4})\b/);
  if (!m) return null;
  const [, c, mm, dd, yy] = m;
  const year = yy.length === 4 ? +yy : +yy + (+yy > 70 ? 1900 : 2000);
  return { couponRate: Number((Number(c) / 100).toFixed(8)), maturityDate: `${year}-${mm}-${dd}` };
}

function kindOf(r: FigiRecord): AssetKind | null {
  const t2 = r.securityType2 ?? "";
  const t = r.securityType ?? "";
  if (r.marketSector === "Govt" || r.marketSector === "Corp" || t2 === "Govt" || t2 === "Corp") return "obligation";
  if (t === "ETP" || /ETF/i.test(r.name ?? "")) return "etf";
  if (t2 === "Mutual Fund") return "fonds";
  if (t2 === "Common Stock" || t2 === "Depositary Receipt" || t2 === "Preference") return "action";
  return null;
}

function toCandidate(r: FigiRecord, isin: string | null): Candidate | null {
  const kind = kindOf(r);
  if (!kind || !r.name) return null;
  const bond = kind === "obligation" && r.ticker ? parseBondTicker(r.ticker) : null;
  const suffix = r.exchCode ? YAHOO_SUFFIX[r.exchCode] : undefined;
  const symbol = kind === "action" && r.ticker && suffix !== undefined ? `${r.ticker}${suffix}` : null;
  return {
    source: "openfigi",
    kind,
    name: bond && r.ticker ? r.ticker.replace(/\s+(OAT|EMTN|FP|MTN)$/i, "") : r.name,
    isin,
    symbol,
    exchange: r.exchCode ?? null,
    couponRate: bond?.couponRate ?? null,
    maturityDate: bond?.maturityDate ?? null,
    detail: [r.name, r.ticker, r.exchCode, r.securityType2].filter(Boolean).join(" · "),
  };
}

function dedupe(list: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const k = `${c.kind}|${c.name}|${c.symbol}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function figiByIsin(fetcher: Fetcher, isin: string): Promise<Candidate[]> {
  const j = await getJson<Array<{ data?: FigiRecord[] }>>(fetcher, "https://api.openfigi.com/v3/mapping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin }]),
  });
  const records = j[0]?.data ?? [];
  // On privilégie la cotation parisienne quand elle existe.
  records.sort((a, b) => Number(b.exchCode === "FP" || b.exchCode === "EURONEXT-PARIS") - Number(a.exchCode === "FP" || a.exchCode === "EURONEXT-PARIS"));
  return dedupe(records.map((r) => toCandidate(r, isin)).filter((c): c is Candidate => c != null)).slice(0, 3);
}

export async function figiSearch(fetcher: Fetcher, query: string): Promise<Candidate[]> {
  const run = (body: object) =>
    getJson<{ data?: FigiRecord[] }>(fetcher, "https://api.openfigi.com/v3/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((j) => j.data ?? []);
  const [paris, bonds] = await Promise.all([run({ query, exchCode: "FP" }), run({ query, marketSecDes: "Corp" }).catch(() => [])]);
  const out = [...paris, ...bonds.filter((b) => b.ticker && !/PERP/.test(b.ticker))]
    .map((r) => toCandidate(r, null))
    .filter((c): c is Candidate => c != null)
    .filter((c) => c.kind !== "obligation" || (c.maturityDate != null && c.maturityDate > new Date().toISOString().slice(0, 10)));
  return dedupe(out).slice(0, 12);
}
