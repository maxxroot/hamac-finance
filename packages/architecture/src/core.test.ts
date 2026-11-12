import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGraph } from "./graph";
import { checkBoundaries, forbiddenPackages, formatReport } from "./rules";

/**
 * Frontières de @hamac/core (plan : docs/architecture/plan-migration-structure.md, § 3.1 et 3.2).
 * Étape 0 : les fichiers sont encore à plat ; leur domaine prévu est lu dans PLANNED.
 * Le test ne fait que rapporter les écarts au plan, sans échouer, sauf pour les règles déjà tenues.
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

/** Domaine prévu de chaque module, tant que les fichiers ne sont pas déplacés. */
const PLANNED: Record<string, string> = {
  money: "base", dates: "base", xirr: "base", fees: "base",
  domain: "model", params: "model", validation: "model", ownership: "model", schedule: "model", prices: "model",
  allocations: "model", institutions: "model", protection: "model", rates: "model",
  debt: "loans",
  bonds: "investments", bondnames: "investments", crowdlending: "investments",
  otherAssets: "other-assets",
  realestate: "realestate", lots: "realestate", leases: "realestate", renters: "realestate", rental: "realestate",
  rentalPark: "realestate", irl: "realestate", energy: "realestate", rentNotices: "realestate",
  engine: "portfolio", history: "portfolio", reconciliation: "portfolio", counters: "portfolio", securitiesGains: "portfolio",
  performance: "analysis", timeline: "analysis", concentration: "analysis", exposure: "analysis",
  fiscalRules: "tax", taxes: "tax", taxReport: "tax", accountTaxes: "tax", yearEnd: "tax",
  projection: "planning", goals: "planning", contributions: "planning", allocationTargets: "planning",
  simulation: "planning", simulators: "planning",
  csv: "imports", statementImport: "imports", bricksImport: "imports",
  alerts: "alerts",
};

const domainOf = (file: string): string | null => {
  if (file === "index.ts") return null;
  return PLANNED[file.replace(/\.ts$/, "")] ?? "?";
};

describe("frontières de @hamac/core", () => {
  const graph = buildGraph(ROOT);

  it("aucun module livré n'importe Node : core tourne dans le navigateur", () => {
    expect(forbiddenPackages(graph, (s) => s.startsWith("node:"))).toEqual([]);
  });

  it("chaque module a un domaine prévu", () => {
    expect(graph.files.filter((f) => domainOf(f) === "?")).toEqual([]);
  });

  it("rapport des écarts au plan (étape 0 : n'échoue pas)", () => {
    const report = checkBoundaries(graph, { layers: LAYERS, domainOf });
    const text = formatReport(report);
    if (text) console.info(`Écarts au plan de @hamac/core :\n${text}`);
    expect(report).toBeDefined();
  });
});
