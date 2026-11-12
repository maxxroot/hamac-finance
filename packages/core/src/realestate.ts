import { addMonths, monthsBetween } from "./dates";
import type { EnergyLetter } from "./energy";
import type { RentalMode } from "./lots";
import { roundCents } from "./money";
import { dismembermentRatio, type Company, type DismembermentFields } from "./ownership";

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

/** Nature du bien, indépendante de son utilisation. */
export const PROPERTY_TYPES = ["appartement", "maison", "parking", "local", "terrain", "autre"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  appartement: "Appartement",
  maison: "Maison",
  parking: "Parking ou box",
  local: "Local",
  terrain: "Terrain",
  autre: "Autre",
};

export interface Property extends DismembermentFields {
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
  // Fiche descriptive, entièrement facultative.
  propertyType: PropertyType | null;
  address: string;
  postalCode: string;
  city: string;
  /** Surface habitable, en m². */
  surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  floor: number | null;
  buildYear: number | null;
  outdoor: string;
  parking: boolean;
  cellar: boolean;
  heating: string;
  coOwnership: boolean;
  syndic: string;
  dpe: EnergyLetter | null;
  ges: EnergyLetter | null;
  dpeDate: string | null;
  /** Alerter avant l'expiration du DPE et si sa note interdit de louer. */
  dpeReminders: boolean;
  /** Comment le bien est loué (investissement locatif) : il décide des lots et des baux proposés. */
  rentalMode: RentalMode;
  /** Vente : le bien sort du patrimoine à cette date. */
  saleDate: string | null;
  /** Prix et frais de vente du bien entier. */
  salePrice: number | null;
  saleFees: number;
  /** Part détenue (fraction) : 0,5 pour un bien à deux ; pour un bien de SCI, la part du bien détenue par la société. */
  share: number;
  /** Société (SCI) qui détient le bien : sa part s'applique en plus, une fois les parts de société appliquées (`withCompanyShares`). */
  companyId: string | null;
  /** Dans ou hors de l'allocation cible ; null = comme la classe Immobilier. */
  inAllocation: boolean | null;
  classId: string | null;
  comment: string;
  archived: boolean;
}

/** Fiche vide d'un nouveau bien. */
export const NO_PROPERTY_DETAILS = {
  propertyType: null,
  address: "",
  postalCode: "",
  city: "",
  surface: null,
  rooms: null,
  bedrooms: null,
  floor: null,
  buildYear: null,
  outdoor: "",
  parking: false,
  cellar: false,
  heating: "",
  coOwnership: false,
  syndic: "",
  dpe: null,
  ges: null,
  dpeDate: null,
  dpeReminders: true,
  rentalMode: "vide",
  saleDate: null,
  salePrice: null,
  saleFees: 0,
  companyId: null,
  dismemberment: "pleine",
  usufructBirthDate: null,
  usufructEnd: null,
} satisfies Partial<Property>;

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

/** Valeur de la part détenue à une date : part du bien, puis part du droit en cas d'usufruit ou de nue-propriété (barème fiscal). */
export const propertyValue = (p: Pick<Property, "value" | "share"> & Partial<DismembermentFields>, date: string) =>
  roundCents(p.value * p.share * (p.dismemberment ? dismembermentRatio(p as DismembermentFields, date) : 1));

/** Repères au m² ; null sans surface connue. */
export function propertySqm(p: Pick<Property, "surface" | "purchasePrice" | "value">, monthlyRent: number | null): { purchase: number | null; value: number; rent: number | null } | null {
  if (p.surface == null || p.surface <= 0) return null;
  const surface = p.surface;
  const per = (amount: number) => roundCents(amount / surface);
  return { purchase: p.purchasePrice == null ? null : per(p.purchasePrice), value: per(p.value), rent: monthlyRent == null ? null : per(monthlyRent) };
}

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

/** Synthèse d'un bien, à partir des crédits en cours (non archivés) déjà calculés. `improvements` : travaux qui s'ajoutent au coût. */
export function propertySummary(property: Property, loanStates: readonly LoanState[], improvements: number, date: string): PropertySummary {
  const heldValue = propertyValue(property, date);
  const totalCost = propertyTotalCost(property);
  const heldCost = totalCost == null ? null : roundCents((totalCost + improvements) * property.share);
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

/** Ancienne estimation d'un bien ; la plus récente reste sur le bien lui-même. */
export interface PropertyValue {
  id: string;
  propertyId: string;
  date: string;
  value: number;
}

/** Valeur de la part détenue à une date : 0 hors de la période de détention, sinon la dernière estimation connue. */
export function propertyHeldValueAt(p: Property, estimates: readonly PropertyValue[], date: string): number {
  if (p.purchaseDate != null && date < p.purchaseDate) return 0;
  if (p.saleDate != null ? date >= p.saleDate : p.archived) return 0;
  const points = [...estimates.filter((e) => e.propertyId === p.id).map((e) => ({ date: e.date, value: e.value })), ...(p.valueDate != null ? [{ date: p.valueDate, value: p.value }] : [])].sort((a, b) => a.date.localeCompare(b.date));
  const known = points.filter((x) => x.date <= date).at(-1);
  const value = known?.value ?? (points.length === 0 ? p.value : (p.purchasePrice ?? points[0].value));
  return propertyValue({ ...p, value }, date);
}

/** Part à charge du capital restant dû à une date : rien avant la première échéance, ni une fois soldé ou archivé sans date. */
export function loanHeldBalanceAt(loan: Loan, date: string): number {
  if (loan.closedOn != null ? date >= loan.closedOn : loan.archived) return 0;
  return date < loan.firstPayment ? 0 : loanState(loan, date).heldBalance;
}

/** Capital restant à rembourser, pour la part à charge, sur les crédits d'un bien vendu à cette date. */
export function loanPayoffAt(loans: readonly Loan[], propertyId: string, date: string): number {
  return roundCents(loans.filter((l) => l.propertyId === propertyId && (!l.archived || l.closedOn === date)).reduce((sum, l) => sum + (date < l.firstPayment ? l.principal * l.share : loanState(l, date).heldBalance), 0));
}

export interface PropertySale {
  /** Prix et frais, pour la part détenue. */
  price: number;
  fees: number;
  /** Coût complet de la part détenue, travaux d'amélioration compris ; null sans prix d'achat. */
  cost: number | null;
  /** Prix moins frais et coût, avant impôt. */
  gain: number | null;
  loanPayoff: number;
  /** Ce qu'il reste après frais et remboursement du crédit. */
  net: number;
}

/** Bilan de la vente ; null si le bien n'est pas vendu. */
export function propertySale(p: Property, improvements: number, loanPayoff: number): PropertySale | null {
  if (p.saleDate == null || p.salePrice == null) return null;
  const price = roundCents(p.salePrice * p.share);
  const fees = roundCents(p.saleFees * p.share);
  const totalCost = propertyTotalCost(p);
  const cost = totalCost == null ? null : roundCents((totalCost + improvements) * p.share);
  return { price, fees, cost, gain: cost == null ? null : roundCents(price - fees - cost), loanPayoff, net: roundCents(price - fees - loanPayoff) };
}

export interface CompanySummary {
  /** Biens de la société (non vendus), pour la part qu'elle en détient. */
  properties: Property[];
  value: number;
  /** Capital restant dû des crédits de ses biens. */
  debt: number;
  /** Actif net de la société : biens − crédits. */
  net: number;
  /** Valeur des parts de l'utilisateur. */
  held: number;
}

/**
 * Une SCI vue de l'extérieur : ses biens et ses crédits tels que saisis (avant les parts de société),
 * son actif net, et ce que valent les parts de l'utilisateur.
 */
export function companySummary(company: Pick<Company, "id" | "share">, properties: readonly Property[], loans: readonly Loan[], date: string): CompanySummary {
  const own = properties.filter((p) => p.companyId === company.id && !p.archived);
  const ids = new Set(own.map((p) => p.id));
  const value = roundCents(own.reduce((s, p) => s + propertyValue(p, date), 0));
  const debt = roundCents(loans.filter((l) => !l.archived && l.propertyId != null && ids.has(l.propertyId)).reduce((s, l) => s + loanState(l, date).heldBalance, 0));
  const net = roundCents(value - debt);
  return { properties: own, value, debt, net, held: roundCents(net * company.share) };
}
