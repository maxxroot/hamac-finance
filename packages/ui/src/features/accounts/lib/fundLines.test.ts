import { describe, expect, it } from "vitest";
import type { AccountState, Asset, FundRate } from "@hamac/core";
import { fundLines, weightedAverageRate } from "./fundLines";

const fund = (id: string) => ({ id, kind: "fonds_euros", name: id }) as Asset;
const contract = (id: string, defaultAssetId: string | null, held: Array<[string, number]>) =>
  ({ account: { id, defaultAssetId }, positions: held.map(([a, value]) => ({ asset: fund(a), value, income: value / 100 })) }) as unknown as AccountState;
const rate = (accountId: string, assetId: string, year: number, r: number): FundRate => ({ accountId, assetId, year, rate: r, comment: "" });
const assets = new Map(["F1", "F2", "F3"].map((id) => [id, fund(id)]));

describe("lignes de fonds euros", () => {
  it("une ligne par fonds et par contrat : le support par défaut, les fonds détenus et ceux qui ont des taux", () => {
    const a = contract("A", "F1", [["F1", 1000]]);
    const b = contract("B", "F1", [["F2", 500]]);
    const lines = fundLines([a, b], [rate("B", "F3", 2024, 0.02), rate("A", "F1", 2024, 0.03), rate("A", "F1", 2023, 0.02)], assets);
    expect(lines.map((l) => [l.key, l.balance, l.isDefault])).toEqual([
      ["A:F1", 1000, true],
      ["B:F1", 0, true],
      ["B:F2", 500, false],
      ["B:F3", 0, false],
    ]);
    // Taux du fonds dans ce contrat seulement, du plus ancien au plus récent.
    expect(lines[0]!.rates.map((r) => r.year)).toEqual([2023, 2024]);
    expect(lines[0]!.lastRate?.rate).toBe(0.03);
    expect(lines[0]!.avgRate).toBeCloseTo(0.025);
    expect(lines[1]!.rates).toEqual([]);
  });

  it("taux moyen pondéré par le solde, sans les fonds vides ou sans taux", () => {
    const a = contract("A", "F1", [["F1", 3000]]);
    const b = contract("B", "F2", [["F2", 1000]]);
    const lines = fundLines([a, b], [rate("A", "F1", 2024, 0.02), rate("B", "F2", 2024, 0.04), rate("B", "F3", 2024, 0.1)], assets);
    // (3 000 × 2 % + 1 000 × 4 %) / 4 000 = 2,5 % ; le fonds F3, vide, ne compte pas.
    expect(weightedAverageRate(lines)).toBeCloseTo(0.025);
    expect(weightedAverageRate([])).toBeNull();
  });
});
