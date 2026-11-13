import { addMonths, roundCents } from "../base";

/**
 * Dépenses d'un bien, et la part que le propriétaire récupère sur le locataire.
 *
 * Charges récupérables : décret n° 87-713 du 26 août 1987, annexe (liste limitative, Cass. 3e civ. 1er juin 2005),
 * dont la taxe d'enlèvement des ordures ménagères (rubrique VIII), qui figure sur l'avis de taxe foncière : le reste
 * de la taxe foncière n'est pas récupérable. Relu le 13 novembre 2026 sur des sources secondaires, à confirmer sur
 * Légifrance. La part récupérable du décompte du syndic se saisit en pourcentage (deux tiers proposés).
 */

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
  /** Part du montant que le propriétaire récupère sur le locataire (0 à 1) : charges de copropriété récupérables, TEOM de la taxe foncière. */
  recoverableRate: number;
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

/** Catégories dont une part peut être demandée au locataire. Assurance, gestion et travaux du propriétaire restent à sa charge. */
export const RECOVERABLE_CATEGORIES: readonly ExpenseCategory[] = ["copropriete", "taxe_fonciere", "autre"];

/** Part récupérable proposée pour une nouvelle dépense : celle des réglages pour la copropriété, rien ailleurs (la TEOM se saisit en montant). */
export function defaultRecoverableRate(category: ExpenseCategory, coproRecoverable: number): number {
  return category === "copropriete" ? coproRecoverable : 0;
}

/** Montant récupérable sur le locataire, à chaque fois que la dépense est payée. */
export const recoverableAmount = (e: Pick<PropertyExpense, "amount" | "recoverableRate" | "improvement">) => (e.improvement ? 0 : roundCents(e.amount * e.recoverableRate));

/** Ce qui reste à la charge du propriétaire, à chaque fois que la dépense est payée. */
export const ownerAmount = (e: Pick<PropertyExpense, "amount" | "recoverableRate" | "improvement">) => roundCents(e.amount - recoverableAmount(e));

/** Part récupérable correspondant à un montant récupérable (la TEOM d'un avis de taxe foncière), entre 0 et 1. */
export function rateFromAmount(recoverable: number, amount: number): number {
  if (amount <= 0) return 0;
  return Math.min(1, Math.max(0, recoverable / amount));
}
