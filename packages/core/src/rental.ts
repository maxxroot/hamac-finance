import { addDays, addMonths } from "./dates";
import { daysInMonth, rentMonths, type Lease, type LeaseRent, type RentException } from "./leases";
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

export interface RentalData {
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
  rents: number;
  charges: number;
  expenses: number;
  interest: number;
  insurance: number;
  capital: number;
  /** Loyers et charges reçus, moins dépenses et coût du crédit. */
  remaining: number;
  /** Loyers reçus / coût d'achat complet, ramené à une année entière ; null sans coût d'achat ou hors période de location. */
  grossYield: number | null;
  /** Comme le rendement brut, après dépenses et charges reçues, sans le crédit. */
  netYield: number | null;
  /** Part de la période de location où le logement est occupé ; null avant le premier bail. */
  occupancy: number | null;
}

/** Résultats du bien, de l'année du premier événement (achat, bail, dépense, crédit) à celle de `asOf`. */
export function propertyYears(data: RentalData, asOf: string): PropertyYear[] {
  const { property } = data;
  const leases = data.leases.filter((l) => l.propertyId === property.id);
  const months = leases.flatMap((l) => rentMonths(l, data.rents, data.exceptions, asOf));
  const expenses = data.expenses.filter((e) => e.propertyId === property.id).flatMap((e) => expenseDates(e, asOf).map((date) => ({ date, amount: e.amount })));
  const loans = data.loans.filter((l) => l.propertyId === property.id).map((l) => ({ share: l.share, years: loanYears(l, asOf) }));
  const firstLease = leases.filter((l) => l.startDate <= asOf).reduce<string | null>((first, l) => (first == null || l.startDate < first ? l.startDate : first), null);
  const asOfYear = Number(asOf.slice(0, 4));
  const startYears = [
    ...(property.purchaseDate != null ? [Number(property.purchaseDate.slice(0, 4))] : []),
    ...(firstLease != null ? [Number(firstLease.slice(0, 4))] : []),
    ...expenses.map((e) => Number(e.date.slice(0, 4))),
    ...loans.flatMap((l) => l.years.map((y) => y.year)),
  ].filter((y) => y <= asOfYear);
  if (startYears.length === 0) return [];

  const cost = propertyTotalCost(property);
  const lastDay = addDays(addMonths(`${asOf.slice(0, 7)}-01`, 1), -1);
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
    const occupiedDays = ofYear.reduce((s, m) => s + m.occupied * daysInMonth(m.month), 0);

    const loanTotal = (field: "interest" | "insurance" | "capital") => loans.reduce((sum, l) => sum + (l.years.find((y) => y.year === year)?.[field] ?? 0) * l.share, 0);
    const interest = loanTotal("interest");
    const insurance = loanTotal("insurance");
    const capital = loanTotal("capital");

    const annualize = cost != null && cost > 0 && rentalDays > 0 ? daysInYear / rentalDays / cost : null;
    out.push({
      year,
      partial: rentalDays > 0 && rentalDays < daysInYear,
      rents: roundCents(rents * property.share),
      charges: roundCents(charges * property.share),
      expenses: roundCents(spent * property.share),
      interest: roundCents(interest),
      insurance: roundCents(insurance),
      capital: roundCents(capital),
      remaining: roundCents((rents + charges - spent) * property.share - interest - insurance - capital),
      grossYield: annualize == null ? null : rents * annualize,
      netYield: annualize == null ? null : (rents + charges - spent) * annualize,
      occupancy: rentalDays > 0 ? Math.min(1, occupiedDays / rentalDays) : null,
    });
  }
  return out;
}
