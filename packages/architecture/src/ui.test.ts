import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGraph } from "./graph";
import { checkBoundaries, formatReport } from "./rules";

/**
 * Frontières de @hamac/ui : shared (kit visuel et accès aux données) → fonctionnalités (features/<domaine>) → app (coquille, routes, menu).
 * Entre fonctionnalités : entry (saisie : comptes, titres, opérations, premiers pas) → pages métier, indépendantes entre elles → dashboard.
 */

const ROOT = fileURLToPath(new URL("../../ui/src", import.meta.url));

const LAYERS: Record<string, number> = {
  shared: 0,
  entry: 1,
  accounts: 2,
  journal: 2,
  analysis: 2,
  investments: 2,
  realestate: 2,
  loans: 2,
  "other-assets": 2,
  planning: 2,
  tax: 2,
  settings: 2,
  help: 2,
  dashboard: 3,
  app: 4,
};

/** `features/<domaine>/…` → le domaine ; `shared/…` et `app/…` sont leur propre couche ; `main.tsx` n'en a pas. */
const domainOf = (file: string): string | null => {
  const [top, second] = file.split("/");
  if (top === "features") return second ?? null;
  return file.includes("/") ? top! : null;
};
/** Une fonctionnalité s'importe par sa façade ; shared et app n'en ont pas (rien n'importe app, sauf main.tsx). */
const facadeOf = (domain: string) => (domain === "shared" || domain === "app" ? null : `features/${domain}/index.ts`);

describe("frontières de @hamac/ui", () => {
  const graph = buildGraph(ROOT, { alias: { "@/": "" } });

  it("chaque fichier est dans une couche connue", () => {
    expect([...new Set(graph.files.map(domainOf).filter((d) => d !== null && !(d in LAYERS)))]).toEqual([]);
  });

  it("respecte les couches, passe par les façades et n'a aucun cycle", () => {
    expect(formatReport(checkBoundaries(graph, { layers: LAYERS, domainOf, facadeOf }))).toBe("");
  });
});
