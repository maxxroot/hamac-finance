import type { TxType } from "@hamac/core";

/** Opérations qui suivent l'action qui les a causées : frais et impôts débités à part (dernières du jour, comme dans le moteur). */
const AFTER_ACTIONS: ReadonlySet<TxType> = new Set(["frais", "impots"]);

/**
 * Clé de tri « Date » du journal : la date, puis à date égale les frais et impôts après les autres opérations,
 * puis l'ordre de saisie. `saved` arrive du serveur trié par date puis création décroissantes ; une opération
 * absente (versement programmé) passe avant celles saisies le même jour. Ainsi, un retrait enregistré avec
 * son versement reste avant lui, et des frais restent après l'achat qu'ils accompagnent, dans les deux sens de tri.
 */
export function dateOrderKey(saved: ReadonlyArray<{ id: string }>): (t: { id: string; date: string; type: TxType }) => string {
  const rank = new Map(saved.map((t, i) => [t.id, saved.length - i]));
  return (t) => `${t.date}#${AFTER_ACTIONS.has(t.type) ? 1 : 0}#${String(rank.get(t.id) ?? 0).padStart(7, "0")}`;
}
