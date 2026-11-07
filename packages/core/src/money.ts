/**
 * Montants : on calcule en nombres décimaux (euros) et on arrondit au centime
 * aux frontières (affichage, stockage). Les écarts d'arrondi binaires sont
 * neutralisés par `roundCents`.
 */

/** Arrondi bancaire classique au centime (demi vers l'infini), robuste aux erreurs binaires. */
export function roundCents(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value) * 100 + Number.EPSILON * 100) / 100;
}

/** Somme arrondie au centime. */
export function sum(values: readonly number[]): number {
  return roundCents(values.reduce((acc, v) => acc + v, 0));
}

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** 1234.5 → « 1 234,50 € ». `compact` retire les centimes. */
export function formatEur(value: number, opts: { compact?: boolean } = {}): string {
  return (opts.compact ? eur0 : eur).format(value);
}

/** 0.0345 → « 3,45 % ». */
export function formatPct(ratio: number): string {
  return pct.format(ratio);
}
