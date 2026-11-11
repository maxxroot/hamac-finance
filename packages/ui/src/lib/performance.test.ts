import { describe, expect, it } from "vitest";
import type { AssetPerformance, EnvelopePerformance } from "@hamac/core";
import { ALL_SCOPE, breakdownParts, envelopesForScope, heatShare, pctText, rankingView, type ScopeOptions } from "./performance";

const row = (key: string, accounts: string[] = []): EnvelopePerformance => ({ key, label: key, value: 0, inflow: 0, gain: 0, gainPct: null, annualized: null, annualizedReason: null, assumption: null, afterTax: null, accounts: accounts.map((a) => row(a)) });
const asset = (assetId: string, gain: number): AssetPerformance => ({ assetId, value: 0, gain, income: 0, rate: null });

describe("tableau par enveloppe selon le filtre", () => {
  const rows = [row("pea", ["p1", "p2"]), row("cto", ["c1"]), row("total")];
  it("garde le total seulement sur l'ensemble", () => {
    expect(envelopesForScope(rows, "all").map((r) => r.key)).toEqual(["pea", "cto", "total"]);
    expect(envelopesForScope(rows, "group:pea").map((r) => r.key)).toEqual(["pea"]);
  });
  it("sur un compte, ne garde que lui dans son enveloppe", () => {
    const [r] = envelopesForScope(rows, "account:p2");
    expect(r!.key).toBe("pea");
    expect(r!.accounts.map((a) => a.key)).toEqual(["p2"]);
  });
});

describe("détail du tableau année par année", () => {
  const options: ScopeOptions = {
    all: { key: ALL_SCOPE, label: "Tout", accountIds: ["p1", "p2", "c"] },
    groups: [
      { key: "group:pea", label: "PEA", accountIds: ["p1", "p2"] },
      { key: "group:cto", label: "Compte-titres", accountIds: ["c"] },
    ],
    accounts: [
      { key: "account:p1", label: "PEA 1", accountIds: ["p1"] },
      { key: "account:p2", label: "PEA 2", accountIds: ["p2"] },
      { key: "account:c", label: "CTO", accountIds: ["c"] },
    ],
  };
  it("par enveloppe sur tout le patrimoine, par compte dans une enveloppe, rien pour un compte seul", () => {
    expect(breakdownParts(options, options.all).map((o) => o.label)).toEqual(["PEA", "Compte-titres"]);
    expect(breakdownParts(options, options.groups[0]!).map((o) => o.label)).toEqual(["PEA 1", "PEA 2"]);
    expect(breakdownParts(options, options.groups[1]!)).toEqual([]);
    expect(breakdownParts(options, options.accounts[0]!)).toEqual([]);
  });
});

describe("classement des titres", () => {
  it("sépare les meilleurs des moins bons, sans doublon", () => {
    const { best, worst } = rankingView([asset("a", 9), asset("b", 7), asset("c", 2), asset("d", -3)], 2);
    expect(best.map((r) => r.assetId)).toEqual(["a", "b"]);
    expect(worst.map((r) => r.assetId)).toEqual(["d", "c"]);
  });
});

describe("affichage", () => {
  it("intensité bornée du calendrier", () => {
    expect(heatShare(0)).toBe(10);
    expect(heatShare(-0.03)).toBe(35);
    expect(heatShare(0.5)).toBe(60);
  });
  it("pourcentage signé", () => {
    expect(pctText(0.0123).replace(/\s/g, " ")).toBe("+1,2 %");
    expect(pctText(-0.5, 0).replace(/\s/g, " ")).toBe("-50 %");
  });
});
