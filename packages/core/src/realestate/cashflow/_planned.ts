import { addMonths, roundCents } from "../../base";
import { loanSchedule } from "../../loans";
import { expenseDates, recoverableAmount, type ExpenseCategory, type PropertyExpense } from "../expenses";
import { leaseEnd, leaseRentAt } from "../leases";
import { lotIsActive } from "../lots";
import type { Provision } from "../realestate";
import type { RentalData } from "../rental";
import { lotPotentialRent } from "../rentalPark";
import { EXPENSE_KEYS, provisionMonthly, zeroAmounts, type Amounts } from "./_shared";

export interface CashflowAssumptions {
  vacancy: Provision;
  works: Provision;
  /** Taxe foncière estimée, en mois de loyer hors charges. */
  propertyTaxMonths: number;
}

export interface PlannedCashflow {
  /** Par mois, à la part détenue (crédits : part à charge). */
  monthly: Amounts;
  /** Loyer et provisions de charges en cours, par mois, bien entier. */
  rent: number;
  chargeProvisions: number;
  /** Charges récupérables prévues, par mois, bien entier : à comparer aux provisions pour la régularisation. */
  recoverable: number;
  /** Taxe foncière estimée faute d'avis saisi. */
  propertyTaxEstimated: boolean;
}

/** Ce qui se paie par an pour une catégorie : ses dépenses annuelles en cours, sinon ce qui a été payé sur les 12 derniers mois. */
function yearlyExpenses(expenses: readonly PropertyExpense[], category: ExpenseCategory, today: string): { amount: number; recoverable: number } {
  const own = expenses.filter((e) => e.category === category && !e.improvement);
  const year = Number(today.slice(0, 4));
  const recurring = own.filter((e) => e.yearly && (e.untilYear == null || e.untilYear >= year));
  const since = addMonths(today, -12);
  const counted = recurring.length
    ? recurring.map((e) => ({ e, times: 1 }))
    : own.map((e) => ({ e, times: expenseDates(e, today).filter((d) => d > since).length }));
  return {
    amount: counted.reduce((s, { e, times }) => s + e.amount * times, 0),
    recoverable: counted.reduce((s, { e, times }) => s + recoverableAmount(e) * times, 0),
  };
}

/**
 * Cashflow prévu pour un mois type, d'après la situation d'aujourd'hui : loyer en cours de chaque lot proposé à la
 * location (loyer espéré d'un lot vide), dépenses annuelles, provisions pour vacance et travaux, échéance du crédit.
 * Les charges récupérables sont supposées régularisées exactement : le locataire en rembourse la totalité.
 */
export function plannedCashflow(data: RentalData, assumptions: CashflowAssumptions, today: string): PlannedCashflow {
  const { property } = data;
  const month = today.slice(0, 7);
  const leases = data.leases.filter((l) => l.propertyId === property.id);
  const running = leases.filter((l) => l.startDate <= today && (leaseEnd(l) ?? today) >= today);
  const lots = (data.lots ?? []).filter((l) => l.propertyId === property.id);
  let rent = 0;
  let chargeProvisions = 0;
  if (lots.length === 0) {
    for (const l of running) {
      const r = leaseRentAt(l, data.rents, month);
      rent += r.rent;
      chargeProvisions += r.charges;
    }
  } else {
    for (const lot of lots) {
      const current = running.filter((l) => l.lotId === lot.id);
      if (current.length) {
        for (const l of current) {
          const r = leaseRentAt(l, data.rents, month);
          rent += r.rent;
          chargeProvisions += r.charges;
        }
      } else if (lotIsActive(lot, property.rentalMode)) rent += lotPotentialRent(lot, leases, data.rents) ?? 0;
    }
  }

  const m = zeroAmounts();
  const expenses = data.expenses.filter((e) => e.propertyId === property.id);
  let recoverable = 0;
  let propertyTaxEstimated = false;
  for (const key of EXPENSE_KEYS) {
    if (key === "travaux") continue;
    const y = yearlyExpenses(expenses, key, today);
    if (key === "taxe_fonciere" && y.amount === 0) {
      propertyTaxEstimated = rent > 0;
      m.taxe_fonciere = -rent * assumptions.propertyTaxMonths / 12;
      continue;
    }
    m[key] = -y.amount / 12;
    recoverable += y.recoverable / 12;
  }
  m.rents = rent;
  m.vacancy = -provisionMonthly(assumptions.vacancy, rent);
  m.travaux = -provisionMonthly(assumptions.works, rent);
  m.recovered = recoverable;
  for (const key of Object.keys(m) as Array<keyof Amounts>) m[key] *= property.share;
  for (const loan of data.loans) {
    if (loan.propertyId !== property.id || loan.archived) continue;
    const next = loanSchedule(loan).find((s) => s.date > today);
    if (next) m.loans -= (next.payment + next.insurance) * loan.share;
  }
  for (const key of Object.keys(m) as Array<keyof Amounts>) m[key] = roundCents(m[key]) || 0;
  return { monthly: m, rent: roundCents(rent), chargeProvisions: roundCents(chargeProvisions), recoverable: roundCents(recoverable), propertyTaxEstimated };
}
