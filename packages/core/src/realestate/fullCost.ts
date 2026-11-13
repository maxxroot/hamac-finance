import { roundCents } from "../base";
import { loanSchedule } from "../loans";
import { CASHFLOW_KEYS, type PropertyCashflow } from "./cashflow";
import { propertyImprovements } from "./expenses";
import { propertyTotalCost } from "./realestate";
import type { RentalData } from "./rental";

/** Coût de revient d'un bien, à la part détenue (crédits : part à charge) : l'achat, les améliorations et le coût du crédit. */
export interface PropertyFullCost {
  /** Coût d'achat complet (prix et frais) ; null sans prix d'achat. */
  purchase: number | null;
  improvements: number;
  /** Intérêts et assurance du crédit déjà payés (indemnités de remboursement anticipé comprises), puis encore à payer. */
  loanCostPaid: number;
  loanCostLeft: number;
  /** Achat + améliorations + coût du crédit payé ; puis en ajoutant ce qui reste à payer jusqu'à la fin des crédits. */
  toDate: number | null;
  total: number | null;
  /** Rendements d'une année type d'après le cashflow prévu : loyers, puis loyers moins charges et provisions (sans le crédit). */
  yields: { onPurchase: Yields; onTotal: Yields };
}

/** Brut (loyers), net de charges et provisions, puis net après l'impôt estimé sur les loyers. */
export interface Yields {
  gross: number | null;
  net: number | null;
  afterTax: number | null;
}

const ratio = (a: number, b: number | null) => (b == null || b <= 0 ? null : a / b);

export function propertyFullCost(data: RentalData, cashflow: PropertyCashflow, today: string): PropertyFullCost {
  const { property } = data;
  const until = property.saleDate != null && property.saleDate < today ? property.saleDate : today;
  const sold = until !== today;
  const cost = propertyTotalCost(property);
  const purchase = cost == null ? null : roundCents(cost * property.share);
  const improvements = roundCents(propertyImprovements(data.expenses, property.id, until) * property.share);
  let paid = 0;
  let left = 0;
  for (const loan of data.loans) {
    if (loan.propertyId !== property.id) continue;
    for (const s of loanSchedule(loan)) {
      const amount = (s.interest + s.insurance) * loan.share;
      if (s.date <= until) paid += amount;
      else if (!sold && !loan.archived) left += amount;
    }
  }
  const loanCostPaid = roundCents(paid);
  const loanCostLeft = roundCents(left);
  const toDate = purchase == null ? null : roundCents(purchase + improvements + loanCostPaid);
  const total = toDate == null ? null : roundCents(toDate + loanCostLeft);
  const rents = cashflow.planned.monthly.rents * 12;
  const beforeLoans = CASHFLOW_KEYS.filter((k) => k !== "loans" && k !== "taxes").reduce((s, k) => s + cashflow.planned.monthly[k], 0) * 12;
  const afterTax = beforeLoans + cashflow.planned.monthly.taxes * 12;
  const base = purchase == null ? null : purchase + improvements;
  return {
    purchase,
    improvements,
    loanCostPaid,
    loanCostLeft,
    toDate,
    total,
    yields: {
      onPurchase: { gross: ratio(rents, base), net: ratio(beforeLoans, base), afterTax: ratio(afterTax, base) },
      onTotal: { gross: ratio(rents, total), net: ratio(beforeLoans, total), afterTax: ratio(afterTax, total) },
    },
  };
}
