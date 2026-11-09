import { addMonths, monthsBetween } from "./dates";
import { roundCents } from "./money";

/** Biens immobiliers et crédits : hors comptes, ils forment avec le patrimoine financier le patrimoine net. */

export const PROPERTY_KINDS = ["residence_principale", "residence_secondaire", "locatif", "autre"] as const;
export type PropertyKind = (typeof PROPERTY_KINDS)[number];
export const PROPERTY_KIND_LABELS: Record<PropertyKind, string> = {
  residence_principale: "Résidence principale",
  residence_secondaire: "Résidence secondaire",
  locatif: "Investissement locatif",
  autre: "Autre bien",
};

export interface Property {
  id: string;
  kind: PropertyKind;
  name: string;
  /** Valeur estimée du bien entier. */
  value: number;
  valueDate: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  /** Part détenue (fraction) : 0,5 pour un bien à deux. */
  share: number;
  /** Dans ou hors de l'allocation cible ; null = comme la classe Immobilier. */
  inAllocation: boolean | null;
  classId: string | null;
  comment: string;
  archived: boolean;
}

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

export interface Loan {
  id: string;
  kind: LoanKind;
  name: string;
  propertyId: string | null;
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

const balanceAfter = (start: number, r: number, payment: number, k: number) => {
  const balance = r === 0 ? start - payment * k : start * Math.pow(1 + r, k) - (payment * (Math.pow(1 + r, k) - 1)) / r;
  return Math.max(0, balance);
};

/** Assurance d'un mois, avant l'échéance : `balance` est le capital restant dû à ce moment-là. */
function insuranceFor(loan: Loan, balance: number): number {
  if (loan.insuranceMode === "montant") return loan.insurance;
  return ((loan.insuranceMode === "capital_initial" ? loan.principal : balance) * loan.insuranceRate) / 12;
}

interface LoanStep {
  date: string;
  capital: number;
  interest: number;
  insurance: number;
  /** Capital restant dû après l'échéance. */
  balance: number;
}

/** Échéancier mois par mois. Un relevé remplace le capital calculé à sa date ; un écart à la baisse compte comme capital remboursé. */
function loanSteps(loan: Loan, payment: number): LoanStep[] {
  const r = loan.rate / 12;
  const anchorIndex = loan.manualBalance != null && loan.manualBalanceDate ? paymentsDue(loan.firstPayment, loan.termMonths, loan.manualBalanceDate) : null;
  const steps: LoanStep[] = [];
  let balance = loan.principal;
  for (let k = 0; k < loan.termMonths; k++) {
    let earlyRepayment = 0;
    if (k === anchorIndex) {
      earlyRepayment = Math.max(0, balance - loan.manualBalance!);
      balance = loan.manualBalance!;
    }
    const interest = balance * r;
    const insurance = insuranceFor(loan, balance);
    const capital = Math.min(balance, Math.max(0, payment - interest));
    balance -= capital;
    steps.push({ date: addMonths(loan.firstPayment, k), capital: capital + earlyRepayment, interest, insurance, balance });
  }
  return steps;
}

export interface LoanYear {
  year: number;
  capital: number;
  interest: number;
  insurance: number;
  /** Capital restant dû après la dernière échéance de l'année. */
  endBalance: number;
}

/** Ce que le crédit coûte chaque année civile : capital remboursé, intérêts et assurance. */
export function loanYears(loan: Loan): LoanYear[] {
  const payment = loan.manualPayment ?? loanPayment(loan.principal, loan.rate, loan.termMonths);
  const years = new Map<number, LoanYear>();
  for (const s of loanSteps(loan, payment)) {
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
  const r = loan.rate / 12;
  const payment = loan.manualPayment ?? loanPayment(loan.principal, loan.rate, loan.termMonths);
  const paymentsDone = paymentsDue(loan.firstPayment, loan.termMonths, asOf);
  const paymentsLeft = loan.termMonths - paymentsDone;
  const anchored = loan.manualBalance != null && !!loan.manualBalanceDate && loan.manualBalanceDate <= asOf;
  // Depuis un relevé : on repart de son montant, seules les échéances postérieures au relevé comptent.
  const balance = anchored
    ? balanceAfter(loan.manualBalance!, r, payment, paymentsDone - paymentsDue(loan.firstPayment, loan.termMonths, loan.manualBalanceDate!))
    : balanceAfter(loan.principal, r, payment, paymentsDone);
  const insurance = paymentsLeft > 0 ? insuranceFor(loan, balance) : 0;
  const steps = loanSteps(loan, payment);
  return {
    loan,
    payment: roundCents(payment),
    insurance: roundCents(insurance),
    monthly: roundCents(paymentsLeft > 0 ? payment + insurance : 0),
    balance: roundCents(paymentsLeft > 0 ? balance : 0),
    paymentsDone,
    paymentsLeft,
    endDate: addMonths(loan.firstPayment, loan.termMonths - 1),
    totalInterest: roundCents(steps.reduce((s, x) => s + x.interest, 0)),
    totalInsurance: roundCents(steps.reduce((s, x) => s + x.insurance, 0)),
    fromManualBalance: anchored,
  };
}

export const propertyValue = (p: Pick<Property, "value" | "share">) => roundCents(p.value * p.share);
