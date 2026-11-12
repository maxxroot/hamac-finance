import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGraph } from "./graph";
import { checkBoundaries, formatReport } from "./rules";

/**
 * Frontières de @hamac/api : un dossier par domaine (`inputs.ts` + `procedures.ts`).
 * À la racine : `contract.ts` assemble les procédures, `common.ts` porte les briques de schémas, `transport.ts` l'enveloppe RPC.
 */

const ROOT = fileURLToPath(new URL("../../api/src", import.meta.url));

const LAYERS: Record<string, number> = {
  accounts: 0,
  assets: 0,
  exposure: 0,
  investments: 0,
  realestate: 0,
  loans: 0,
  "other-assets": 0,
  planning: 0,
  journal: 1,
  system: 2,
};

const domainOf = (file: string): string | null => (file.includes("/") ? file.split("/")[0]! : null);
const facadeOf = (domain: string) => `${domain}/index.ts`;

describe("frontières de @hamac/api", () => {
  const graph = buildGraph(ROOT);

  it("chaque fichier est à la racine ou dans un domaine de la table des couches", () => {
    expect(graph.files.filter((f) => domainOf(f) !== null && !(domainOf(f)! in LAYERS))).toEqual([]);
  });

  it("respecte les couches, passe par les façades et n'a aucun cycle", () => {
    expect(formatReport(checkBoundaries(graph, { layers: LAYERS, domainOf, facadeOf }))).toBe("");
  });
});
