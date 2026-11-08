import type { PlanParams } from "@hamac/core";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Reporte sur un brouillon de paramètres un enregistrement fait ailleurs (les frais par défaut
 * d'un autre onglet, par exemple) : seules les sections que l'utilisateur a modifiées restent les siennes.
 */
export function rebaseDraft(draft: PlanParams, base: PlanParams, server: PlanParams): PlanParams {
  const next: Record<string, unknown> = { ...draft };
  for (const key of Object.keys(server) as (keyof PlanParams)[]) {
    if (same(draft[key], base[key])) next[key] = server[key];
  }
  return next as PlanParams;
}

const REPARTITION_SECTIONS = ["targets", "allocation", "customAllocations", "customClasses"];

/** Onglets où se trouvent les points à corriger, pour les nommer quand on est sur un autre onglet. */
export function issueTabs(keys: Iterable<string>): ("Plan" | "Répartition")[] {
  const list = [...keys];
  const inRepartition = (k: string) => k === "livrets.driftAlert" || REPARTITION_SECTIONS.includes(k.split(".")[0]!);
  return [...(list.some((k) => !inRepartition(k)) ? (["Plan"] as const) : []), ...(list.some(inRepartition) ? (["Répartition"] as const) : [])];
}
