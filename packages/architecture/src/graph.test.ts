import { describe, expect, it } from "vitest";
import { findCycles, parseImports } from "./graph";
import { checkBoundaries } from "./rules";

describe("lecture des imports", () => {
  it("reconnaît les formes d'import et d'export, et les imports de types", () => {
    const source = [
      `import { a } from "./a";`,
      `import type { B } from './b';`,
      `export * from "./c";`,
      `export type { D } from "./d";`,
      `import "./e.css";`,
      `const f = () => import("./f");`,
      `import {`,
      `  g,`,
      `  type H,`,
      `} from "../g";`,
      `// import { x } from "./commente";`,
      `/* import { y } from "./bloc"; */`,
      `const url = "https://exemple.fr"; import { z } from "zod";`,
    ].join("\n");
    expect(parseImports(source)).toEqual([
      { specifier: "./a", typeOnly: false },
      { specifier: "./b", typeOnly: true },
      { specifier: "./c", typeOnly: false },
      { specifier: "./d", typeOnly: true },
      { specifier: "../g", typeOnly: false },
      { specifier: "zod", typeOnly: false },
      { specifier: "./e.css", typeOnly: false },
      { specifier: "./f", typeOnly: false },
    ]);
  });
});

describe("cycles", () => {
  it("trouve les cycles et les boucles sur soi, ignore les chaînes", () => {
    const cycles = findCycles(["a", "b", "c", "d", "e"], [["a", "b"], ["b", "c"], ["c", "a"], ["d", "e"], ["e", "e"]]);
    expect(cycles).toEqual([["a", "b", "c"], ["e"]]);
  });
});

describe("règles de couches", () => {
  const graph = {
    files: ["low/index.ts", "low/x.ts", "high/index.ts", "high/y.ts", "peer/index.ts"],
    edges: [
      { from: "high/y.ts", to: "low/index.ts", typeOnly: false },
      { from: "high/y.ts", to: "low/x.ts", typeOnly: false },
      { from: "low/x.ts", to: "high/index.ts", typeOnly: true },
      { from: "peer/index.ts", to: "high/index.ts", typeOnly: false },
    ],
    packages: new Map(),
  };
  const rules = {
    layers: { low: 0, high: 1, peer: 1 },
    domainOf: (f: string) => f.split("/")[0]!,
    facadeOf: (d: string) => `${d}/index.ts`,
  };

  it("signale les imports vers le haut, entre pairs, et hors façade", () => {
    const report = checkBoundaries(graph, rules);
    expect(report.violations.map((v) => `${v.kind} ${v.detail.split(" (")[0]!.split(" importe")[0]}`)).toEqual([
      "facade high",
      "couche low → high",
      "couche peer → high",
    ]);
    expect(report.domainCycles).toEqual([["high", "low"]]);
  });

  it("laisse passer une exception déclarée", () => {
    const report = checkBoundaries(graph, { ...rules, allowed: [["peer", "high"]] });
    expect(report.violations.some((v) => v.from.startsWith("peer"))).toBe(false);
  });
});
