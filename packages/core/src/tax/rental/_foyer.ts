import { roundCents } from "../../base";
import { DEFICIT_GLOBAL_CAP, DEFICIT_YEARS, MICRO_BIC_ALLOWANCE, MICRO_FONCIER, microBicCeiling } from "./_rules";
import type { RentalRegime } from "./_kind";

/** Une année d'un bien, à la part détenue : ce qui compte pour l'impôt. */
export interface TaxRow {
  propertyId: string;
  receipts: number;
  /** Location vide : intérêts et assurance de l'emprunt, puis les autres charges déductibles. */
  interest: number;
  other: number;
  /** Location meublée : amortissement de l'année (au réel). */
  amortization: number;
}

/** Déficits reportés, par année d'origine. */
export type Carry = Array<{ year: number; amount: number }>;

export interface GroupYear {
  regime: RentalRegime;
  /** Le régime micro était demandé mais le plafond est dépassé : réel. */
  ceilingExceeded: boolean;
  receipts: number;
  taxable: number;
  /** Déficit foncier imputé sur le revenu global. */
  globalDeduction: number;
  amortizationUsed: number;
  incomeTax: number;
  social: number;
  /** Impôt de chaque bien : le total réparti selon le résultat de chacun. */
  byProperty: Map<string, number>;
}

const sum = (rows: readonly TaxRow[], pick: (r: TaxRow) => number) => rows.reduce((s, r) => s + pick(r), 0);

/** Utilise les déficits encore valables, les plus anciens d'abord ; retourne le montant imputé. */
function useCarry(carry: Carry, year: number, available: number): number {
  let used = 0;
  for (const c of carry.sort((a, b) => a.year - b.year)) {
    if (c.year < year - DEFICIT_YEARS || used >= available) continue;
    const take = Math.min(c.amount, available - used);
    c.amount -= take;
    used += take;
  }
  carry.splice(0, carry.length, ...carry.filter((c) => c.amount > 0.005 && c.year >= year - DEFICIT_YEARS));
  return used;
}

/** Répartit `total` entre les biens au prorata de leur résultat (un bien en déficit reçoit une part négative). */
function allocate(rows: readonly TaxRow[], result: (r: TaxRow) => number, total: number): Map<string, number> {
  const all = sum(rows, result);
  return new Map(rows.map((r) => [r.propertyId, all === 0 ? 0 : roundCents((total * result(r)) / all)]));
}

/** Location vide du foyer pour une année : micro-foncier ou réel avec déficit. `carry` est mis à jour. */
export function foncierYear(rows: readonly TaxRow[], wanted: RentalRegime, year: number, tmi: number, social: number, carry: Carry): GroupYear {
  const receipts = sum(rows, (r) => r.receipts);
  const ceilingExceeded = wanted === "micro" && receipts > MICRO_FONCIER.ceiling;
  if (wanted === "micro" && !ceilingExceeded) {
    const taxable = receipts * (1 - MICRO_FONCIER.allowance);
    const total = taxable * (tmi + social);
    return { regime: "micro", ceilingExceeded, receipts, taxable, globalDeduction: 0, amortizationUsed: 0, incomeTax: taxable * tmi, social: taxable * social, byProperty: allocate(rows, (r) => r.receipts, total) };
  }
  const interest = sum(rows, (r) => r.interest);
  const other = sum(rows, (r) => r.other);
  const result = receipts - interest - other;
  const resultOf = (r: TaxRow) => r.receipts - r.interest - r.other;
  if (result >= 0) {
    const taxable = result - useCarry(carry, year, result);
    const total = taxable * (tmi + social);
    return { regime: "reel", ceilingExceeded, receipts, taxable, globalDeduction: 0, amortizationUsed: 0, incomeTax: taxable * tmi, social: taxable * social, byProperty: allocate(rows, resultOf, total) };
  }
  // Déficit : la part due aux intérêts ne s'impute que sur les revenus fonciers ; le reste, sur le revenu global jusqu'au plafond.
  const afterInterest = receipts - interest;
  const fromOther = afterInterest >= 0 ? -result : other;
  const globalDeduction = Math.min(fromOther, DEFICIT_GLOBAL_CAP);
  const carried = -result - globalDeduction;
  if (carried > 0) carry.push({ year, amount: carried });
  const total = -globalDeduction * tmi;
  return { regime: "reel", ceilingExceeded, receipts, taxable: 0, globalDeduction, amortizationUsed: 0, incomeTax: total, social: 0, byProperty: allocate(rows, resultOf, total) };
}

/** Location meublée du foyer pour une année : micro-BIC, ou réel avec amortissements et déficits reportés. */
export function lmnpYear(rows: readonly TaxRow[], wanted: RentalRegime, year: number, tmi: number, social: number, state: { carry: Carry; amortization: number }): GroupYear {
  const receipts = sum(rows, (r) => r.receipts);
  const ceilingExceeded = wanted === "micro" && receipts > microBicCeiling(year);
  if (wanted === "micro" && !ceilingExceeded) {
    const taxable = receipts * (1 - MICRO_BIC_ALLOWANCE);
    const total = taxable * (tmi + social);
    return { regime: "micro", ceilingExceeded, receipts, taxable, globalDeduction: 0, amortizationUsed: 0, incomeTax: taxable * tmi, social: taxable * social, byProperty: allocate(rows, (r) => r.receipts, total) };
  }
  const resultOf = (r: TaxRow) => r.receipts - r.other;
  const before = sum(rows, resultOf);
  const amortization = sum(rows, (r) => r.amortization) + state.amortization;
  if (before <= 0) {
    if (before < 0) state.carry.push({ year, amount: -before });
    state.amortization = amortization;
    return { regime: "reel", ceilingExceeded, receipts, taxable: 0, globalDeduction: 0, amortizationUsed: 0, incomeTax: 0, social: 0, byProperty: allocate(rows, resultOf, 0) };
  }
  // L'amortissement ne crée pas de déficit : il s'arrête au résultat, l'excédent se reporte.
  const amortizationUsed = Math.min(amortization, before);
  state.amortization = amortization - amortizationUsed;
  const net = before - amortizationUsed;
  const taxable = net - useCarry(state.carry, year, net);
  const total = taxable * (tmi + social);
  return { regime: "reel", ceilingExceeded, receipts, taxable, globalDeduction: 0, amortizationUsed, incomeTax: taxable * tmi, social: taxable * social, byProperty: allocate(rows, resultOf, total) };
}
