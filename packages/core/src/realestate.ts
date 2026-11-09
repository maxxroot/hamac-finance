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

/** Statut de détention. En location vide, il fixe aussi la durée légale du bail. */
export const PROPERTY_OWNERSHIPS = ["nom_propre", "indivision", "sci_familiale", "sci", "autre"] as const;
export type PropertyOwnership = (typeof PROPERTY_OWNERSHIPS)[number];
export const PROPERTY_OWNERSHIP_LABELS: Record<PropertyOwnership, string> = {
  nom_propre: "En nom propre",
  indivision: "En indivision",
  sci_familiale: "SCI familiale",
  sci: "Autre SCI",
  autre: "Autre statut",
};

export interface Property {
  id: string;
  kind: PropertyKind;
  ownership: PropertyOwnership;
  name: string;
  /** Valeur estimée du bien entier. */
  value: number;
  valueDate: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  /** Acheté neuf ou en construction ; sinon ancien. Sert à estimer les frais de notaire. */
  newBuild: boolean;
  /** Frais d'achat du bien entier, quel que soit son usage. */
  notaryFees: number;
  agencyFees: number;
  initialWorks: number;
  otherFees: number;
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
    heldBalance: roundCents(paymentsLeft > 0 ? balance * loan.share : 0),
    heldMonthly: roundCents(paymentsLeft > 0 ? (payment + insurance) * loan.share : 0),
    paymentsDone,
    paymentsLeft,
    endDate: addMonths(loan.firstPayment, loan.termMonths - 1),
    totalInterest: roundCents(steps.reduce((s, x) => s + x.interest, 0)),
    totalInsurance: roundCents(steps.reduce((s, x) => s + x.insurance, 0)),
    fromManualBalance: anchored,
  };
}

export const propertyValue = (p: Pick<Property, "value" | "share">) => roundCents(p.value * p.share);

type PropertyCosts = Pick<Property, "purchasePrice" | "notaryFees" | "agencyFees" | "initialWorks" | "otherFees">;

export const propertyFees = (p: PropertyCosts) => roundCents(p.notaryFees + p.agencyFees + p.initialWorks + p.otherFees);

/** Coût d'achat complet du bien entier, frais compris ; null tant que le prix d'achat est inconnu. */
export const propertyTotalCost = (p: PropertyCosts) => (p.purchasePrice == null ? null : roundCents(p.purchasePrice + propertyFees(p)));

export interface PropertySummary {
  heldValue: number;
  /** Coût d'achat complet, pour la part détenue ; null tant que le prix d'achat est inconnu. */
  heldCost: number | null;
  /** Valeur détenue moins coût d'achat complet de cette part, avant impôt. */
  gain: number | null;
  /** Crédits rattachés au bien. */
  loans: LoanState[];
  /** Capital restant dû des crédits rattachés, pour la part à charge de l'utilisateur. */
  heldDebt: number;
  heldMonthly: number;
  /** Valeur détenue moins capital restant dû. */
  netValue: number;
}

/** Synthèse d'un bien, à partir des crédits en cours (non archivés) déjà calculés. */
export function propertySummary(property: Property, loanStates: readonly LoanState[]): PropertySummary {
  const heldValue = propertyValue(property);
  const totalCost = propertyTotalCost(property);
  const heldCost = totalCost == null ? null : roundCents(totalCost * property.share);
  const loans = loanStates.filter((l) => l.loan.propertyId === property.id);
  const heldDebt = roundCents(loans.reduce((s, l) => s + l.heldBalance, 0));
  return {
    heldValue,
    heldCost,
    gain: heldCost == null ? null : roundCents(heldValue - heldCost),
    loans,
    heldDebt,
    heldMonthly: roundCents(loans.reduce((s, l) => s + l.heldMonthly, 0)),
    netValue: roundCents(heldValue - heldDebt),
  };
}

/**
 * Barème des émoluments du notaire pour une vente, hors taxes (art. A444-91 du code de commerce) :
 * chaque taux s'applique à la tranche de prix correspondante.
 * Source : service-public.gouv.fr, fiche F17701 (exemple : 1 995,25 € HT pour 200 000 €).
 */
const NOTARY_FEE_BRACKETS = [
  { upTo: 6_500, rate: 0.0387 },
  { upTo: 17_000, rate: 0.01596 },
  { upTo: 60_000, rate: 0.01064 },
  { upTo: Infinity, rate: 0.00799 },
] as const;
const NOTARY_VAT = 0.2;
/** Contribution de sécurité immobilière. */
const LAND_SECURITY_RATE = 0.001;
/** Formalités et débours : forfait approximatif, le montant réel dépend du dossier. */
const NOTARY_FORMALITIES = 1_000;
/**
 * Droits de mutation : taux départemental majoré des frais d'assiette (2,37 %), plus la taxe communale (1,2 %).
 * Depuis le 1er avril 2025, la plupart des départements appliquent 5 % au lieu de 4,5 %, soit 6,3185 % au lieu de 5,80665 %.
 * Sources : art. 1594 D du CGI, art. 116 de la loi n° 2025-127, BOI-ENR-DMTOI-10-20 et tableau des taux de la DGFiP (impots.gouv.fr).
 */
const TRANSFER_TAX_OLD = 0.0580665;
const TRANSFER_TAX_FROM_2025 = 0.063185;
const TRANSFER_TAX_2025_START = "2025-04-01";
/** Taux réduit du neuf et de la vente en l'état futur d'achèvement. */
const TRANSFER_TAX_NEW = 0.00715;

/**
 * Estimation des frais de notaire à l'achat, à l'euro près.
 * Hypothèses : taux le plus courant à la date d'achat (date inconnue : taux actuel), TVA de métropole, sans remise du notaire.
 * Le taux réel dépend du département, et un primo-accédant peut échapper à la hausse de 2025 : le montant reste modifiable.
 */
export function estimateNotaryFees(price: number, newBuild: boolean, purchaseDate: string | null): number {
  if (price <= 0) return 0;
  const transferRate = newBuild ? TRANSFER_TAX_NEW : purchaseDate != null && purchaseDate < TRANSFER_TAX_2025_START ? TRANSFER_TAX_OLD : TRANSFER_TAX_FROM_2025;
  let from = 0;
  let fees = 0;
  for (const { upTo, rate } of NOTARY_FEE_BRACKETS) {
    fees += Math.max(0, Math.min(price, upTo) - from) * rate;
    from = upTo;
  }
  return Math.round(price * transferRate + fees * (1 + NOTARY_VAT) + price * LAND_SECURITY_RATE + NOTARY_FORMALITIES);
}
