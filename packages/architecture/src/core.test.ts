import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGraph } from "./graph";
import { checkBoundaries, forbiddenPackages, formatReport } from "./rules";

/**
 * Frontières de @hamac/core (plan : docs/architecture/plan-migration-structure.md, § 3.1 et 3.2).
 * Le domaine d'un fichier se lit dans son chemin (`realestate/leases.ts`). Bloquant : un écart fait échouer la CI.
 */

const ROOT = fileURLToPath(new URL("../../core/src", import.meta.url));

/** Couches, de bas en haut. */
const LAYERS: Record<string, number> = {
  base: 0,
  model: 1,
  loans: 2,
  investments: 3,
  "other-assets": 3,
  realestate: 3,
  portfolio: 4,
  tax: 5,
  analysis: 6,
  planning: 6,
  imports: 6,
  alerts: 7,
};

/** Le domaine d'un fichier est son premier dossier ; la façade racine `index.ts` n'appartient à aucun. */
const domainOf = (file: string): string | null => (file.includes("/") ? file.split("/")[0]! : null);
const facadeOf = (domain: string) => `${domain}/index.ts`;

describe("frontières de @hamac/core", () => {
  const graph = buildGraph(ROOT);

  it("aucun module livré n'importe Node : core tourne dans le navigateur", () => {
    expect(forbiddenPackages(graph, (s) => s.startsWith("node:"))).toEqual([]);
  });

  it("chaque module est rangé dans un domaine de la table des couches", () => {
    expect(graph.files.filter((f) => f !== "index.ts" && !(domainOf(f)! in LAYERS))).toEqual([]);
  });

  it("respecte les couches, passe par les façades et n'a aucun cycle", () => {
    expect(formatReport(checkBoundaries(graph, { layers: LAYERS, domainOf, facadeOf }))).toBe("");
  });
});
