import { countryCode, currencyCode, sectorFromLabel, type EtfHolding, type HoldingKind } from "@hamac/core";
import { type Fetcher, getJson, MarketError } from "./http";

/**
 * Composition des ETF chez l'émetteur, à partir de l'ISIN : Amundi et iShares.
 * Adresses non documentées, vérifiées le 11 novembre 2026, susceptibles de changer sans prévenir.
 * On garde l'émetteur et son identifiant, jamais une adresse : elles sont reconstruites ici, à partir d'hôtes fixes,
 * pour qu'un changement se corrige en un seul endroit et que le serveur ne télécharge jamais une adresse saisie.
 *
 * Attention aux ETF synthétiques (à swap) : ils publient le panier qu'ils détiennent, pas l'exposition qu'ils donnent.
 * La méthode de réplication est donc toujours renvoyée avec la composition.
 */

export type CompositionIssuer = "amundi" | "ishares";
export type Replication = "physique" | "synthetique";

/** De quoi retrouver une composition : c'est ce qui sera gardé en base. */
export interface CompositionSource {
  issuer: CompositionIssuer;
  /** ISIN chez Amundi, numéro de produit chez iShares. */
  issuerId: string;
}

export interface FetchedComposition extends CompositionSource {
  fundName: string;
  /** null quand l'émetteur ne le dit pas et que la composition ne permet pas de le déduire. */
  replication: Replication | null;
  /** Date de la composition publiée (AAAA-MM-JJ). */
  asOf: string;
  lines: EtfHolding[];
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

// ——— Amundi ———

const AMUNDI_URL = "https://www.amundietf.fr/mapi/ProductAPI/getProductsData";
const AMUNDI_FIELDS = ["date", "type", "isin", "name", "weight", "currency", "sector", "countryOfRisk", "bbg"];

interface AmundiLine {
  date?: string;
  type?: string;
  isin?: string;
  name?: string;
  weight?: number;
  currency?: string;
  sector?: string;
  countryOfRisk?: string;
  bbg?: string;
}

export interface AmundiProduct {
  productId?: string;
  characteristics?: Record<string, string | undefined> | null;
  composition?: { compositionData?: Array<{ compositionCharacteristics?: AmundiLine; weight?: number }> | null } | null;
}

const AMUNDI_KIND: Record<string, HoldingKind> = {
  EQUITY_ORDINARY: "action",
  DEPOSITORY_RECEIPT: "action",
  PREFERENCE_SHARES: "action",
  RIGHT: "derive",
  WARRANT: "derive",
  FUTURE: "derive",
  CASH: "liquidites",
};

function amundiKind(type: string | undefined): HoldingKind {
  const t = (type ?? "").toUpperCase();
  if (AMUNDI_KIND[t]) return AMUNDI_KIND[t];
  if (/BOND|DEBT|NOTE|FIXED/.test(t)) return "obligation";
  if (/FORWARD|SWAP|OPTION|FX/.test(t)) return "derive";
  if (/CASH|DEPOSIT|MONEY/.test(t)) return "liquidites";
  return "autre";
}

/** « Direct(Physical) », « Indirect(Swap Based) » → physique, synthétique. */
export function amundiReplication(raw: string | undefined): Replication | null {
  if (!raw) return null;
  if (/^indirect|swap|synthetic/i.test(raw)) return "synthetique";
  if (/^direct|physical/i.test(raw)) return "physique";
  return null;
}

const hasLocation = (kind: HoldingKind) => kind === "action" || kind === "obligation";

/** Produit renvoyé par l'API Amundi → composition, ou null si Amundi ne connaît pas l'ISIN. */
export function parseAmundiProduct(isin: string, product: AmundiProduct | undefined): FetchedComposition | null {
  if (!product || product.productId !== isin) return null;
  const rows = product.composition?.compositionData ?? [];
  if (!rows.length) throw new MarketError("Amundi ne publie pas la composition de cet ETF.");
  let asOf = "";
  const lines: EtfHolding[] = [];
  for (const r of rows) {
    const c = r.compositionCharacteristics ?? {};
    const weight = c.weight ?? r.weight;
    if (typeof weight !== "number" || !Number.isFinite(weight)) continue;
    if (c.date && /^\d{4}-\d{2}-\d{2}$/.test(c.date) && c.date > asOf) asOf = c.date;
    const kind = amundiKind(c.type);
    lines.push({
      name: (c.name ?? "").trim() || "?",
      isin: c.isin && ISIN_RE.test(c.isin) ? c.isin : null,
      ticker: c.bbg?.trim() || null,
      weight,
      kind,
      sector: hasLocation(kind) ? sectorFromLabel(c.sector) : null,
      country: hasLocation(kind) ? countryCode(c.countryOfRisk) : null,
      currency: currencyCode(c.currency),
    });
  }
  if (!lines.length || !asOf) throw new MarketError("La composition renvoyée par Amundi est illisible.");
  return {
    issuer: "amundi",
    issuerId: isin,
    fundName: product.characteristics?.SHARE_MARKETING_NAME?.trim() || isin,
    replication: amundiReplication(product.characteristics?.FUND_REPLICATION_METHODOLOGY),
    asOf,
    lines,
  };
}

export async function amundiComposition(fetcher: Fetcher, isin: string): Promise<FetchedComposition | null> {
  if (!ISIN_RE.test(isin)) throw new MarketError("ISIN invalide.");
  const body = {
    context: { countryCode: "FRA", languageCode: "fr", userProfileName: "RETAIL" },
    productIds: [isin],
    productType: "PRODUCT",
    characteristics: ["FUND_REPLICATION_METHODOLOGY", "SHARE_MARKETING_NAME"],
    composition: { compositionFields: AMUNDI_FIELDS },
  };
  const j = await getJson<{ products?: AmundiProduct[] }>(fetcher, AMUNDI_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return parseAmundiProduct(isin, j.products?.find((p) => p.productId === isin));
}

// ——— iShares ———

const ISHARES = "https://www.ishares.com";
const ISHARES_PRODUCTS = `${ISHARES}/uk/individual/en/products`;
const ID_RE = /^\d{1,10}$/;

function checkId(id: string): string {
  if (!ID_RE.test(id)) throw new MarketError("Numéro de produit iShares invalide.");
  return id;
}

/** L'adresse doit contenir un nom de fonds, mais n'importe quel mot convient : « x » évite de le garder. */
export const isharesHoldingsUrl = (id: string) => `${ISHARES_PRODUCTS}/${checkId(id)}/x/latest-holdings.csv`;
export const isharesPageUrl = (id: string) => `${ISHARES_PRODUCTS}/${checkId(id)}/x`;

interface IsharesSearch {
  results?: Array<{ portfolioId?: string; fundName?: string; portfolioType?: string }>;
}

/** ISIN → numéro de produit iShares, par la recherche du site ; null si iShares ne le connaît pas. */
export async function isharesFind(fetcher: Fetcher, isin: string): Promise<{ portfolioId: string; fundName: string } | null> {
  if (!ISIN_RE.test(isin)) throw new MarketError("ISIN invalide.");
  const q = new URLSearchParams({ site: "ishares-uk", locale: "en-gb", userType: "individual", rows: "5", start: "0", query: isin });
  const j = await getJson<IsharesSearch>(fetcher, `${ISHARES}/varnish-api/core-search/search/products?${q}`);
  const funds = (j.results ?? []).filter((r) => r.portfolioId && ID_RE.test(r.portfolioId));
  // Un ISIN désigne une seule part : plusieurs réponses veulent dire que la recherche a été approximative.
  if (funds.length !== 1) return null;
  return { portfolioId: funds[0]!.portfolioId!, fundName: funds[0]!.fundName?.trim() || isin };
}

/** Découpe une ligne CSV : champs entre guillemets, virgules et guillemets doublés à l'intérieur. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

/** « 10/Nov/2026 » → 2026-11-10. */
function isharesDate(s: string): string | null {
  const m = /^(\d{1,2})\/([A-Za-z]{3})\/(\d{4})$/.exec(s.trim());
  const month = m && MONTHS[m[2]!.toLowerCase()];
  return m && month ? `${m[3]}-${month}-${m[1]!.padStart(2, "0")}` : null;
}

/** « 1,234.56 » → 1234.56 ; « - » ou vide → null. */
function isharesNumber(s: string | undefined): number | null {
  const t = (s ?? "").trim().replace(/,/g, "");
  if (!t || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const ISHARES_KIND: Record<string, HoldingKind> = {
  equity: "action",
  "fixed income": "obligation",
  cash: "liquidites",
  "money market": "liquidites",
  "cash collateral and margins": "liquidites",
  fx: "derive",
  futures: "derive",
  swaps: "derive",
  options: "derive",
};

/** Fichier « latest-holdings.csv » d'iShares → date et lignes. Les colonnes sont lues par leur nom : elles varient selon le fonds. */
export function parseIsharesHoldings(csv: string): { asOf: string; lines: EtfHolding[] } {
  const rows = csv.replace(/^﻿/, "").split(/\r?\n/);
  const asOf = isharesDate(/^Fund Holdings as of,"?([^",]+)"?/.exec(rows[0] ?? "")?.[1] ?? "");
  const hi = rows.findIndex((r) => r.startsWith("Ticker,"));
  if (!asOf || hi < 0) throw new MarketError("Le fichier de composition d'iShares a un format inattendu.");
  const header = splitCsvLine(rows[hi]!);
  const col = (name: string) => header.indexOf(name);
  const [cName, cWeight, cClass] = [col("Name"), col("Weight (%)"), col("Asset Class")];
  if (cName < 0 || cWeight < 0 || cClass < 0) throw new MarketError("Le fichier de composition d'iShares a changé de colonnes.");
  const [cTicker, cSector, cLocation, cCurrency, cIsin] = [col("Ticker"), col("Sector"), col("Location"), col("Market Currency"), col("ISIN")];
  const lines: EtfHolding[] = [];
  for (const row of rows.slice(hi + 1)) {
    if (!row.trim()) continue;
    const cells = splitCsvLine(row);
    // Les mentions en bas de fichier n'ont pas le nombre de colonnes de l'en-tête.
    if (cells.length !== header.length) continue;
    const pct = isharesNumber(cells[cWeight]);
    if (pct == null) continue;
    const kind = ISHARES_KIND[(cells[cClass] ?? "").trim().toLowerCase()] ?? "autre";
    const ticker = cTicker >= 0 ? (cells[cTicker] ?? "").trim() : "";
    const isin = cIsin >= 0 ? (cells[cIsin] ?? "").trim() : "";
    lines.push({
      name: (cells[cName] ?? "").trim() || "?",
      isin: ISIN_RE.test(isin) ? isin : null,
      ticker: ticker && ticker !== "-" ? ticker : null,
      weight: pct / 100,
      kind,
      sector: hasLocation(kind) ? sectorFromLabel(cSector >= 0 ? cells[cSector] : null) : null,
      country: hasLocation(kind) ? countryCode(cLocation >= 0 ? cells[cLocation] : null) : null,
      currency: currencyCode(cCurrency >= 0 ? cells[cCurrency] : null),
    });
  }
  if (!lines.length) throw new MarketError("Le fichier de composition d'iShares est vide.");
  return { asOf, lines };
}

/** Page produit iShares → nom du fonds et structure (« Physical » ou « Synthetic »). */
export function parseIsharesPage(html: string): { fundName: string | null; replication: Replication | null } {
  const t = html.replace(/&quot;/g, '"');
  const structure = /"productStructure":\{[^{}]*?"formattedValue":"([^"]*)"/.exec(t)?.[1];
  const title = /<title>([^<|]+)/.exec(html)?.[1]?.trim();
  return {
    fundName: title && title !== "Home" ? title.replace(/&amp;/g, "&") : null,
    replication: structure ? (/synthetic/i.test(structure) ? "synthetique" : /physical/i.test(structure) ? "physique" : null) : null,
  };
}

/**
 * Faute de page lisible : un fonds à swap iShares publie une ligne pour l'indice lui-même, de poids proche de 100 %,
 * suivie du panier détenu, ce qui fait environ 200 % au total.
 */
export function looksSynthetic(lines: EtfHolding[]): boolean {
  const total = lines.reduce((s, l) => s + l.weight, 0);
  return total > 1.5 || lines.some((l) => l.weight > 0.5 && /\bINDEX\b/i.test(l.name));
}

export async function isharesComposition(fetcher: Fetcher, portfolioId: string, knownName?: string): Promise<FetchedComposition> {
  const [csvRes, page] = await Promise.all([
    fetcher(isharesHoldingsUrl(portfolioId), { headers: { Accept: "text/csv,text/plain,*/*" } }),
    // La page ne sert qu'à la structure et au nom : son échec ne bloque pas la composition.
    fetcher(isharesPageUrl(portfolioId), { headers: { Accept: "text/html,*/*" } })
      .then(async (r) => (r.ok ? parseIsharesPage(await r.text()) : null))
      .catch(() => null),
  ]);
  if (csvRes.status === 429) throw new MarketError("iShares limite l'accès, réessayez plus tard.");
  if (!csvRes.ok) throw new MarketError(`iShares ne publie pas la composition de ce fonds (réponse ${csvRes.status}).`);
  const { asOf, lines } = parseIsharesHoldings(await csvRes.text());
  return {
    issuer: "ishares",
    issuerId: portfolioId,
    fundName: knownName ?? page?.fundName ?? `iShares ${portfolioId}`,
    replication: page?.replication ?? (looksSynthetic(lines) ? "synthetique" : null),
    asOf,
    lines,
  };
}

// ——— Chaîne ———

/** Retélécharge une composition dont on connaît déjà la source (mise à jour trimestrielle). */
export function fetchComposition(fetcher: Fetcher, source: CompositionSource): Promise<FetchedComposition> {
  if (source.issuer === "amundi")
    return amundiComposition(fetcher, source.issuerId).then((c) => {
      if (!c) throw new MarketError("Amundi ne connaît plus cet ETF.");
      return c;
    });
  return isharesComposition(fetcher, source.issuerId);
}

/**
 * Cherche la composition d'un ETF chez chaque émetteur géré, Amundi puis iShares.
 * null si aucun ne connaît l'ISIN ; une erreur seulement si aucun n'a pu répondre.
 */
export async function findComposition(fetcher: Fetcher, isin: string): Promise<FetchedComposition | null> {
  const errors: string[] = [];
  try {
    const c = await amundiComposition(fetcher, isin);
    if (c) return c;
  } catch (e) {
    errors.push(`Amundi : ${(e as Error).message}`);
  }
  try {
    const found = await isharesFind(fetcher, isin);
    if (found) return await isharesComposition(fetcher, found.portfolioId, found.fundName);
  } catch (e) {
    errors.push(`iShares : ${(e as Error).message}`);
  }
  if (errors.length === 2) throw new MarketError(errors.join(" ; "));
  // Un émetteur a répondu qu'il ne connaît pas l'ISIN, l'autre a échoué : on le dit, sans conclure.
  if (errors.length) throw new MarketError(errors[0]!);
  return null;
}
