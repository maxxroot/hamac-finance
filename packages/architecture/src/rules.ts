import { findCycles, type SourceGraph } from "./graph";

/**
 * Règles de frontières entre domaines : sens des couches, passage par la façade, absence de cycles.
 * Chaque paquet décrit ses domaines (nom → couche) et la façon de lire le domaine d'un fichier.
 */

export interface LayerRules {
  /** Couche de chaque domaine : un domaine n'importe que des couches strictement inférieures. */
  layers: Record<string, number>;
  /** Domaine d'un fichier (chemin relatif à la racine), ou null s'il est hors domaine (façade racine…). */
  domainOf: (file: string) => string | null;
  /** Fichier façade d'un domaine (ex. `realestate/index.ts`) ; absent = pas de règle de façade. */
  facadeOf?: (domain: string) => string;
  /** Imports permis entre deux domaines de la même couche (ou à rebours), « de → vers », chacun justifié. */
  allowed?: ReadonlyArray<readonly [string, string]>;
}

export interface Violation {
  kind: "couche" | "facade" | "domaine-inconnu";
  from: string;
  to: string;
  detail: string;
}

export interface BoundaryReport {
  violations: Violation[];
  /** Cycles entre domaines. */
  domainCycles: string[][];
  /** Cycles entre fichiers (y compris à l'intérieur d'un domaine). */
  fileCycles: string[][];
}

export function checkBoundaries(graph: SourceGraph, rules: LayerRules): BoundaryReport {
  const allowed = new Set((rules.allowed ?? []).map(([a, b]) => `${a}→${b}`));
  const violations: Violation[] = [];
  const domainEdges: Array<[string, string]> = [];

  for (const file of graph.files) {
    const d = rules.domainOf(file);
    if (d !== null && !(d in rules.layers)) violations.push({ kind: "domaine-inconnu", from: file, to: file, detail: `domaine « ${d} » absent de la table des couches` });
  }

  for (const edge of graph.edges) {
    const from = rules.domainOf(edge.from);
    const to = rules.domainOf(edge.to);
    if (from === null || to === null || from === to) continue;
    if (!(from in rules.layers) || !(to in rules.layers)) continue;
    domainEdges.push([from, to]);
    if (rules.layers[to]! >= rules.layers[from]! && !allowed.has(`${from}→${to}`)) {
      const sens = rules.layers[to] === rules.layers[from] ? "même couche" : "couche supérieure";
      violations.push({ kind: "couche", from: edge.from, to: edge.to, detail: `${from} → ${to} (${sens})` });
    }
    if (rules.facadeOf && edge.to !== rules.facadeOf(to)) {
      violations.push({ kind: "facade", from: edge.from, to: edge.to, detail: `${from} importe un fichier interne de ${to} au lieu de ${rules.facadeOf(to)}` });
    }
  }

  const domains = Object.keys(rules.layers);
  return {
    violations,
    domainCycles: findCycles(domains, domainEdges),
    fileCycles: findCycles(graph.files, graph.edges.map((e) => [e.from, e.to] as const)),
  };
}

/** Rapport lisible, une ligne par problème, pour les messages d'échec et le mode « rapport ». */
export function formatReport(report: BoundaryReport): string {
  const lines: string[] = [];
  for (const v of report.violations) lines.push(`[${v.kind}] ${v.from} → ${v.to} : ${v.detail}`);
  for (const c of report.domainCycles) lines.push(`[cycle de domaines] ${c.join(" ↔ ")}`);
  for (const c of report.fileCycles) lines.push(`[cycle de fichiers] ${c.join(" ↔ ")}`);
  return lines.join("\n");
}

/** Fichiers qui importent un paquet interdit (ex. « node: » dans le code livré au navigateur). */
export function forbiddenPackages(graph: SourceGraph, forbidden: (specifier: string) => boolean): string[] {
  const out: string[] = [];
  for (const [file, specs] of graph.packages) for (const s of specs) if (forbidden(s)) out.push(`${file} importe ${s}`);
  return out.sort();
}
