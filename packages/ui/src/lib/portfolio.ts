import { useMemo } from "react";
import { buildHistory, computePortfolio, cryptoTax, type EngineData } from "@hamac/core";
import { todayIso } from "./numbers";
import { useWorkspaceIndex } from "./workspace";

/** Données du moteur à partir de l'espace de travail chargé. */
export function useEngineData(): EngineData | null {
  const idx = useWorkspaceIndex();
  return useMemo(() => (idx ? { ...idx.ws, prices: idx.ws.prices } : null), [idx]);
}

/** État calculé du patrimoine à aujourd'hui (recalculé à chaque modification). */
export function usePortfolio() {
  const idx = useWorkspaceIndex();
  const data = useEngineData();
  const today = todayIso();
  const state = useMemo(() => (data ? computePortfolio(data, today) : null), [data, today]);
  const crypto = useMemo(() => (data ? cryptoTax(data, today) : null), [data, today]);
  return idx && data && state && crypto ? { idx, data, state, crypto, today } : null;
}

export function useHistory() {
  const data = useEngineData();
  const today = todayIso();
  return useMemo(() => (data ? buildHistory(data, today) : null), [data, today]);
}
