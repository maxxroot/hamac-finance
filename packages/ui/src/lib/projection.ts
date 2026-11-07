import { useMemo } from "react";
import { monteCarlo, project, projectionInputFromState, type Flows, type PlanParams } from "@hamac/core";
import { usePortfolio } from "./portfolio";

/** Projection du plan, sa fourchette, et un scénario éventuel, recalculés à chaque modification. */
export function useProjection(scenario?: { params: PlanParams; extraMonthly: Partial<Flows> } | null) {
  const pf = usePortfolio();
  const plan = useMemo(() => {
    if (!pf) return null;
    const input = projectionInputFromState(pf.data, pf.state);
    return { input, base: project(input), bands: monteCarlo(input, 300) };
  }, [pf]);
  const alt = useMemo(() => (pf && scenario ? project(projectionInputFromState(pf.data, pf.state, scenario)) : null), [pf, scenario]);
  return pf && plan ? { pf, base: plan.base, bands: plan.bands, alt } : null;
}
