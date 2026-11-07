import { describe, expect, it } from "vitest";
import { sortRows } from "./sortRows";

const rows = [
  { n: "Livret A", v: 300 },
  { n: "élan", v: null },
  { n: "Assurance-vie", v: 1200.5 },
  { n: "PEA", v: -50 },
  { n: "CTO", v: 300 },
];

describe("tri des tableaux", () => {
  it("trie les nombres dans les deux sens, valeurs manquantes en fin", () => {
    expect(sortRows(rows, (r) => r.v, "desc").map((r) => r.n)).toEqual(["Assurance-vie", "Livret A", "CTO", "PEA", "élan"]);
    expect(sortRows(rows, (r) => r.v, "asc").map((r) => r.n)).toEqual(["PEA", "Livret A", "CTO", "Assurance-vie", "élan"]);
  });
  it("trie le texte à la française (accents, casse)", () => {
    expect(sortRows(rows, (r) => r.n, "asc").map((r) => r.n)).toEqual(["Assurance-vie", "CTO", "élan", "Livret A", "PEA"]);
  });
  it("trie les dates ISO et conserve l'ordre d'origine à égalité", () => {
    const d = [{ d: "2026-02-01", k: 1 }, { d: "2025-12-31", k: 2 }, { d: "2026-02-01", k: 3 }];
    expect(sortRows(d, (r) => r.d, "desc").map((r) => r.k)).toEqual([1, 3, 2]);
  });
  it("ne modifie pas le tableau d'origine", () => {
    const copy = [...rows];
    sortRows(rows, (r) => r.v, "asc");
    expect(rows).toEqual(copy);
  });
});
