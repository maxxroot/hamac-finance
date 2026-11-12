import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Documentation : aucun lien cassé entre fichiers, aucun chemin du dépôt cité qui n'existe plus.
 * Le cahier des charges (privé, ignoré par git) n'est pas lu. Le plan de réorganisation cite volontairement
 * d'anciens chemins pour raconter le chantier : seuls ses liens sont vérifiés.
 */

const REPO = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const SKIP_DIRS = new Set(["cahier-des-charges"]);
const HISTORY = new Set(["docs/architecture/plan-migration-structure.md"]);

function markdownFiles(): string[] {
  const out = ["README.md"];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(REPO, dir))) {
      const path = join(dir, name);
      if (statSync(join(REPO, path)).isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(path);
      } else if (name.endsWith(".md")) out.push(path);
    }
  };
  walk("docs");
  return out.sort();
}

/** Liens Markdown relatifs `[texte](chemin)`, sans les adresses web ni les ancres seules. */
export function relativeLinks(text: string): string[] {
  const links: string[] = [];
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1]!.split("#")[0]!;
    if (target && !/^[a-z]+:/i.test(target)) links.push(decodeURI(target));
  }
  return links;
}

/** Chemins du dépôt cités entre accents graves : `packages/…`, `apps/…`, `docs/…`, sans gabarit (<domaine>, *). */
export function citedPaths(text: string): string[] {
  const paths: string[] = [];
  for (const m of text.matchAll(/`((?:packages|apps|docs)\/[^`\s]+)`/g)) {
    const path = m[1]!.replace(/[.,;:)]+$/, "").replace(/#.*$/, "");
    if (/[<>*{}]/.test(path) || path.includes("…")) continue;
    paths.push(path.replace(/\/$/, ""));
  }
  return paths;
}

describe("documentation", () => {
  const files = markdownFiles();

  it("aucun lien relatif cassé", () => {
    const broken: string[] = [];
    for (const file of files) {
      for (const link of relativeLinks(readFileSync(join(REPO, file), "utf8"))) {
        if (!existsSync(join(REPO, dirname(file), link))) broken.push(`${file} → ${link}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("aucun chemin cité qui n'existe plus", () => {
    const missing: string[] = [];
    for (const file of files) {
      if (HISTORY.has(file)) continue;
      for (const path of citedPaths(readFileSync(join(REPO, file), "utf8"))) {
        if (!existsSync(join(REPO, path))) missing.push(`${file} : ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("chaque sujet a son guide et sa documentation technique", () => {
    const docs = join(REPO, "docs");
    const subjects = readdirSync(docs).filter((d) => statSync(join(docs, d)).isDirectory() && !SKIP_DIRS.has(d));
    // Dossiers qui ne sont pas des sujets : architecture générale, décisions, propositions, captures d'écran.
    const general = new Set(["architecture", "decisions", "propositions", "captures"]);
    const incomplete = subjects
      .filter((d) => !general.has(d))
      .filter((d) => !existsSync(join(docs, d, "technique.md")) || (!existsSync(join(docs, d, "guide.md")) && !NO_GUIDE.has(d)))
      .map((d) => relative(REPO, join(docs, d)));
    expect(incomplete).toEqual([]);
  });
});

/** Sujets sans surface pour l'utilisateur : la documentation technique suffit. */
const NO_GUIDE = new Set(["frontieres-du-code"]);
