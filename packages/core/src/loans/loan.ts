import { addMonths, monthsBetween, roundCents } from "../base";

/**
 * Le crédit lui-même : type, assurance emprunteur, différé, remboursements anticipés,
 * échéancier et capital restant dû. Rattaché ou non à un bien (crédit immobilier, travaux, consommation…).
 */

export const LOAN_KINDS = ["immobilier", "travaux", "consommation", "auto", "autre"] as const;
export type LoanKind = (typeof LOAN_KINDS)[number];
export const LOAN_KIND_LABELS: Record<LoanKind, string> = {
  immobilier: "Crédit immobilier",
  travaux: "Crédit travaux",
  consommation: "Crédit à la consommation",
  auto: "Crédit auto",
  autre: "Autre crédit",
};
/** Types de crédit qui peuvent être rattachés à un bien. */
export const loanHasProperty = (kind: LoanKind) => kind === "immobilier" || kind === "travaux";

/**
 * Assurance emprunteur : montant fixe, ou taux annuel appliqué au capital emprunté (prime constante)
 * ou au capital restant dû (prime dégressive).
 * Source : CCSF, glossaire et recommandation du 12 octobre 2021 sur l'assurance emprunteur (banque-france.fr).
 */
export const LOAN_INSURANCE_MODES = ["montant", "capital_initial", "capital_restant"] as const;
export type LoanInsuranceMode = (typeof LOAN_INSURANCE_MODES)[number];
export const LOAN_INSURANCE_MODE_LABELS: Record<LoanInsuranceMode, string> = {
  montant: "Montant fixe",
  capital_initial: "Capital emprunté",
  capital_restant: "Capital restant dû",
};

export const LOAN_DEFERRED_KINDS = ["partiel", "total"] as const;
export type LoanDeferredKind = (typeof LOAN_DEFERRED_KINDS)[number];
export const LOAN_DEFERRED_KIND_LABELS: Record<LoanDeferredKind, string> = { partiel: "Partiel (intérêts seuls)", total: "Total (rien à payer)" };

export const LOAN_PREPAYMENT_MODES = ["duree", "mensualite"] as const;
export type LoanPrepaymentMode = (typeof LOAN_PREPAYMENT_MODES)[number];
export const LOAN_PREPAYMENT_MODE_LABELS: Record<LoanPrepaymentMode, string> = { duree: "Réduire la durée", mensualite: "Réduire la mensualité" };

export interface LoanPrepayment {
  id: string;
  loanId: string;
  date: string;
  amount: number;
  /** Indemnité de remboursement anticipé. */
  fee: number;
  mode: LoanPrepaymentMode;
}

export interface Loan {
  id: string;
  kind: LoanKind;
  name: string;
  propertyId: string | null;
  /** Part du crédit à la charge de l'utilisateur (fraction) : 1 si le montant saisi est déjà la sienne. */
  share: number;
  principal: number;
  /** Taux nominal annuel (fraction). */
  rate: number;
  termMonths: number;
  /** Date de la première échéance. */
  firstPayment: string;
  insuranceMode: LoanInsuranceMode;
  /** Assurance par mois, en plus de l'échéance (mode « montant »). */
  insurance: number;
  /** Taux annuel de l'assurance (fraction), pour les autres modes. */
  insuranceRate: number;
  /** Échéance saisie à la main (hors assurance) ; null = calculée. */
  manualPayment: number | null;
  /** Capital restant dû relevé sur un document, à la date indiquée ; null = calculé depuis le départ. */
  manualBalance: number | null;
  manualBalanceDate: string | null;
  archived: boolean;
  /** Date à laquelle le crédit a été soldé, par exemple à la vente du bien. */
  closedOn: string | null;
  /** Nombre de premières échéances en différé, comprises dans la durée. */
  deferredMonths: number;
  deferredKind: LoanDeferredKind;
  prepayments: readonly LoanPrepayment[];
}

/** Échéance constante hors assurance d'un prêt amortissable. */
export function loanPayment(principal: number, annualRate: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRate / 12;
  return r === 0 ? principal / termMonths : (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/** Nombre d'échéances dues entre le lendemain de `from` (ou depuis la première si null) et `asOf` inclus. */
function paymentsDue(firstPayment: string, termMonths: number, asOf: string): number {
  if (asOf < firstPayment) return 0;
  let k = monthsBetween(firstPayment, asOf) + 1;
  while (k > 0 && addMonths(firstPayment, k - 1) > asOf) k--;
  while (k < termMonths && addMonths(firstPayment, k) <= asOf) k++;
  return Math.min(k, termMonths);
}

/** Assurance d'un mois, avant l'échéance : `balance` est le capital restant dû à ce moment-là. */
function insuranceFor(loan: Loan, balance: number): number {
  if (loan.insuranceMode === "montant") return loan.insurance;
  return ((loan.insuranceMode === "capital_initial" ? loan.principal : balance) * loan.insuranceRate) / 12;
}

interface LoanStep {
  date: string;
  /** Échéance hors assurance. */
  payment: number;
  capital: number;
  interest: number;
  insurance: number;
  /** Capital restant dû après l'échéance. */
  balance: number;
}

/**
 * Échéancier mois par mois. Un relevé remplace le capital calculé à sa date ; un écart à la baisse compte comme capital remboursé.
 * Différé partiel : on ne paie que les intérêts. Différé total : les intérêts s'ajoutent au capital (capital négatif, sans sortie d'argent).
 * Remboursement anticipé : appliqué à l'échéance suivante ; on garde la mensualité (durée réduite) ou la durée (mensualité recalculée).
 */
function loanSteps(loan: Loan): LoanStep[] {
  const r = loan.rate / 12;
  const anchorIndex = loan.manualBalance != null && loan.manualBalanceDate ? paymentsDue(loan.firstPayment, loan.termMonths, loan.manualBalanceDate) : null;
  const deferred = Math.min(loan.deferredMonths, loan.termMonths - 1);
  const prepayments = [...loan.prepayments].sort((a, b) => a.date.localeCompare(b.date));
  const capitalised = loan.deferredKind === "total" ? loan.principal * Math.pow(1 + r, deferred) : loan.principal;
  let payment = loan.manualPayment ?? loanPayment(capitalised, loan.rate, loan.termMonths - deferred);
  const steps: LoanStep[] = [];
  let balance = loan.principal;
  let nextPrepayment = 0;
  let recompute = false;
  for (let k = 0; k < loan.termMonths; k++) {
    const date = addMonths(loan.firstPayment, k);
    let earlyRepayment = 0;
    let fee = 0;
    if (k === anchorIndex) {
      earlyRepayment = Math.max(0, balance - loan.manualBalance!);
      balance = loan.manualBalance!;
    }
    for (; nextPrepayment < prepayments.length && prepayments[nextPrepayment].date <= date; nextPrepayment++) {
      const p = prepayments[nextPrepayment];
      const paid = Math.min(balance, p.amount);
      balance -= paid;
      earlyRepayment += paid;
      fee += p.fee;
      if (p.mode === "mensualite") recompute = true;
    }
    if (recompute && k >= deferred) {
      if (balance > 0) payment = loanPayment(balance, loan.rate, loan.termMonths - k);
      recompute = false;
    }
    const interest = balance * r;
    const insurance = insuranceFor(loan, balance);
    if (k < deferred) {
      const added = loan.deferredKind === "total" ? interest : 0;
      balance += added;
      steps.push({ date, payment: interest - added, capital: earlyRepayment - added, interest: interest + fee, insurance, balance });
      continue;
    }
    const capital = Math.min(balance, Math.max(0, payment - interest));
    balance -= capital;
    steps.push({ date, payment, capital: capital + earlyRepayment, interest: interest + fee, insurance, balance });
    if (prepayments.length > 0 && balance <= 0.005) break;
  }
  return steps;
}

/** Une échéance de l'échéancier : date, échéance hors assurance, assurance, intérêts et capital restant dû après paiement. */
export type LoanScheduleStep = Readonly<LoanStep>;

/** Échéancier complet, mois par mois (remboursements anticipés et relevé compris). L'indemnité d'un remboursement anticipé est comptée dans les intérêts du mois. */
export function loanSchedule(loan: Loan): LoanScheduleStep[] {
  return loanSteps(loan);
}

export interface LoanYear {
  year: number;
  capital: number;
  interest: number;
  insurance: number;
  /** Capital restant dû après la dernière échéance de l'année. */
  endBalance: number;
}

/** Ce que le crédit coûte chaque année civile : capital remboursé, intérêts et assurance ; arrêté à `until` si indiqué. */
export function loanYears(loan: Loan, until?: string): LoanYear[] {
  const years = new Map<number, LoanYear>();
  for (const s of loanSteps(loan)) {
    if (until != null && s.date > until) break;
    const year = Number(s.date.slice(0, 4));
    const y = years.get(year) ?? { year, capital: 0, interest: 0, insurance: 0, endBalance: 0 };
    y.capital += s.capital;
    y.interest += s.interest;
    y.insurance += s.insurance;
    y.endBalance = s.balance;
    years.set(year, y);
  }
  return [...years.values()].map((y) => ({ year: y.year, capital: roundCents(y.capital), interest: roundCents(y.interest), insurance: roundCents(y.insurance), endBalance: roundCents(y.endBalance) }));
}

export interface LoanState {
  loan: Loan;
  /** Échéance hors assurance. */
  payment: number;
  /** Assurance du mois à venir ; 0 une fois le prêt remboursé. */
  insurance: number;
  /** Échéance assurance comprise, tant que le prêt court. */
  monthly: number;
  /** Capital restant dû à la date demandée. */
  balance: number;
  /** Capital restant dû et échéance assurance comprise, pour la part à charge de l'utilisateur. */
  heldBalance: number;
  heldMonthly: number;
  paymentsDone: number;
  paymentsLeft: number;
  /** Date de la dernière échéance. */
  endDate: string;
  /** Intérêts sur toute la durée (hors assurance), d'après l'échéancier. */
  totalInterest: number;
  /** Assurance sur toute la durée, d'après l'échéancier. */
  totalInsurance: number;
  fromManualBalance: boolean;
}

export function loanState(loan: Loan, asOf: string): LoanState {
  const steps = loanSteps(loan);
  const paymentsDone = steps.filter((x) => x.date <= asOf).length;
  const paymentsLeft = steps.length - paymentsDone;
  const last = paymentsDone > 0 ? steps[paymentsDone - 1] : null;
  const anchored = loan.manualBalance != null && !!loan.manualBalanceDate && loan.manualBalanceDate <= asOf;
  // Un relevé sans échéance depuis, ou un remboursement anticipé pas encore passé dans l'échéancier, comptent déjà.
  const scheduled = anchored && paymentsDone === paymentsDue(loan.firstPayment, loan.termMonths, loan.manualBalanceDate!) ? loan.manualBalance! : (last?.balance ?? loan.principal);
  const pending = loan.prepayments.filter((p) => p.date <= asOf && (last == null || p.date > last.date)).reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, scheduled - pending);
  const next = steps[paymentsDone];
  const payment = (next ?? steps[steps.length - 1]).payment;
  const insurance = next?.insurance ?? 0;
  return {
    loan,
    payment: roundCents(payment),
    insurance: roundCents(insurance),
    monthly: roundCents(paymentsLeft > 0 ? payment + insurance : 0),
    balance: roundCents(paymentsLeft > 0 ? balance : 0),
    heldBalance: roundCents(paymentsLeft > 0 ? balance * loan.share : 0),
    heldMonthly: roundCents(paymentsLeft > 0 ? (payment + insurance) * loan.share : 0),
    paymentsDone,
    paymentsLeft,
    endDate: steps[steps.length - 1].date,
    totalInterest: roundCents(steps.reduce((sum, x) => sum + x.interest, 0)),
    totalInsurance: roundCents(steps.reduce((sum, x) => sum + x.insurance, 0)),
    fromManualBalance: anchored,
  };
}

/** Part à charge du capital restant dû à une date : rien avant la première échéance, ni une fois soldé ou archivé sans date. */
export function loanHeldBalanceAt(loan: Loan, date: string): number {
  if (loan.closedOn != null ? date >= loan.closedOn : loan.archived) return 0;
  return date < loan.firstPayment ? 0 : loanState(loan, date).heldBalance;
}
