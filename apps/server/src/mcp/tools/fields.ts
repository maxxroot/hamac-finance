import { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { ToolError } from "../engine";

/** Champs et annotations communs aux outils MCP, et fusion d'une modification partielle avec l'existant. */

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ");
export const isoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mois au format AAAA-MM");
export const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
export const isin = z.string().trim().toUpperCase().regex(ISIN, "ISIN invalide (12 caractères, ex. FR0011871128)");
export const rate = z.number().min(-1).max(1).describe("Taux en fraction : 0.03 pour 3 %.");

export const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
/** Écrit un objet décrit en entier par ses paramètres : le client MCP demande l'accord de l'utilisateur. */
export const WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

/** Phrase ajoutée aux descriptions des outils d'écriture. */
export const AFTER_CONSENT = "Après accord explicite de l'utilisateur.";

/**
 * Les procédures `*.upsert` du contrat remplacent tout l'objet (un champ absent reprend sa valeur par défaut) :
 * une modification repart de l'objet existant et n'y change que les champs donnés.
 */
export function merge<T extends object>(existing: T | undefined, patch: Record<string, unknown>): T & Record<string, unknown> {
  const given = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  return { ...existing, ...given } as T & Record<string, unknown>;
}

/** L'objet d'identifiant `id`, ou une erreur qui dit quel outil donne les identifiants. */
export function found<T extends { id: string }>(list: readonly T[], id: string, what: string, listTool: string): T {
  const item = list.find((x) => x.id === id);
  if (!item) throw new ToolError(`${what} introuvable : appelez ${listTool} pour obtenir les identifiants.`);
  return item;
}

export const round4 = (v: number): number => Math.round(v * 10_000) / 10_000;
