import { addDays, addMonths } from "./dates";
import { daysInMonth, depositRetained, rentMonths, type Lease, type LeaseRent, type RentException } from "./leases";
import { roundCents } from "./money";
import { loanYears, propertyTotalCost, type Loan, type Property } from "./realestate";
import { daysBetween } from "./xirr";

/** Suivi financier d'un bien en location : dépenses, et résultats année par année. */

export const EXPENSE_CATEGORIES = ["taxe_fonciere", "copropriete", "assurance", "gestion", "travaux", "autre"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  taxe_fonciere: "Taxe foncière",
  copropriete: "Charges de copropriété",
  assurance: "Assurance propriétaire",
  gestion: "Frais de gestion",
  travaux: "Travaux et entretien",
  autre: "Autre dépense",
};

/** Dépense du bien entier ; `yearly` la répète chaque année à la même date, jusqu'à `untilYear` inclus si indiqué. */
export interface PropertyExpense {
  id: string;
  propertyId: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  label: string;
  yearly: boolean;
  untilYear: number | null;
  /** Travaux qui améliorent le bien : ils s'ajoutent à son coût. */
  improvement: boolean;
}

/** Dates où la dépense a été payée, jusqu'à `asOf` inclus. */
export function expenseDates(expense: Pick<PropertyExpense, "date" | "yearly" | "untilYear">, asOf: string): string[] {
  if (!expense.yearly) return expense.date <= asOf ? [expense.date] : [];
  const out: string[] = [];
  for (let k = 0; ; k++) {
    const date = addMonths(expense.date, 12 * k);
    if (date > asOf || (expense.untilYear != null && Number(date.slice(0, 4)) > expense.untilYear)) return out;
    out.push(date);
  }
}

/** Total des travaux d'amélioration payés jusqu'à `asOf`, pour le bien entier. */
export function propertyImprovements(expenses: readonly PropertyExpense[], propertyId: string, asOf: string): number {
  return roundCents(expenses.filter((e) => e.propertyId === propertyId && e.improvement).reduce((sum, e) => sum + expenseDates(e, asOf).length * e.amount, 0));
}

export const INCOME_CATEGORIES = ["regularisation_recue", "regularisation_rendue", "indemnite", "autre"] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  regularisation_recue: "Régularisation de charges reçue",
  regularisation_rendue: "Régularisation de charges rendue",
  indemnite: "Indemnité d'assurance",
  autre: "Autre recette",
};

/** Recette hors loyer, du bien entier. Le montant est positif ; la catégorie donne le sens. */
export interface PropertyIncome {
  id: string;
  propertyId: string;
  date: string;
  category: IncomeCategory;
  amount: number;
  label: string;
}

export const incomeSigned = (i: Pick<PropertyIncome, "category" | "amount">) => (i.category === "regularisation_rendue" ? -i.amount : i.amount);

export interface RentalData {
  incomes: readonly PropertyIncome[];
  property: Property;
  leases: readonly Lease[];
  rents: readonly LeaseRent[];
  exceptions: readonly RentException[];
  expenses: readonly PropertyExpense[];
  loans: readonly Loan[];
}

/** Une année de location, à la part détenue (crédits : part à charge), avant impôt. */
export interface PropertyYear {
  year: number;
  /** Année incomplète : mise en location en cours d'année, ou année en cours. */
  partial: boolean;
  /** Durée de la période de location dans l'année, en mois (12 pour une année entière). */
  rentalMonths: number;
  rents: number;
  charges: number;
  /** Recettes hors loyer : régularisations, indemnités, dépôt gardé. */
  otherIncome: number;
  expenses: number;
  interest: number;
  insurance: number;
  capital: number;
  /** Loyers, charges et autres recettes, moins dépenses et coût du crédit. */
  remaining: number;
  /** Loyers reçus / coût d'achat complet, ramené à une année entière ; null sans coût d'achat ou hors période de location. */
  grossYield: number | null;
  /** Comme le rendement brut, après dépenses et charges reçues, sans le crédit. */
  netYield: number | null;
  /** Part de la période de location où le logement est occupé ; null avant le premier bail. */
  occupancy: number | null;
}

/** Résultats du bien, de l'année du premier événement (achat, bail, dépense, crédit) à celle de `asOf`. */
export function propertyYears(data: RentalData, today: string): PropertyYear[] {
  const { property } = data;
  // Un bien vendu n'a plus de résultats après sa vente.
  const sold = property.saleDate != null && property.saleDate < today;
  const asOf = sold ? property.saleDate! : today;
  const leases = data.leases.filter((l) => l.propertyId === property.id);
  const months = leases.flatMap((l) => rentMonths(l, data.rents, data.exceptions, asOf));
  const expenses = data.expenses.filter((e) => e.propertyId === property.id).flatMap((e) => expenseDates(e, asOf).map((date) => ({ date, amount: e.amount, improvement: e.improvement })));
  const incomes = [
    ...data.incomes.filter((i) => i.propertyId === property.id && i.date <= asOf).map((i) => ({ date: i.date, amount: incomeSigned(i) })),
    ...leases.filter((l) => l.depositReturnedOn != null && l.depositReturnedOn <= asOf).map((l) => ({ date: l.depositReturnedOn!, amount: depositRetained(l) })),
  ];
  const loans = data.loans.filter((l) => l.propertyId === property.id).map((l) => ({ share: l.share, years: loanYears(l, asOf) }));
  const firstLease = leases.filter((l) => l.startDate <= asOf).reduce<string | null>((first, l) => (first == null || l.startDate < first ? l.startDate : first), null);
  const asOfYear = Number(asOf.slice(0, 4));
  const startYears = [
    ...(property.purchaseDate != null ? [Number(property.purchaseDate.slice(0, 4))] : []),
    ...(firstLease != null ? [Number(firstLease.slice(0, 4))] : []),
    ...expenses.map((e) => Number(e.date.slice(0, 4))),
    ...incomes.map((i) => Number(i.date.slice(0, 4))),
    ...loans.flatMap((l) => l.years.map((y) => y.year)),
  ].filter((y) => y <= asOfYear);
  if (startYears.length === 0) return [];

  const cost = propertyTotalCost(property);
  const lastDay = sold ? asOf : addDays(addMonths(`${asOf.slice(0, 7)}-01`, 1), -1);
  const out: PropertyYear[] = [];
  for (let year = Math.min(...startYears); year <= asOfYear; year++) {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const periodStart = firstLease != null && firstLease > yearStart ? firstLease : yearStart;
    const periodEnd = lastDay < yearEnd ? lastDay : yearEnd;
    const rentalDays = firstLease == null || periodStart > periodEnd ? 0 : daysBetween(periodStart, periodEnd) + 1;
    const daysInYear = daysBetween(yearStart, `${year + 1}-01-01`);

    const ofYear = months.filter((m) => m.month.startsWith(`${year}-`));
    const rents = ofYear.reduce((s, m) => s + m.receivedRent, 0);
    const charges = ofYear.reduce((s, m) => s + m.receivedCharges, 0);
    const spent = expenses.filter((e) => e.date.startsWith(`${year}-`)).reduce((s, e) => s + e.amount, 0);
    // Les améliorations s'ajoutent au coût : elles ne pèsent pas aussi sur le rendement de l'année.
    const running = expenses.filter((e) => e.date.startsWith(`${year}-`) && !e.improvement).reduce((s, e) => s + e.amount, 0);
    const improved = expenses.filter((e) => e.improvement && e.date <= yearEnd).reduce((s, e) => s + e.amount, 0);
    const received = incomes.filter((i) => i.date.startsWith(`${year}-`)).reduce((s, i) => s + i.amount, 0);
    const occupiedDays = ofYear.reduce((s, m) => s + m.occupied * daysInMonth(m.month), 0);

    const loanTotal = (field: "interest" | "insurance" | "capital") => loans.reduce((sum, l) => sum + (l.years.find((y) => y.year === year)?.[field] ?? 0) * l.share, 0);
    const interest = loanTotal("interest");
    const insurance = loanTotal("insurance");
    const capital = loanTotal("capital");

    const costToDate = cost == null ? null : cost + improved;
    const annualize = costToDate != null && costToDate > 0 && rentalDays > 0 ? daysInYear / rentalDays / costToDate : null;
    out.push({
      year,
      partial: rentalDays > 0 && rentalDays < daysInYear,
      rentalMonths: (rentalDays / daysInYear) * 12,
      rents: roundCents(rents * property.share),
      charges: roundCents(charges * property.share),
      otherIncome: roundCents(received * property.share),
      expenses: roundCents(spent * property.share),
      interest: roundCents(interest),
      insurance: roundCents(insurance),
      capital: roundCents(capital),
      remaining: roundCents((rents + charges + received - spent) * property.share - interest - insurance - capital),
      grossYield: annualize == null ? null : rents * annualize,
      netYield: annualize == null ? null : (rents + charges + received - running) * annualize,
      occupancy: rentalDays > 0 ? Math.min(1, occupiedDays / rentalDays) : null,
    });
  }
  return out;
}

export interface PropertyProfitability {
  /** Année de référence : la dernière complète, sinon la dernière louée. */
  year: number;
  partial: boolean;
  grossYield: number | null;
  netYield: number | null;
  monthlyRemaining: number | null;
  occupancy: number | null;
  /** Depuis l'achat, à la part détenue. */
  totalRents: number;
  totalCapital: number;
}

/** Synthèse de la rentabilité ; null tant que le bien n'a jamais été loué. */
export function propertyProfitability(years: readonly PropertyYear[]): PropertyProfitability | null {
  const rented = years.filter((y) => y.occupancy != null);
  const reference = rented.filter((y) => !y.partial).at(-1) ?? rented.at(-1);
  if (!reference) return null;
  return {
    year: reference.year,
    partial: reference.partial,
    grossYield: reference.grossYield,
    netYield: reference.netYield,
    monthlyRemaining: reference.rentalMonths > 0 ? roundCents(reference.remaining / reference.rentalMonths) : null,
    occupancy: reference.occupancy,
    totalRents: roundCents(years.reduce((s, y) => s + y.rents, 0)),
    totalCapital: roundCents(years.reduce((s, y) => s + y.capital, 0)),
  };
}

export const DOCUMENT_KINDS = ["acte", "bail", "diagnostic", "assurance", "facture", "autre"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  acte: "Acte de vente",
  bail: "Bail",
  diagnostic: "Diagnostic",
  assurance: "Assurance",
  facture: "Facture",
  autre: "Autre document",
};

/** Registre des documents d'un bien : Hamac note où ils se trouvent, sans stocker les fichiers. */
export interface PropertyDocument {
  id: string;
  propertyId: string;
  kind: DocumentKind;
  label: string;
  date: string | null;
  expiresOn: string | null;
  /** Où le retrouver : dossier, coffre-fort numérique… */
  location: string;
}
