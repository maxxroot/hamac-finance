import { monthOf, type Transaction } from "@hamac/core";

/** Logique d'affichage de la page Versements, sans React pour pouvoir la tester. */

export interface OneOffCell {
  total: number;
  /** Date et montant de chaque versement du mois, pour l'info-bulle. */
  items: { date: string; amount: number; comment: string }[];
}

/**
 * Versements ponctuels (opérations « Versement » du journal), rangés par mois puis par compte.
 * Les versements mensuels programmés n'en font pas partie : ils viennent du plan, pas du journal.
 */
export function oneOffByMonth(transactions: readonly Transaction[]): Map<string, Map<string, OneOffCell>> {
  const byMonth = new Map<string, Map<string, OneOffCell>>();
  const sorted = transactions.filter((t) => t.type === "versement").sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    const month = monthOf(t.date);
    const byAccount = byMonth.get(month) ?? new Map<string, OneOffCell>();
    const cell = byAccount.get(t.accountId) ?? { total: 0, items: [] };
    cell.total += t.amount;
    cell.items.push({ date: t.date, amount: t.amount, comment: t.comment });
    byAccount.set(t.accountId, cell);
    byMonth.set(month, byAccount);
  }
  return byMonth;
}

/** Total des versements ponctuels d'un mois, tous comptes confondus. */
export function oneOffTotal(byAccount: ReadonlyMap<string, OneOffCell> | undefined): number {
  let s = 0;
  for (const c of byAccount?.values() ?? []) s += c.total;
  return s;
}
