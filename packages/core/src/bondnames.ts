import type { Asset, BondKind } from "./domain";

const pct = (r: number) => `${(Math.round(r * 100_000) / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} %`;
const frDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Nom lisible d'une obligation : « OAT 3 % 25/05/2033 » ou « TotalEnergies 1,491 % 08/04/2027 ». */
export function bondName(kind: BondKind | null, issuer: string | null, couponRate: number | null, maturityDate: string | null): string {
  const head = kind === "etat" && (!issuer || /r[ée]publique fran[cç]aise|france/i.test(issuer)) ? "OAT" : issuer?.trim() || "Obligation";
  return [head, couponRate != null ? pct(couponRate) : null, maturityDate ? frDate(maturityDate) : null].filter(Boolean).join(" ");
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
