/**
 * Exposition réelle derrière les ETF : lignes d'une composition, harmonisées d'un émetteur à l'autre.
 * Les émetteurs écrivent les pays en anglais (« United States », « UAE ») et n'ont pas tous la même liste de secteurs :
 * les actions suivent les secteurs GICS, les obligations iShares une classification d'émetteurs (« Banking », « Electric »…).
 * Tout est ramené ici à un code pays ISO 3166-1 et à une liste fixe de secteurs, pour additionner des ETF de deux émetteurs.
 */

import type { AssetKind } from "./domain";
import type { PortfolioState } from "./engine";
import { roundCents } from "./money";

/** Nature d'une ligne : seuls les actions et les obligations portent un pays et un secteur qui ont un sens. */
export type HoldingKind = "action" | "obligation" | "liquidites" | "derive" | "autre";

export const SECTORS = [
  "technologie",
  "sante",
  "finance",
  "consommation_non_essentielle",
  "consommation_courante",
  "industrie",
  "communication",
  "energie",
  "materiaux",
  "immobilier",
  "services_publics",
  "etats",
  "autre",
] as const;
export type Sector = (typeof SECTORS)[number];

export const SECTOR_LABELS: Record<Sector, string> = {
  technologie: "Technologie",
  sante: "Santé",
  finance: "Banques, assurances et finance",
  consommation_non_essentielle: "Consommation non essentielle",
  consommation_courante: "Consommation courante",
  industrie: "Industrie",
  communication: "Communication et médias",
  energie: "Énergie",
  materiaux: "Matériaux",
  immobilier: "Immobilier",
  services_publics: "Eau, gaz et électricité",
  etats: "États et organismes publics",
  autre: "Autre",
};

/** Une ligne de la composition d'un ETF. Poids en fraction de l'actif du fonds. */
export interface EtfHolding {
  name: string;
  isin: string | null;
  ticker: string | null;
  weight: number;
  kind: HoldingKind;
  sector: Sector | null;
  /** Code ISO 3166-1 alpha-2, null quand l'émetteur n'en donne pas (liquidités, contrats à terme…). */
  country: string | null;
  /** Devise de cotation de la ligne (code ISO 4217) : pas forcément le risque de change d'une part couverte. */
  currency: string | null;
}

const SECTOR_BY_LABEL: Record<string, Sector> = {
  // Secteurs GICS (actions, Amundi et iShares).
  "information technology": "technologie",
  technology: "technologie",
  "health care": "sante",
  healthcare: "sante",
  financials: "finance",
  "consumer discretionary": "consommation_non_essentielle",
  "consumer staples": "consommation_courante",
  industrials: "industrie",
  communication: "communication",
  communications: "communication",
  "communication services": "communication",
  energy: "energie",
  materials: "materiaux",
  "real estate": "immobilier",
  utilities: "services_publics",
  // Secteurs des obligations d'entreprises chez iShares.
  banking: "finance",
  "finance companies": "finance",
  "financial other": "finance",
  insurance: "finance",
  "brokerage/asset managers/exchanges": "finance",
  "consumer cyclical": "consommation_non_essentielle",
  "consumer non-cyclical": "consommation_courante",
  "capital goods": "industrie",
  transportation: "industrie",
  "industrial other": "industrie",
  "basic industry": "materiaux",
  reits: "immobilier",
  electric: "services_publics",
  "natural gas": "services_publics",
  "utility other": "services_publics",
  // Obligations publiques.
  treasuries: "etats",
  treasury: "etats",
  government: "etats",
  "government related": "etats",
  sovereign: "etats",
  agency: "etats",
  supranational: "etats",
  "local authority": "etats",
};

/** Secteur harmonisé d'un libellé d'émetteur ; un libellé inconnu ou vide donne « autre ». */
export function sectorFromLabel(label: string | null | undefined): Sector {
  return SECTOR_BY_LABEL[(label ?? "").trim().toLowerCase()] ?? "autre";
}

/** Noms de pays employés par Amundi et iShares (relevés le 11 novembre 2026), et variantes courantes. */
const COUNTRY_CODES: Record<string, string> = {
  argentina: "AR",
  australia: "AU",
  austria: "AT",
  bahrain: "BH",
  belgium: "BE",
  bermuda: "BM",
  brazil: "BR",
  bulgaria: "BG",
  canada: "CA",
  "cayman islands": "KY",
  chile: "CL",
  china: "CN",
  colombia: "CO",
  croatia: "HR",
  "croatia (hrvatska)": "HR",
  curacao: "CW",
  cyprus: "CY",
  "czech republic": "CZ",
  czechia: "CZ",
  denmark: "DK",
  egypt: "EG",
  estonia: "EE",
  finland: "FI",
  france: "FR",
  germany: "DE",
  greece: "GR",
  guernsey: "GG",
  "hong kong": "HK",
  hungary: "HU",
  iceland: "IS",
  india: "IN",
  indonesia: "ID",
  ireland: "IE",
  "isle of man": "IM",
  israel: "IL",
  italy: "IT",
  japan: "JP",
  jersey: "JE",
  kazakhstan: "KZ",
  kenya: "KE",
  korea: "KR",
  "korea (south)": "KR",
  "south korea": "KR",
  kuwait: "KW",
  latvia: "LV",
  liberia: "LR",
  lithuania: "LT",
  luxembourg: "LU",
  macau: "MO",
  malaysia: "MY",
  malta: "MT",
  mexico: "MX",
  morocco: "MA",
  netherlands: "NL",
  "new zealand": "NZ",
  nigeria: "NG",
  norway: "NO",
  pakistan: "PK",
  panama: "PA",
  peru: "PE",
  philippines: "PH",
  poland: "PL",
  portugal: "PT",
  "puerto rico": "PR",
  qatar: "QA",
  romania: "RO",
  russia: "RU",
  "russian federation": "RU",
  "saudi arabia": "SA",
  singapore: "SG",
  "slovak republic": "SK",
  slovakia: "SK",
  slovenia: "SI",
  "south africa": "ZA",
  spain: "ES",
  sweden: "SE",
  switzerland: "CH",
  taiwan: "TW",
  thailand: "TH",
  turkey: "TR",
  türkiye: "TR",
  uae: "AE",
  "united arab emirates": "AE",
  "united kingdom": "GB",
  "united states": "US",
  usa: "US",
  vietnam: "VN",
};

/** Code ISO d'un nom de pays d'émetteur ; null pour un nom inconnu ou une zone (« European Union », « - »). */
export function countryCode(name: string | null | undefined): string | null {
  return COUNTRY_CODES[(name ?? "").trim().toLowerCase()] ?? null;
}

/** Code de devise ISO 4217, ou null (« - », vide). */
export function currencyCode(code: string | null | undefined): string | null {
  const c = (code ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

// ——— Compositions : état, résumé, équivalents ———

export type CompositionIssuer = "amundi" | "ishares";
export type Replication = "physique" | "synthetique";

/**
 * État d'une composition, sans ses lignes.
 * - ok : composition disponible (une mise à jour a pu échouer depuis, voir `message`) ;
 * - pending : pas encore téléchargée ;
 * - unknown : ni Amundi ni iShares ne connaissent cet ISIN ;
 * - failed : le téléchargement a échoué et aucune composition n'est connue.
 */
export interface CompositionInfo {
  isin: string;
  state: "ok" | "pending" | "unknown" | "failed";
  issuer: CompositionIssuer | null;
  fundName: string | null;
  replication: Replication | null;
  asOf: string | null;
  lineCount: number;
  checkedAt: string | null;
  fetchedAt: string | null;
  message: string | null;
}

/** Ligne gardée dans un résumé : les plus grosses positions du fonds. */
export type TopHolding = Pick<EtfHolding, "name" | "isin" | "ticker" | "weight" | "kind" | "sector" | "country">;

/**
 * Composition résumée, en fractions de l'actif du fonds (chaque répartition fait 1).
 * Clé vide : lignes sans pays, sans secteur ou sans devise (liquidités, contrats à terme…).
 */
export interface CompositionSummary {
  lineCount: number;
  kinds: Partial<Record<HoldingKind, number>>;
  countries: Record<string, number>;
  sectors: Record<string, number>;
  currencies: Record<string, number>;
  /** Plus grosses lignes d'actions et d'obligations, par poids décroissant. */
  top: TopHolding[];
}

/**
 * Résumé d'une composition. Les poids sont ramenés à leur total : un fonds publie souvent 99,8 % ou 100,3 %,
 * avec des liquidités négatives en attente de règlement.
 */
export function summarizeComposition(lines: readonly EtfHolding[], topCount = 30): CompositionSummary {
  const total = lines.reduce((s, l) => s + l.weight, 0);
  const scale = total > 0 ? 1 / total : 0;
  const kinds: CompositionSummary["kinds"] = {};
  const countries: Record<string, number> = {};
  const sectors: Record<string, number> = {};
  const currencies: Record<string, number> = {};
  const add = (map: Record<string, number>, key: string | null, w: number) => {
    map[key ?? ""] = (map[key ?? ""] ?? 0) + w;
  };
  for (const l of lines) {
    const w = l.weight * scale;
    kinds[l.kind] = (kinds[l.kind] ?? 0) + w;
    add(countries, l.country, w);
    add(sectors, l.sector, w);
    add(currencies, l.currency, w);
  }
  const top = lines
    .filter((l) => (l.kind === "action" || l.kind === "obligation") && l.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topCount)
    .map((l): TopHolding => ({ name: l.name, isin: l.isin, ticker: l.ticker, weight: l.weight * scale, kind: l.kind, sector: l.sector, country: l.country }));
  return { lineCount: lines.length, kinds, countries, sectors, currencies, top };
}

/** ETF physique proposé comme équivalent pour un indice. */
export interface EquivalentReference {
  index: string;
  pattern: RegExp;
  isin: string;
  name: string;
}

/**
 * ETF physiques de référence, un par grand indice, proposés comme équivalents d'un ETF synthétique ou d'un émetteur non géré.
 * Chacun a été vérifié le 12 novembre 2026 : physique d'après son émetteur, composition récupérable.
 * Les plus précis d'abord (« MSCI World Small Cap » avant « MSCI World »).
 */
export const EQUIVALENT_REFERENCES: readonly EquivalentReference[] = [
  { index: "MSCI World Small Cap", pattern: /world small[- ]?cap/i, isin: "IE00BF4RFH31", name: "iShares MSCI World Small Cap UCITS ETF" },
  { index: "MSCI World SRI", pattern: /world sri\b/i, isin: "IE00BYX2JD69", name: "iShares MSCI World SRI UCITS ETF" },
  { index: "MSCI ACWI", pattern: /\bacwi\b|all[- ]country|all[- ]world/i, isin: "IE00B6R52259", name: "iShares MSCI ACWI UCITS ETF" },
  { index: "MSCI World", pattern: /msci world|\bmonde\b|\bworld\b/i, isin: "IE00B4L5Y983", name: "iShares Core MSCI World UCITS ETF" },
  { index: "S&P 500", pattern: /s&p ?500|\bsp ?500\b/i, isin: "IE00B5BMR087", name: "iShares Core S&P 500 UCITS ETF" },
  { index: "Nasdaq-100", pattern: /nasdaq/i, isin: "IE00B53SZB19", name: "iShares Nasdaq 100 UCITS ETF" },
  { index: "MSCI Emerging Markets IMI", pattern: /(emerging|emergent|\bem\b).*\bimi\b/i, isin: "IE00BKM4GZ66", name: "iShares Core MSCI EM IMI UCITS ETF" },
  { index: "MSCI Emerging Markets", pattern: /emerging|[ée]mergent|\bmsci em\b/i, isin: "IE00B4L5YC18", name: "iShares MSCI EM UCITS ETF" },
  { index: "MSCI USA", pattern: /msci usa/i, isin: "IE00B52SFT06", name: "iShares MSCI USA UCITS ETF" },
  { index: "Stoxx Europe 600", pattern: /stoxx (europe )?600/i, isin: "LU0908500753", name: "Amundi Core Stoxx Europe 600 UCITS ETF" },
  { index: "Euro Stoxx 50", pattern: /euro ?stoxx 50/i, isin: "IE0008471009", name: "iShares Core EURO STOXX 50 UCITS ETF" },
  { index: "MSCI EMU", pattern: /msci emu|zone euro|eurozone/i, isin: "IE00B53QG562", name: "iShares Core MSCI EMU UCITS ETF" },
  { index: "MSCI Europe", pattern: /msci europe|\beurope\b/i, isin: "IE00B4K48X80", name: "iShares Core MSCI Europe UCITS ETF" },
  { index: "MSCI Pacific ex Japan", pattern: /pacific ex[- ]?japan|pacifique hors japon/i, isin: "IE00B52MJY50", name: "iShares Core MSCI Pacific ex-Japan UCITS ETF" },
  { index: "MSCI Japan", pattern: /japan|japon|topix|nikkei/i, isin: "IE00B4L5YX21", name: "iShares Core MSCI Japan IMI UCITS ETF" },
  { index: "CAC 40", pattern: /cac ?40/i, isin: "FR0007052782", name: "Amundi CAC 40 UCITS ETF" },
  { index: "DAX", pattern: /\bdax\b/i, isin: "DE0005933931", name: "iShares Core DAX UCITS ETF" },
  { index: "MSCI China", pattern: /china|chine/i, isin: "IE00BJ5JPG56", name: "iShares MSCI China UCITS ETF" },
  { index: "MSCI India", pattern: /india|\binde\b/i, isin: "IE00BZCQB185", name: "iShares MSCI India UCITS ETF" },
];

/** Équivalent proposé d'après les noms connus de l'ETF (nom chez l'émetteur, nom saisi) ; jamais l'ETF lui-même. */
export function suggestEquivalent(names: ReadonlyArray<string | null | undefined>, excludeIsin?: string | null): EquivalentReference | null {
  for (const name of names) {
    if (!name) continue;
    const found = EQUIVALENT_REFERENCES.find((r) => r.pattern.test(name));
    if (found) return found.isin === excludeIsin ? null : found;
  }
  return null;
}

/** D'où vient la composition utilisée pour un ETF. */
export type CompositionOrigin = "own" | "choice" | "link";

/**
 * Pourquoi aucune composition ne sert encore :
 * pas encore téléchargée, ETF synthétique sans équivalent, émetteur non géré, échec,
 * ou équivalent dont la composition n'est pas encore là ou n'a pas pu être récupérée.
 */
export type CompositionGap = "pending" | "synthetic" | "unknown" | "failed" | "equivalent-pending" | "equivalent-failed";

/** La composition d'un ETF peut servir telle quelle : connue, et pas celle d'un ETF synthétique. */
export const usableComposition = (info: CompositionInfo): boolean => info.state === "ok" && info.replication !== "synthetique";

/**
 * Composition qui sert pour un ETF. Dans l'ordre : l'équivalent choisi par l'utilisateur, la composition de l'ETF
 * s'il est physique, puis l'équivalent commun de l'instance. Un ETF synthétique ne sert jamais par lui-même :
 * il publie le panier qu'il détient, pas l'exposition qu'il donne.
 */
export function resolveComposition(
  own: CompositionInfo,
  choice: CompositionInfo | null,
  link: CompositionInfo | null,
): { used: { origin: CompositionOrigin; info: CompositionInfo } | null; gap: CompositionGap | null } {
  const viaEquivalent = (origin: CompositionOrigin, info: CompositionInfo) =>
    info.state === "ok" ? { used: { origin, info }, gap: null } : { used: null, gap: (info.state === "pending" ? "equivalent-pending" : "equivalent-failed") as CompositionGap };
  if (choice) return viaEquivalent("choice", choice);
  if (usableComposition(own)) return { used: { origin: "own", info: own }, gap: null };
  if (link) return viaEquivalent("link", link);
  if (own.state === "ok") return { used: null, gap: "synthetic" };
  return { used: null, gap: own.state };
}

// ——— Exposition du portefeuille ———

export interface ExposureItem {
  key: string;
  value: number;
  /** Part de la valeur dont la composition est connue. */
  share: number;
}

export interface ExposureLine {
  key: string;
  name: string;
  isin: string | null;
  value: number;
  share: number;
  /** Titres par lesquels on la détient : noms des ETF, ou « en direct ». */
  via: string[];
}

export interface ExposedAsset {
  assetId: string;
  name: string;
  kind: AssetKind;
  value: number;
  /** Composition connue (ETF), ou action détenue en direct. */
  covered: boolean;
}

export interface PortfolioExposure {
  /** Actions et ETF, pour la part détenue des comptes joints. */
  total: number;
  /** Dont la composition est connue. */
  covered: number;
  assets: ExposedAsset[];
  countries: ExposureItem[];
  sectors: ExposureItem[];
  currencies: ExposureItem[];
  kinds: ExposureItem[];
  /** Plus grosses lignes, tous titres confondus. */
  top: ExposureLine[];
}

/** Préfixes d'ISIN qui ne sont pas des pays (titres internationaux, zone euro). */
const NOT_COUNTRIES = new Set(["XS", "EU", "XA", "XB", "XC", "XD", "QS", "QT"]);

/** Pays d'une action détenue en direct : celui de son ISIN, c'est-à-dire où elle est enregistrée. */
export function isinCountry(isin: string | null): string | null {
  const p = isin?.slice(0, 2).toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(p) && !NOT_COUNTRIES.has(p) ? p : null;
}

const lineKey = (isin: string | null, name: string) => (isin ? `isin:${isin}` : `nom:${name.trim().toLocaleLowerCase("fr-FR").replace(/\s+/g, " ")}`);

/**
 * Ce que contiennent vraiment les actions et ETF du portefeuille : pays, secteurs, devises, types de ligne
 * et plus grosses lignes. Un ETF compte selon la composition qui sert pour lui (`summaries`, par identifiant de titre) ;
 * sans composition, il est compté à part. Une action détenue en direct compte pour le pays de son ISIN.
 * Les lignes d'un ETF iShares n'ont pas d'ISIN : elles ne se regroupent avec celles d'un autre émetteur que par le nom.
 */
export function portfolioExposure(state: PortfolioState, summaries: ReadonlyMap<string, CompositionSummary>, topCount = 15): PortfolioExposure {
  const byAsset = new Map<string, { name: string; kind: AssetKind; isin: string | null; value: number }>();
  for (const a of state.accounts) {
    const held = a.account.share ?? 1;
    for (const p of a.positions) {
      if (p.asset.kind !== "etf" && p.asset.kind !== "action") continue;
      const e = byAsset.get(p.asset.id) ?? { name: p.asset.name, kind: p.asset.kind, isin: p.asset.isin, value: 0 };
      e.value += p.value * held;
      byAsset.set(p.asset.id, e);
    }
  }
  const countries = new Map<string, number>();
  const sectors = new Map<string, number>();
  const currencies = new Map<string, number>();
  const kinds = new Map<string, number>();
  const lines = new Map<string, { name: string; isin: string | null; value: number; via: Set<string> }>();
  const add = (map: Map<string, number>, key: string, v: number) => map.set(key, (map.get(key) ?? 0) + v);
  const addLine = (isin: string | null, name: string, v: number, via: string) => {
    const k = lineKey(isin, name);
    const l = lines.get(k) ?? { name, isin, value: 0, via: new Set<string>() };
    l.value += v;
    l.via.add(via);
    lines.set(k, l);
  };

  const assets: ExposedAsset[] = [];
  let total = 0;
  let covered = 0;
  for (const [assetId, e] of byAsset) {
    if (e.value <= 0) continue;
    total += e.value;
    const summary = e.kind === "etf" ? summaries.get(assetId) : undefined;
    const isCovered = e.kind === "action" || !!summary;
    assets.push({ assetId, name: e.name, kind: e.kind, value: roundCents(e.value), covered: isCovered });
    if (!isCovered) continue;
    covered += e.value;
    if (!summary) {
      add(countries, isinCountry(e.isin) ?? "", e.value);
      add(sectors, "", e.value);
      add(currencies, "", e.value);
      add(kinds, "action", e.value);
      addLine(e.isin, e.name, e.value, "en direct");
      continue;
    }
    for (const [k, w] of Object.entries(summary.countries)) add(countries, k, e.value * w);
    for (const [k, w] of Object.entries(summary.sectors)) add(sectors, k, e.value * w);
    for (const [k, w] of Object.entries(summary.currencies)) add(currencies, k, e.value * w);
    for (const [k, w] of Object.entries(summary.kinds)) add(kinds, k, e.value * (w ?? 0));
    for (const t of summary.top) addLine(t.isin, t.name, e.value * t.weight, e.name);
  }

  const items = (map: Map<string, number>): ExposureItem[] =>
    [...map.entries()]
      .filter(([, v]) => Math.abs(v) >= 0.005)
      .map(([key, v]) => ({ key, value: roundCents(v), share: covered > 0 ? v / covered : 0 }))
      .sort((x, y) => y.value - x.value);
  const top = [...lines.entries()]
    .map(([key, l]): ExposureLine => ({ key, name: l.name, isin: l.isin, value: roundCents(l.value), share: covered > 0 ? l.value / covered : 0, via: [...l.via] }))
    .sort((x, y) => y.value - x.value)
    .slice(0, topCount);
  return {
    total: roundCents(total),
    covered: roundCents(covered),
    assets: assets.sort((x, y) => y.value - x.value),
    countries: items(countries),
    sectors: items(sectors),
    currencies: items(currencies),
    kinds: items(kinds),
    top,
  };
}
