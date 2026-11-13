import { roundCents } from "../../base";
import type { PlanParams } from "../../model";
import type { Property } from "../realestate";
import type { RentalData } from "../rental";
import { plannedCashflow, type CashflowAssumptions, type PlannedCashflow } from "./_planned";
import { realCashflow, type RealCashflow } from "./_real";
import { CASHFLOW_KEYS, type Amounts, type CashflowKey } from "./_shared";

/**
 * Cashflow d'un bien en location : réel (12 derniers mois complets) et prévu (mois type d'aujourd'hui). L'impôt sur les
 * loyers, calculé plus haut (domaine tax), arrive en paramètre : celui de l'année de référence, divisé par 12.
 * Règles de calcul de l'utilisateur, pas de source légale : taxe foncière estimée à 1,3 mois de loyer hors charges
 * tant que l'avis n'est pas saisi ; provisions de 4 % du loyer pour la vacance et 5 % pour les travaux ; neutre
 * à ±2 % du loyer. Toutes réglables (Paramètres › Plan › Biens en location, et bien par bien pour les provisions).
 */

export { CASHFLOW_KEYS, CASHFLOW_LABELS, type CashflowKey } from "./_shared";
export type { CashflowAssumptions, PlannedCashflow } from "./_planned";
export type { RealCashflow } from "./_real";

export type CashflowTone = "positif" | "neutre" | "negatif";
export const CASHFLOW_TONE_LABELS: Record<CashflowTone, string> = { positif: "Positif", neutre: "Neutre", negatif: "Négatif" };

export interface CashflowLine {
  key: CashflowKey;
  /** Par mois ; null quand le poste n'existe pas de ce côté (vacance du réel, déjà dans les loyers). */
  real: number | null;
  planned: number;
}

export interface PropertyCashflow {
  real: (RealCashflow & { total: number; tone: CashflowTone }) | null;
  planned: PlannedCashflow & { total: number; tone: CashflowTone };
  /** Postes non nuls d'un côté ou de l'autre, dans l'ordre d'affichage. */
  lines: CashflowLine[];
  /** Écart à zéro en dessous duquel le cashflow est neutre, par mois, à la part détenue. */
  neutralBand: number;
  assumptions: CashflowAssumptions;
  /** Année de l'impôt retenu (dernière année complète, sinon la dernière connue) ; null sans impôt passé. */
  taxYear: number | null;
}

/** Provisions et taxe estimée d'un bien : les siennes, sinon celles des réglages. */
export function cashflowAssumptions(property: Pick<Property, "vacancyProvision" | "worksProvision">, rental: PlanParams["rental"]): CashflowAssumptions {
  return {
    vacancy: property.vacancyProvision ?? { kind: "taux", value: rental.vacancyRate },
    works: property.worksProvision ?? { kind: "taux", value: rental.worksRate },
    propertyTaxMonths: rental.propertyTaxMonths,
  };
}

export const cashflowTone = (monthly: number, band: number): CashflowTone => (monthly > band ? "positif" : monthly < -band ? "negatif" : "neutre");

const sum = (a: Amounts) => roundCents(CASHFLOW_KEYS.reduce((s, k) => s + a[k], 0));

/** `tax` : impôt annuel estimé du bien (négatif quand un déficit le fait baisser), et son année. */
export function propertyCashflow(data: RentalData, rental: PlanParams["rental"], today: string, tax: { year: number; yearly: number } | null = null): PropertyCashflow {
  const assumptions = cashflowAssumptions(data.property, rental);
  const planned = plannedCashflow(data, assumptions, today);
  const real = realCashflow(data, today);
  const monthlyTax = tax ? -roundCents(tax.yearly / 12) || 0 : 0;
  planned.monthly.taxes = monthlyTax;
  if (real) real.monthly.taxes = monthlyTax;
  const neutralBand = roundCents(planned.rent * data.property.share * rental.neutralBand);
  const plannedTotal = sum(planned.monthly);
  const realTotal = real ? sum(real.monthly) : 0;
  const lines = CASHFLOW_KEYS.map((key) => ({ key, real: key === "vacancy" ? null : (real?.monthly[key] ?? null), planned: planned.monthly[key] })).filter(
    (l) => l.planned !== 0 || (l.real != null && l.real !== 0),
  );
  return {
    real: real && { ...real, total: realTotal, tone: cashflowTone(realTotal, neutralBand) },
    planned: { ...planned, total: plannedTotal, tone: cashflowTone(plannedTotal, neutralBand) },
    lines,
    neutralBand,
    assumptions,
    taxYear: tax?.year ?? null,
  };
}
