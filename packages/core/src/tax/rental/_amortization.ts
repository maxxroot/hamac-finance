import { addMonths, daysBetween } from "../../base";
import { expenseDates, propertyTotalCost, type Lease, type Property, type PropertyExpense } from "../../realestate";
import { AMORTIZATION_COMPONENTS, IMPROVEMENT_YEARS } from "./_rules";

/** Part d'un amortissement linéaire de `years` ans commencé le `start` qui tombe dans l'année `year`. */
function straightLine(amount: number, start: string, years: number, year: number): number {
  const end = addMonths(start, 12 * years);
  const from = start > `${year}-01-01` ? start : `${year}-01-01`;
  const to = end < `${year + 1}-01-01` ? end : `${year + 1}-01-01`;
  if (from >= to) return 0;
  return (amount / years) * (daysBetween(from, to) / daysBetween(`${year}-01-01`, `${year + 1}-01-01`));
}

/** Début de l'amortissement : la mise en location, pas avant l'achat. */
export function amortizationStart(property: Property, leases: readonly Lease[]): string | null {
  const first = leases.filter((l) => l.propertyId === property.id).reduce<string | null>((f, l) => (f == null || l.startDate < f ? l.startDate : f), null);
  if (first == null) return null;
  return property.purchaseDate != null && property.purchaseDate > first ? property.purchaseDate : first;
}

/**
 * Amortissement d'une année pour un meublé au réel, à la part détenue : le bâti (coût complet hors terrain) par
 * composant, et chaque amélioration sur 10 ans à partir de sa date. Rien sans prix d'achat ni mise en location.
 */
export function yearAmortization(property: Property, leases: readonly Lease[], expenses: readonly PropertyExpense[], landShare: number, year: number, asOf: string): number {
  const start = amortizationStart(property, leases);
  if (start == null) return 0;
  const cost = propertyTotalCost(property) ?? 0;
  const building = cost * (1 - landShare);
  let total = AMORTIZATION_COMPONENTS.reduce((s, c) => s + straightLine(building * c.share, start, c.years, year), 0);
  for (const e of expenses) {
    if (e.propertyId !== property.id || !e.improvement) continue;
    for (const date of expenseDates(e, asOf)) total += straightLine(e.amount, date > start ? date : start, IMPROVEMENT_YEARS, year);
  }
  return total * property.share;
}
