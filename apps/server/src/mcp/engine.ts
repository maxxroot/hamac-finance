import type { Transport, Workspace } from "@hamac/api";
import { computePortfolio, normalizeParams, withCompanyShares, type EngineData, type PortfolioState } from "@hamac/core";

/**
 * Accès aux données pour les outils MCP : uniquement par le contrat (`Backend.dispatch`), comme l'interface,
 * puis le moteur pur de `@hamac/core` sur l'espace de travail chargé (décision 0009).
 */

export type Call = Transport["call"];

/** Erreur attendue d'un outil : son message est montré tel quel au modèle. */
export class ToolError extends Error {}

/** Date du jour en France : le serveur tourne souvent en UTC, l'utilisateur non. */
export function parisToday(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(now);
}

/** Un appel du contrat qui lève une `ToolError` lisible au lieu de renvoyer un `RpcResult`. */
export function callThrough(dispatch: (name: string, input: unknown) => Promise<{ ok: true; data: unknown } | { ok: false; error: { message: string; details?: unknown } }>): Call {
  return (async (name: string, input?: unknown) => {
    const res = await dispatch(name, input);
    if (res.ok) return res.data;
    const issues = Array.isArray(res.error.details) ? (res.error.details as Array<{ path?: unknown[]; message?: string }>).map((i) => `${(i.path ?? []).join(".") || "entrée"} : ${i.message ?? ""}`) : [];
    throw new ToolError([res.error.message, ...issues].join(" ; "));
  }) as Call;
}

export interface Engine {
  ws: Workspace;
  data: EngineData;
  state: PortfolioState;
  today: string;
}

/** Même préparation que l'interface (`packages/ui/src/shared/lib/portfolio.ts`) : parts des SCI appliquées aux biens. */
export async function loadEngine(call: Call, today = parisToday()): Promise<Engine> {
  const loaded = await call("workspace.load");
  const ws: Workspace = { ...loaded, params: normalizeParams(loaded.params) };
  const data: EngineData = { ...ws, ...withCompanyShares(ws), prices: ws.prices };
  return { ws, data, state: computePortfolio(data, today), today };
}

/** Arrondi au centime pour les réponses : le modèle n'a pas à voir des flottants à 15 décimales. */
export const cents = (v: number): number => Math.round(v * 100) / 100;
