import { useMemo } from "react";
import { allocationReport } from "@hamac/core";
import { usePortfolio } from "./portfolio";

/** État des allocations personnalisées (null si aucune ligne n'est définie). */
export function useAllocationReport() {
  const pf = usePortfolio();
  return useMemo(() => {
    const rules = pf?.data.params.customAllocations;
    if (!pf || !rules?.length) return null;
    return allocationReport(
      rules,
      pf.state.accounts.filter((a) => !a.account.archived),
      pf.state.totals.value,
    );
  }, [pf]);
}
