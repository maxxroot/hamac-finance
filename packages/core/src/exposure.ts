/**
 * Exposition réelle derrière les ETF : lignes d'une composition, harmonisées d'un émetteur à l'autre.
 * Les émetteurs écrivent les pays en anglais (« United States », « UAE ») et n'ont pas tous la même liste de secteurs :
 * les actions suivent les secteurs GICS, les obligations iShares une classification d'émetteurs (« Banking », « Electric »…).
 * Tout est ramené ici à un code pays ISO 3166-1 et à une liste fixe de secteurs, pour additionner des ETF de deux émetteurs.
 */

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
