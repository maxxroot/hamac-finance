import { useMemo } from "react";
import { Schedule, type Transaction } from "@hamac/core";
import { todayIso } from "./numbers";
import { useWorkspaceIndex } from "./workspace";

/**
 * Opérations du journal : celles saisies, plus les versements programmés déjà prélevés
 * (calculés depuis Versements au jour fixé dans Paramètres › Plan, jamais enregistrés).
 */
export function useJournal(): Transaction[] {
  const idx = useWorkspaceIndex();
  const today = todayIso();
  return useMemo(() => {
    if (!idx) return [];
    const { startMonth, contributionDay } = idx.ws.params.profile;
    const scheduled = new Schedule(idx.ws.plans, idx.ws.skips, startMonth, contributionDay).paidTransactions(today);
    return [...idx.ws.transactions, ...scheduled];
  }, [idx, today]);
}
