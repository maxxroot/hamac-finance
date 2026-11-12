import { roundCents } from "../base";
import { loanCost, type LoanCost } from "../loans";
import type { PlanParams } from "../model";
import type { PortfolioState } from "../portfolio";
import { propertyValue, type Property } from "../realestate";

/**
 * Poids des crédits dans le patrimoine : part financée à crédit, taux d'effort, endettement par bien.
 *
 * Taux d'effort : 35 % des revenus nets au plus, assurance comprise, pour un nouveau crédit immobilier
 * (Haut Conseil de stabilité financière, décision du 29 septembre 2021 ; vérifié le 11 novembre 2026,
 * source secondaire, texte officiel à relire). Sources affichées : DEBT_SOURCES (loans/debt.ts).
 */

export const MAX_EFFORT_RATE = 0.35;

export interface DebtOverview {
  /** Tout ce qui est détenu, avant dettes. */
  assets: number;
  debts: number;
  /** Part du patrimoine financée à crédit. */
  debtRatio: number | null;
  monthly: number;
  income: number | null;
  /** Mensualités / revenus nets. */
  effortRate: number | null;
  properties: Array<{ property: Property; value: number; debt: number; ratio: number | null }>;
  loans: LoanCost[];
}

/** Indicateurs d'endettement, à partir de l'état du patrimoine (parts de SCI déjà appliquées). */
export function debtOverview(state: PortfolioState, properties: readonly Property[], params: Pick<PlanParams, "profile">): DebtOverview {
  const nw = state.netWorth;
  const assets = roundCents(nw.financial + nw.realEstate + nw.otherAssets);
  const income = params.profile.netMonthlyIncome > 0 ? params.profile.netMonthlyIncome : null;
  const active = nw.loans.filter((l) => l.paymentsLeft > 0);
  return {
    assets,
    debts: nw.debts,
    debtRatio: assets > 0 ? nw.debts / assets : null,
    monthly: nw.monthlyLoans,
    income,
    effortRate: income ? nw.monthlyLoans / income : null,
    properties: properties
      .filter((p) => !p.archived)
      .map((p) => {
        const value = propertyValue(p, state.asOf);
        const debt = roundCents(active.filter((l) => l.loan.propertyId === p.id).reduce((s, l) => s + l.heldBalance, 0));
        return { property: p, value, debt, ratio: value > 0 ? debt / value : null };
      })
      .filter((x) => x.debt > 0),
    loans: active.map((l) => loanCost(l.loan, state.asOf)),
  };
}
