import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

/**
 * Graphe des imports relatifs d'un dossier source : qui importe qui, à partir du texte des fichiers.
 * Les imports de paquets (`zod`, `@hamac/core`) sont ignorés : seules les frontières internes comptent.
 */

/** Un import relatif d'un fichier vers un autre, chemins relatifs à la racine analysée, en « / ». */
export interface ImportEdge {
  from: string;
  to: string;
  /** `import type …` ou `export type … from` : effacé à la compilation. */
  typeOnly: boolean;
}

export interface SourceGraph {
  /** Fichiers analysés (hors tests), chemins relatifs à la racine. */
  files: string[];
  edges: ImportEdge[];
  /** Spécificateurs de paquets importés, par fichier (pour les règles du type « pas de node: »). */
  packages: Map<string, string[]>;
}

const SOURCE = /\.(ts|tsx)$/;
const TEST = /\.(test|fixture)\.(ts|tsx)$|\.flow\.test\.tsx$/;

/** Fichiers source d'un dossier, récursivement, sans les tests ni les fichiers générés. */
export function sourceFiles(root: string, options: { includeTests?: boolean } = {}): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (SOURCE.test(name) && !name.endsWith(".d.ts") && (options.includeTests || !TEST.test(name))) out.push(toPosix(relative(root, path)));
    }
  };
  walk(root);
  return out.sort();
}

/** Spécificateurs importés par un texte source : import, export … from, import() et import "x". */
export function parseImports(source: string): Array<{ specifier: string; typeOnly: boolean }> {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const found: Array<{ specifier: string; typeOnly: boolean }> = [];
  const fromClause = /\b(import|export)\s+(type\s+)?[^;'"]*?\bfrom\s*["']([^"']+)["']/g;
  for (const m of text.matchAll(fromClause)) found.push({ specifier: m[3]!, typeOnly: Boolean(m[2]) });
  for (const m of text.matchAll(/\bimport\s*["']([^"']+)["']/g)) found.push({ specifier: m[1]!, typeOnly: false });
  for (const m of text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) found.push({ specifier: m[1]!, typeOnly: false });
  return found;
}

/** Construit le graphe d'un dossier ; `alias` traduit un préfixe (ex. « @/ ») en chemin relatif à la racine. */
export function buildGraph(root: string, options: { alias?: Record<string, string>; includeTests?: boolean } = {}): SourceGraph {
  const absRoot = resolve(root);
  const files = sourceFiles(absRoot, options);
  const edges: ImportEdge[] = [];
  const packages = new Map<string, string[]>();
  for (const file of files) {
    const text = readFileSync(join(absRoot, file), "utf8");
    for (const { specifier, typeOnly } of parseImports(text)) {
      const local = localPath(file, specifier, options.alias ?? {});
      if (local === null) {
        packages.set(file, [...(packages.get(file) ?? []), specifier]);
        continue;
      }
      const target = resolveFile(absRoot, local);
      if (target !== null) edges.push({ from: file, to: target, typeOnly });
    }
  }
  return { files, edges, packages };
}

/** Chemin (relatif à la racine, sans extension) visé par un spécificateur local, ou null pour un paquet. */
function localPath(file: string, specifier: string, alias: Record<string, string>): string | null {
  for (const [prefix, target] of Object.entries(alias)) {
    if (specifier.startsWith(prefix)) return toPosix(join(target, specifier.slice(prefix.length)));
  }
  if (!specifier.startsWith(".")) return null;
  return toPosix(join(dirname(file), specifier));
}

/** Fichier réel derrière un chemin d'import : extension implicite ou index d'un dossier. */
function resolveFile(absRoot: string, path: string): string | null {
  const bare = path.replace(/\.(js|ts|tsx)$/, "");
  for (const candidate of [path, `${bare}.ts`, `${bare}.tsx`, `${bare}/index.ts`, `${bare}/index.tsx`]) {
    const abs = join(absRoot, candidate);
    if (existsSync(abs) && statSync(abs).isFile()) return toPosix(candidate);
  }
  return null;
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/**
 * Cycles du graphe (composantes fortement connexes de plus d'un nœud, ou boucle sur soi),
 * par l'algorithme de Tarjan. Chaque cycle est trié pour un rapport stable.
 */
export function findCycles<T extends string>(nodes: readonly T[], edges: ReadonlyArray<readonly [T, T]>): T[][] {
  const next = new Map<T, T[]>(nodes.map((n) => [n, []]));
  const selfLoops = new Set<T>();
  for (const [a, b] of edges) {
    if (a === b) selfLoops.add(a);
    else next.get(a)?.push(b);
  }
  const index = new Map<T, number>();
  const low = new Map<T, number>();
  const stack: T[] = [];
  const onStack = new Set<T>();
  const cycles: T[][] = [];
  let counter = 0;
  const visit = (v: T) => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of next.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) === index.get(v)) {
      const component: T[] = [];
      let w: T;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1 || selfLoops.has(v)) cycles.push(component.sort());
    }
  };
  for (const n of nodes) if (!index.has(n)) visit(n);
  return cycles.sort((a, b) => a[0]!.localeCompare(b[0]!));
}
