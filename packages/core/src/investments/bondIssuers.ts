import type { Asset, BondKind } from "../model";

/**
 * Émetteur d'une obligation : un État (avec son pays) ou une entreprise.
 * Le pays d'une obligation d'État compte pour son nom (OAT, OLO…), son jour d'échéance et sa répartition par émetteur.
 */

/** Les 193 États membres de l'ONU (ISO 3166-1 alpha-2) : émetteurs possibles d'une obligation d'État. */
export const SOVEREIGN_COUNTRIES = [
  "AF", "AL", "DZ", "AD", "AO", "AG", "AR", "AM", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BT",
  "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "CF", "TD", "CL", "CN", "CO", "KM", "CG", "CD",
  "CR", "CI", "HR", "CU", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FJ", "FI",
  "FR", "GA", "GM", "GE", "DE", "GH", "GR", "GD", "GT", "GN", "GW", "GY", "HT", "HN", "HU", "IS", "IN", "ID", "IR", "IQ",
  "IE", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI",
  "LT", "LU", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MR", "MU", "MX", "FM", "MD", "MC", "MN", "ME", "MA", "MZ", "MM",
  "NA", "NR", "NP", "NL", "NZ", "NI", "NE", "NG", "MK", "NO", "OM", "PK", "PW", "PA", "PG", "PY", "PE", "PH", "PL", "PT",
  "QA", "RO", "RU", "RW", "KN", "LC", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SB", "SO",
  "ZA", "SS", "ES", "LK", "SD", "SR", "SE", "CH", "SY", "TJ", "TZ", "TH", "TL", "TG", "TO", "TT", "TN", "TR", "TM", "TV",
  "UG", "UA", "AE", "GB", "US", "UY", "UZ", "VU", "VE", "VN", "YE", "ZM", "ZW",
] as const;

const SOVEREIGNS = new Set<string>(SOVEREIGN_COUNTRIES);

/** Pays des fiches d'obligation d'État créées avant le choix du pays : elles étaient toutes françaises. */
export const DEFAULT_SOVEREIGN = "FR";

export const isSovereignCountry = (code: string | null | undefined): code is string => !!code && SOVEREIGNS.has(code);

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" });
  } catch {
    return null;
  }
})();

/** Nom du pays en français (« BE » → « Belgique ») ; le code s'il est inconnu. */
export function countryName(code: string): string {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Pays d'après l'ISIN, s'il désigne un État : la dette d'un État porte le code de son pays (XS, EU… n'en sont pas). */
export function countryFromIsin(isin: string | null | undefined): string | null {
  const p = isin?.trim().slice(0, 2).toUpperCase() ?? "";
  return isSovereignCountry(p) ? p : null;
}

/** Type d'une obligation : celui de sa fiche ; sans type, d'État si l'émetteur est vide ou l'État français (fiches anciennes). */
export function bondKindOf(asset: Pick<Asset, "bondKind" | "issuer">): BondKind {
  if (asset.bondKind) return asset.bondKind;
  return !asset.issuer || /r[ée]publique fran[cç]aise|france/i.test(asset.issuer) ? "etat" : "entreprise";
}

/** Pays d'une obligation d'État (null pour une obligation d'entreprise). */
export function sovereignCountry(asset: Pick<Asset, "bondKind" | "issuer" | "issuerCountry">): string | null {
  if (bondKindOf(asset) !== "etat") return null;
  return isSovereignCountry(asset.issuerCountry) ? asset.issuerCountry : DEFAULT_SOVEREIGN;
}

/** Une OAT : obligation de l'État français, remboursée le 25 du mois. */
export const isOat = (kind: BondKind | null, country: string | null | undefined): boolean => kind === "etat" && (country || DEFAULT_SOVEREIGN) === "FR";

/** Nom d'usage de la dette de quelques États de la zone euro ; ailleurs, le nom du pays. */
const SOVEREIGN_DEBT_NAMES: Record<string, string> = { FR: "OAT", BE: "OLO", DE: "Bund", IT: "BTP", ES: "Bono" };

export const sovereignDebtName = (code: string): string => SOVEREIGN_DEBT_NAMES[code] ?? countryName(code);

/** Libellé d'un État émetteur : « État · Belgique ». */
export const sovereignLabel = (code: string): string => `État · ${countryName(code)}`;
