import { addMonths } from "./dates";

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
