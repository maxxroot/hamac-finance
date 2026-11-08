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
  /** Compte dans l'allocation cible (non par défaut). */
  inAllocation: boolean;
  classId: string | null;
  comment: string;
  archived: boolean;
}

export interface Loan {
  id: string;
  name: string;
  propertyId: string | null;
  principal: number;
  /** Taux nominal annuel (fraction). */
  rate: number;
  termMonths: number;
  /** Date de la première échéance. */
  firstPayment: string;
  /** Assurance par mois, en plus de l'échéance. */
  insurance: number;
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

export interface LoanState {
  loan: Loan;
  /** Échéance hors assurance. */
  payment: number;
  /** Échéance assurance comprise, tant que le prêt court. */
  monthly: number;
  /** Capital restant dû à la date demandée. */
  balance: number;
  paymentsDone: number;
  paymentsLeft: number;
  /** Date de la dernière échéance. */
  endDate: string;
  /** Intérêts sur toute la durée, d'après l'échéance et le capital initial (hors assurance). */
  totalInterest: number;
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
  return {
    loan,
    payment: roundCents(payment),
    monthly: roundCents(paymentsLeft > 0 ? payment + loan.insurance : 0),
    balance: roundCents(paymentsLeft > 0 ? balance : 0),
    paymentsDone,
    paymentsLeft,
    endDate: addMonths(loan.firstPayment, loan.termMonths - 1),
    totalInterest: roundCents(Math.max(0, payment * loan.termMonths - loan.principal)),
    fromManualBalance: anchored,
  };
}

export const propertyValue = (p: Pick<Property, "value" | "share">) => roundCents(p.value * p.share);
