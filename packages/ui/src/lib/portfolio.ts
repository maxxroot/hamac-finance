import { useMemo } from "react";
import { buildHistory, computePortfolio, cryptoTax, type EngineData, type PortfolioState } from "@hamac/core";
import type { Workspace } from "@hamac/api";
import { todayIso } from "./numbers";
import { useWorkspaceIndex } from "./workspace";

/**
 * Calculs partagés entre tous les composants : une seule fois par version de l'espace de travail
 * (et par jour), quel que soit le nombre de composants qui les demandent.
 */
const engineCache = new WeakMap<Workspace, { today: string; data: EngineData; state: PortfolioState; crypto: ReturnType<typeof cryptoTax> }>();

function engineFor(ws: Workspace, today: string) {
  const hit = engineCache.get(ws);
  if (hit?.today === today) return hit;
  const data: EngineData = { ...ws, prices: ws.prices };
  const entry = { today, data, state: computePortfolio(data, today), crypto: cryptoTax(data, today) };
  engineCache.set(ws, entry);
  return entry;
}

/** Données du moteur à partir de l'espace de travail chargé. */
export function useEngineData(): EngineData | null {
  const idx = useWorkspaceIndex();
  const today = todayIso();
  return useMemo(() => (idx ? engineFor(idx.ws, today).data : null), [idx, today]);
}

/** État calculé du patrimoine à aujourd'hui (recalculé à chaque modification, objet stable sinon). */
export function usePortfolio() {
  const idx = useWorkspaceIndex();
  const today = todayIso();
  return useMemo(() => {
    if (!idx) return null;
    const { data, state, crypto } = engineFor(idx.ws, today);
    return { idx, data, state, crypto, today };
  }, [idx, today]);
}

const historyCache = new WeakMap<EngineData, { today: string; value: ReturnType<typeof buildHistory> }>();

export function useHistory() {
  const data = useEngineData();
  const today = todayIso();
  return useMemo(() => {
    if (!data) return null;
    const hit = historyCache.get(data);
    if (hit?.today === today) return hit.value;
    const value = buildHistory(data, today);
    historyCache.set(data, { today, value });
    return value;
  }, [data, today]);
}
