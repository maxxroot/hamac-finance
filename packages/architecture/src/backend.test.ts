import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGraph } from "./graph";
import { checkBoundaries, formatReport } from "./rules";

/**
 * Frontières de @hamac/backend, à deux niveaux.
 * 1. Les dossiers : stockage (db) → cours de l'instance (market) → données du tenant (repo) → opérations (prices, backup) → handlers.
 *    À la racine : index.ts (dispatch), context.ts, testkit.ts, demo.ts.
 * 2. Les handlers d'un domaine n'appellent ceux d'un autre que dans le sens prévu (system → accounts → journal → assets).
 */

const ROOT = fileURLToPath(new URL("../../backend/src", import.meta.url));

const LAYERS: Record<string, number> = { db: 0, market: 1, repo: 2, prices: 3, backup: 3, handlers: 4 };
const domainOf = (file: string): string | null => (file.includes("/") ? file.split("/")[0]! : null);

const HANDLER_LAYERS: Record<string, number> = {
  assets: 0,
  exposure: 0,
  investments: 0,
  realestate: 0,
  loans: 0,
  "other-assets": 0,
  planning: 0,
  journal: 1,
  accounts: 2,
  system: 3,
};
/** Domaine d'un fichier de handlers ; les fichiers communs (_types, _shared) et l'assemblage (index) n'en ont pas. */
const handlerDomainOf = (file: string): string | null => {
  if (!file.startsWith("handlers/")) return null;
  const rest = file.slice("handlers/".length);
  const name = rest.split("/")[0]!.replace(/\.ts$/, "");
  return name.startsWith("_") || name === "index" ? null : name;
};

describe("frontières de @hamac/backend", () => {
  const graph = buildGraph(ROOT);

  it("chaque dossier est dans la table des couches", () => {
    expect([...new Set(graph.files.map(domainOf).filter((d) => d !== null && !(d in LAYERS)))]).toEqual([]);
  });

  it("les dossiers respectent les couches et n'ont aucun cycle", () => {
    expect(formatReport(checkBoundaries(graph, { layers: LAYERS, domainOf }))).toBe("");
  });

  it("chaque fichier de handlers appartient à un domaine connu", () => {
    expect([...new Set(graph.files.map(handlerDomainOf).filter((d) => d !== null && !(d in HANDLER_LAYERS)))]).toEqual([]);
  });

  it("les handlers ne s'appellent que dans le sens prévu", () => {
    const handlers = { ...graph, files: graph.files.filter((f) => f.startsWith("handlers/")) };
    const report = checkBoundaries(handlers, { layers: HANDLER_LAYERS, domainOf: handlerDomainOf });
    expect(formatReport({ ...report, fileCycles: report.fileCycles.filter((c) => c.every((f) => f.startsWith("handlers/"))) })).toBe("");
  });
});
