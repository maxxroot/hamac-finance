import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGraph } from "./graph";
import { checkBoundaries, formatReport } from "./rules";

/**
 * Frontières d'apps/server : auth (mots de passe, comptes, double authentification) → http (Hono) et cli (commandes).
 * À la racine : les points d'entrée cités par tsup.config.ts (main.ts, cli.ts) et env.ts.
 */

const ROOT = fileURLToPath(new URL("../../../apps/server/src", import.meta.url));
const LAYERS: Record<string, number> = { auth: 0, http: 1, cli: 1 };
const domainOf = (file: string): string | null => (file.includes("/") ? file.split("/")[0]! : null);

describe("frontières d'apps/server", () => {
  const graph = buildGraph(ROOT);

  it("chaque dossier est dans la table des couches", () => {
    expect([...new Set(graph.files.map(domainOf).filter((d) => d !== null && !(d in LAYERS)))]).toEqual([]);
  });

  it("respecte les couches et n'a aucun cycle", () => {
    expect(formatReport(checkBoundaries(graph, { layers: LAYERS, domainOf }))).toBe("");
  });
});
