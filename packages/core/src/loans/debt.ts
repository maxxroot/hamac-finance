import { addMonths, monthsBetween, roundCents } from "../base";
import type { PortfolioState } from "../portfolio";
import type { PlanParams } from "../model";
import { loanSchedule, loanState, propertyValue, type Loan, type LoanPrepaymentMode, type LoanScheduleStep, type Property } from "../realestate";

/**
 * Poids des crédits et aide à la décision « rembourser par avance ou placer ».
 *
 * Règles vérifiées le 11 novembre 2026 (sources secondaires, textes officiels à relire) :
 * - taux d'effort : 35 % des revenus nets au plus, assurance comprise, pour un nouveau crédit immobilier
 *   (Haut Conseil de stabilité financière, décision du 29 septembre 2021) ;
 * - indemnité de remboursement anticipé d'un crédit immobilier : au plus 6 mois d'intérêts sur la somme remboursée,
 *   au taux du prêt, et au plus 3 % du capital restant dû avant le remboursement (Code de la consommation, art. R313-25) ;
 * - crédit à la consommation : au plus 1 % de la somme remboursée s'il reste plus d'un an, 0,5 % sinon, et rien
 *   pour moins de 10 000 € remboursés sur douze mois (Code de la consommation, art. L312-34, à vérifier).
 */

export const MAX_EFFORT_RATE = 0.35;
export const DEBT_SOURCES: Array<{ label: string; url: string }> = [
  { label: "Remboursement anticipé d'un crédit immobilier (La finance pour tous)", url: "https://www.lafinancepourtous.com/pratique/credit/credit-immobilier/pret-immo-l-essentiel-a-savoir/le-remboursement-anticipe/" },
  { label: "Code de la consommation, art. R313-25 et L312-34", url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069565" },
];

export interface LoanCost {
  loan: Loan;
  /** Taux annuel qui égale le capital restant dû aux échéances restantes, assurance comprise. */
  rateWithInsurance: number | null;
  /** Intérêts et assurance encore à payer. */
  remainingInterest: number;
  remainingInsurance: number;
}

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

/** Taux mensuel i tel que la somme actualisée des paiements égale `present` (bissection). */
function impliedMonthlyRate(present: number, payments: readonly number[]): number | null {
  if (present <= 0 || payments.length === 0) return null;
  const pv = (i: number) => payments.reduce((s, p, k) => s + p / Math.pow(1 + i, k + 1), 0);
  if (pv(0) < present) return null;
  let lo = 0;
  let hi = 1;
  for (let n = 0; n < 100; n++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > present) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Coût restant d'un crédit à une date : taux assurance comprise, intérêts et assurance encore dus. */
export function loanCost(loan: Loan, date: string): LoanCost {
  const future = loanSchedule(loan).filter((s) => s.date > date);
  const balance = loanState(loan, date).balance;
  const monthlyRate = impliedMonthlyRate(balance, future.map((s) => s.payment + s.insurance));
  return {
    loan,
    rateWithInsurance: monthlyRate == null ? null : Math.round(monthlyRate * 12 * 1e5) / 1e5,
    remainingInterest: roundCents(future.reduce((t, s) => t + s.interest, 0) * loan.share),
    remainingInsurance: roundCents(future.reduce((t, s) => t + s.insurance, 0) * loan.share),
  };
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

// ——— Rembourser par avance ou placer ———

/** Indemnité maximale prévue par la loi ; null quand le type de crédit ne permet pas de la déterminer. */
export function maxPrepaymentFee(loan: Loan, amount: number, date: string): number | null {
  const state = loanState(loan, date);
  const paid = Math.min(amount, state.balance);
  if (paid <= 0) return 0;
  if (loan.kind === "immobilier" || loan.kind === "travaux") return roundCents(Math.min((paid * loan.rate) / 2, state.balance * 0.03));
  if (loan.kind === "consommation" || loan.kind === "auto") {
    const lastYear = loan.prepayments.filter((p) => p.date > addMonths(date, -12) && p.date <= date).reduce((s, p) => s + p.amount, 0);
    if (lastYear + paid <= 10_000) return 0;
    return roundCents(paid * (state.paymentsLeft > 12 ? 0.01 : 0.005));
  }
  return null;
}

export interface PrepaymentInput {
  loan: Loan;
  date: string;
  /** Somme remboursée par avance (crédit entier, avant la part à charge). */
  amount: number;
  mode: LoanPrepaymentMode;
  /** Indemnité réclamée par la banque. */
  fee: number;
  /** Rendement annuel net du placement de comparaison. */
  placementRate: number;
}

export interface PrepaymentComparison {
  /** Fin prévue du crédit sans remboursement : horizon de la comparaison. */
  horizon: string;
  months: number;
  newEndDate: string;
  newMonthly: number;
  monthsSaved: number;
  savedInterest: number;
  savedInsurance: number;
  /** Rembourser : les sommes libérées chaque mois, placées jusqu'à l'horizon. */
  repayWealth: number;
  /** Placer : la même somme (remboursement + indemnité) placée jusqu'à l'horizon. */
  investWealth: number;
  /** Avance de l'option « rembourser » à l'horizon ; négative si placer rapporte plus. */
  advantage: number;
  /** Taux à partir duquel placer devient plus intéressant, assurance comprise. */
  breakEvenRate: number | null;
}

/**
 * Compare, à la fin prévue du crédit, deux usages de la même somme : la rembourser par avance (les échéances
 * économisées sont placées au fil de l'eau) ou la placer d'un coup. Montants pour la part à charge de l'utilisateur.
 */
export function comparePrepayment(input: PrepaymentInput): PrepaymentComparison {
  const { loan, date, amount, mode, fee, placementRate } = input;
  const before = loanSchedule(loan).filter((s) => s.date > date);
  const withPrepayment: Loan = { ...loan, prepayments: [...loan.prepayments, { id: "simulation", loanId: loan.id, date, amount, fee: 0, mode }] };
  const after = loanSchedule(withPrepayment).filter((s) => s.date > date);
  const horizon = before.at(-1)?.date ?? date;
  const months = Math.max(0, monthsBetween(date, horizon));
  const monthlyRate = (r: number) => Math.pow(1 + r, 1 / 12) - 1;
  const flow = (s: { payment: number; insurance: number } | undefined) => (s ? s.payment + s.insurance : 0);
  const afterByDate = new Map(after.map((s) => [s.date, s]));
  const freedAt = (r: number) =>
    before.reduce((total, s) => {
      const freed = flow(s) - flow(afterByDate.get(s.date));
      return total + freed * Math.pow(1 + monthlyRate(r), monthsBetween(s.date, horizon));
    }, 0);
  const invest = (r: number) => (Math.min(amount, loanState(loan, date).balance) + fee) * Math.pow(1 + r, months / 12);
  // Taux d'équilibre : celui où les deux options se valent.
  let lo = -0.5;
  let hi = 1;
  let breakEven: number | null = null;
  if ((freedAt(lo) - invest(lo)) * (freedAt(hi) - invest(hi)) < 0) {
    for (let n = 0; n < 80; n++) {
      const mid = (lo + hi) / 2;
      if ((freedAt(mid) - invest(mid)) * (freedAt(lo) - invest(lo)) > 0) lo = mid;
      else hi = mid;
    }
    breakEven = Math.round(((lo + hi) / 2) * 1e5) / 1e5;
  }
  const share = loan.share;
  const total = (steps: readonly LoanScheduleStep[], key: "interest" | "insurance") => steps.reduce((t, s) => t + s[key], 0);
  const repayWealth = roundCents(freedAt(placementRate) * share);
  const investWealth = roundCents(invest(placementRate) * share);
  const nextAfter = after[0];
  return {
    horizon,
    months,
    newEndDate: after.at(-1)?.date ?? date,
    newMonthly: roundCents(flow(nextAfter) * share),
    monthsSaved: Math.max(0, before.length - after.length),
    savedInterest: roundCents((total(before, "interest") - total(after, "interest")) * share),
    savedInsurance: roundCents((total(before, "insurance") - total(after, "insurance")) * share),
    repayWealth,
    investWealth,
    advantage: roundCents(repayWealth - investWealth),
    breakEvenRate: breakEven,
  };
}

/** Rendements de référence pour la comparaison, nets d'impôts estimés à partir des hypothèses du plan. */
export function placementPresets(p: Pick<PlanParams, "returns" | "tax">): Array<{ key: string; label: string; rate: number }> {
  const r = p.returns;
  return [
    { key: "livrets", label: "Livret réglementé (sans impôt)", rate: r.livrets },
    { key: "fondsEuros", label: "Fonds euros (après prélèvements sociaux)", rate: r.fondsEuros * (1 - p.tax.socialAv) },
    { key: "obligations", label: "Obligations (après prélèvement forfaitaire)", rate: r.obligations * (1 - p.tax.pfuIncomeTax - p.tax.socialGeneral) },
    { key: "actions", label: "Actions sur PEA de plus de 5 ans (après prélèvements sociaux)", rate: r.actions * (1 - p.tax.socialGeneral) },
  ].map((x) => ({ ...x, rate: Math.round(x.rate * 1e5) / 1e5 }));
}
