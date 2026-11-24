import { roundCents, type FxBook } from "@hamac/core";

/**
 * Saisie d'une opération sur un titre en devise. Les montants enregistrés restent en euros ; la personne peut taper
 * le total en euros ou dans la devise du titre (le dernier champ tapé l'emporte), et le taux de change se pré-remplit
 * avec celui de la BCE du jour de l'opération, à remplacer au besoin par celui de l'avis d'opéré.
 */
export interface FxDraft {
  /** Taux saisi à la main (unités de la devise pour 1 €) ; ignoré tant que `fxManual` est faux. */
  fxRate: number | null;
  fxManual: boolean;
  /** Total tapé dans la devise du titre, quand c'est lui qui a été saisi. */
  amountFx: number | null;
  /** Le total a été tapé en euros ou dans la devise : l'autre s'en déduit. */
  fxBasis: "eur" | "fx";
}

export const NO_FX: FxDraft = { fxRate: null, fxManual: false, amountFx: null, fxBasis: "eur" };

export interface EcbRate {
  rate: number;
  date: string;
}

/** Taux de référence de la BCE applicable à une date (celui de la veille ouvrée un jour sans publication). */
export function ecbRateOn(book: FxBook, currency: string, date: string): EcbRate | null {
  const p = book.point(currency, date);
  return p ? { rate: p.rate, date: p.date } : null;
}

/** Taux retenu pour les calculs du formulaire : la saisie, sinon la BCE ; null si aucun n'est connu. */
export function rateInUse(d: FxDraft, ecb: EcbRate | null): number | null {
  return d.fxManual && d.fxRate && d.fxRate > 0 ? d.fxRate : (ecb?.rate ?? null);
}

export const eurFromFx = (value: number, rate: number): number => roundCents(value / rate);
export const fxFromEur = (value: number, rate: number): number => roundCents(value * rate);

/**
 * Taux enregistré avec l'opération. Total tapé en devise : le taux effectif (devise ÷ euros), pour retrouver au centime
 * le montant de l'avis. Taux saisi : celui-là. Sinon null : le moteur reprend le taux de la BCE du jour.
 */
export function rateToStore(d: FxDraft, amountEur: number | null, rate: number | null): number | null {
  if (d.fxBasis === "fx" && d.amountFx && amountEur && amountEur > 0) return d.amountFx / amountEur;
  return d.fxManual && rate ? rate : null;
}

/** Brouillon d'une opération existante : un taux enregistré est une saisie. */
export function fxDraftOf(fxRate: number | null | undefined): FxDraft {
  return { ...NO_FX, fxRate: fxRate ?? null, fxManual: fxRate != null };
}
