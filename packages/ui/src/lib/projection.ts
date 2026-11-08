import { useDeferredValue, useMemo } from "react";
import { monteCarlo, project, projectionInputFromState, type Band, type Flows, type PlanParams, type PortfolioState, type Projection } from "@hamac/core";
import { usePortfolio } from "./portfolio";

export type Scenario = { params: PlanParams; extraMonthly: Partial<Flows> };

/** Projection du plan et sa fourchette : calculées une fois par état du patrimoine, partagées entre les pages. */
const planCache = new WeakMap<PortfolioState, { base: Projection; bands: Band[] }>();

/**
 * Projection du plan, sa fourchette, et un scénario éventuel. Le scénario est calculé en différé :
 * la saisie dans le simulateur reste fluide, le graphique suit dès que possible.
 * `enabled = false` (gestion de patrimoine) : rien n'est calculé, renvoie null.
 */
export function useProjection(scenario?: Scenario | null, enabled = true) {
  const pf = usePortfolio();
  const plan = useMemo(() => {
    if (!pf || !enabled) return null;
    let hit = planCache.get(pf.state);
    if (!hit) {
      const input = projectionInputFromState(pf.data, pf.state);
      hit = { base: project(input), bands: monteCarlo(input, 300) };
      planCache.set(pf.state, hit);
    }
    return hit;
  }, [pf, enabled]);
  const deferred = useDeferredValue(scenario ?? null);
  const alt = useMemo(() => (pf && deferred ? project(projectionInputFromState(pf.data, pf.state, deferred)) : null), [pf, deferred]);
  return useMemo(() => (pf && plan ? { pf, base: plan.base, bands: plan.bands, alt } : null), [pf, plan, alt]);
}
