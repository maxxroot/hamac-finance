import type { Asset, BondKind } from "../model";

const pct = (r: number) => `${(Math.round(r * 100_000) / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} %`;
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 2033-05-25 » → « mai 2033 » (les obligations s'annoncent par mois et année). */
export const maturityLabel = (iso: string) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;

/** Les OAT arrivent à échéance le 25 du mois (convention de l'Agence France Trésor). */
export const OAT_MATURITY_DAY = 25;

/**
 * Date d'échéance à partir du mois annoncé : le 25 pour une OAT ; pour une obligation d'entreprise,
 * le jour indiqué s'il est connu, sinon le 1er du mois (écart négligeable sur le rendement).
 */
export function maturityFromMonth(month: string, kind: BondKind | null, day?: number | null): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = kind === "etat" ? OAT_MATURITY_DAY : Math.min(Math.max(1, day ?? 1), last);
  return `${month}-${String(d).padStart(2, "0")}`;
}

/** Nom lisible d'une obligation : « OAT 3 % mai 2033 » ou « TotalEnergies 1,491 % avril 2027 ». */
export function bondName(kind: BondKind | null, issuer: string | null, couponRate: number | null, maturityDate: string | null): string {
  const head = kind === "etat" && (!issuer || /r[ée]publique fran[cç]aise|france/i.test(issuer)) ? "OAT" : issuer?.trim() || "Obligation";
  return [head, couponRate != null ? pct(couponRate) : null, maturityDate ? maturityLabel(maturityDate) : null].filter(Boolean).join(" ");
}

/** Obligation déjà connue avec le même coupon, la même échéance et le même émetteur (ou ISIN). */
export function findSameBond(
  assets: readonly Asset[],
  b: { isin: string | null; couponRate: number | null; maturityDate: string | null; issuer: string | null; bondKind: BondKind | null },
): Asset | null {
  const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
  return (
    assets.find((a) => a.kind === "obligation" && !a.archived && b.isin && a.isin === b.isin) ??
    assets.find(
      (a) =>
        a.kind === "obligation" &&
        !a.archived &&
        a.couponRate != null &&
        b.couponRate != null &&
        Math.abs(a.couponRate - b.couponRate) < 1e-9 &&
        a.maturityDate === b.maturityDate &&
        (b.bondKind === "etat" ? a.bondKind === "etat" || norm(a.issuer) === norm(b.issuer) : norm(a.issuer) === norm(b.issuer)),
    ) ??
    null
  );
}
