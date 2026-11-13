import { loanSchedule } from "../../loans";
import type { PlanParams } from "../../model";
import type { PropertyCashflow, RentalData } from "../../realestate";
import { projectedTax, yearAmortization, type RentalRegime, type RentalTaxKind, type TaxCarry } from "../../tax";

export interface ProjectionYear {
  year: number;
  /** Loyers hors charges, vacance déduite. */
  rents: number;
  /** Charges restant au propriétaire et provision pour travaux (négatif). */
  charges: number;
  /** Échéances du crédit, assurance comprise (négatif). */
  loans: number;
  /** Impôt estimé sur les loyers (négatif ; positif quand un déficit le fait baisser). */
  tax: number;
  cashflow: number;
  /** Capital restant dû en fin d'année, valeur estimée du bien et valeur nette. */
  debt: number;
  value: number;
  netValue: number;
  /** Location meublée au réel : amortissement déduit cette année. */
  amortizationUsed: number;
}

export interface ProjectionContext {
  data: RentalData;
  cashflow: PropertyCashflow;
  params: PlanParams;
  kind: RentalTaxKind;
  regime: RentalRegime;
  carry: TaxCarry;
  /** Valeur détenue aujourd'hui. */
  heldValue: number;
  /** Frais comptables de ce bien, par an (meublé au réel). */
  accountingFees: number;
  today: string;
}

/**
 * Le bien année par année, de l'an prochain à `until` : le mois type du cashflow prévu ×12, loyers et provisions
 * augmentés de `rentGrowth`, charges de `chargesGrowth` ; le vrai échéancier du crédit ; l'impôt du bien seul avec
 * ses reports ; la valeur augmentée de `valueGrowth`. À la part détenue (crédits : part à charge).
 */
export function projectionYears(ctx: ProjectionContext, until: number): ProjectionYear[] {
  const { data, cashflow, params } = ctx;
  const { property } = data;
  const m = cashflow.planned.monthly;
  const thisYear = Number(ctx.today.slice(0, 4));
  const loans = data.loans.filter((l) => l.propertyId === property.id && !l.archived).map((l) => ({ loan: l, steps: loanSchedule(l) }));
  const out: ProjectionYear[] = [];
  for (let year = thisYear + 1; year <= until; year++) {
    const k = year - thisYear;
    const gr = Math.pow(1 + params.rental.rentGrowth, k);
    const gc = Math.pow(1 + params.rental.chargesGrowth, k);
    const rents = (m.rents + m.vacancy) * 12 * gr;
    const recovered = m.recovered * 12 * gc;
    const expenses = (m.taxe_fonciere + m.copropriete + m.assurance + m.gestion + m.autre) * 12 * gc;
    const works = m.travaux * 12 * gr;
    let paid = 0;
    let interest = 0;
    let debt = 0;
    for (const { loan, steps } of loans) {
      const inYear = steps.filter((s) => s.date.startsWith(`${year}-`));
      paid += inYear.reduce((s, x) => s + x.payment + x.insurance, 0) * loan.share;
      interest += inYear.reduce((s, x) => s + x.interest + x.insurance, 0) * loan.share;
      const last = steps.filter((s) => s.date <= `${year}-12-31`).at(-1);
      debt += (last ? last.balance : loan.principal) * loan.share;
    }
    const amortization = ctx.kind === "lmnp" && ctx.regime === "reel" ? yearAmortization(property, data.leases, data.expenses, params.rental.landShare, year, `${year}-12-31`) : 0;
    const row =
      ctx.kind === "foncier"
        ? { propertyId: property.id, receipts: rents, interest, other: -expenses - recovered - works + 20 * property.share, amortization: 0 }
        : { propertyId: property.id, receipts: rents + recovered, interest: 0, other: -expenses - works + interest + ctx.accountingFees, amortization };
    const tax = projectedTax(ctx.kind, ctx.regime, row, year, params, ctx.carry);
    const charges = recovered + expenses + works;
    const value = ctx.heldValue * Math.pow(1 + params.rental.valueGrowth, k);
    out.push({
      year,
      rents,
      charges,
      loans: -paid,
      tax: -tax.total,
      cashflow: rents + charges - paid - tax.total,
      debt,
      value,
      netValue: value - debt,
      amortizationUsed: tax.amortizationUsed,
    });
  }
  return out;
}

/** Dernière année du crédit du bien, au moins dix ans après aujourd'hui, au plus trente. */
export function defaultHorizon(data: RentalData, today: string): number {
  const thisYear = Number(today.slice(0, 4));
  const loanEnd = Math.max(0, ...data.loans.filter((l) => l.propertyId === data.property.id && !l.archived).map((l) => Number(loanSchedule(l).at(-1)?.date.slice(0, 4) ?? 0)));
  return Math.min(thisYear + 30, Math.max(thisYear + 10, loanEnd));
}
