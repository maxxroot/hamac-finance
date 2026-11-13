import { describe, expect, it } from "vitest";
import { defaultRecoverableRate, ownerAmount, rateFromAmount, recoverableAmount } from "./expenses";

describe("part récupérable des dépenses", () => {
  it("copropriété : la part des réglages est proposée ; ailleurs, rien", () => {
    expect(defaultRecoverableRate("copropriete", 2 / 3)).toBeCloseTo(2 / 3, 10);
    expect(defaultRecoverableRate("taxe_fonciere", 2 / 3)).toBe(0);
    expect(defaultRecoverableRate("assurance", 2 / 3)).toBe(0);
  });

  it("montant récupérable et reste à la charge du propriétaire", () => {
    const copro = { amount: 1_800, recoverableRate: 2 / 3, improvement: false };
    expect(recoverableAmount(copro)).toBe(1_200);
    expect(ownerAmount(copro)).toBe(600);
    // Une amélioration reste au propriétaire, quelle que soit la part saisie.
    expect(recoverableAmount({ ...copro, improvement: true })).toBe(0);
  });

  it("TEOM saisie en montant : convertie en part de la taxe foncière, bornée entre 0 et 1", () => {
    expect(rateFromAmount(180, 1_200)).toBeCloseTo(0.15, 10);
    expect(recoverableAmount({ amount: 1_200, recoverableRate: rateFromAmount(180, 1_200), improvement: false })).toBe(180);
    expect(rateFromAmount(2_000, 1_200)).toBe(1);
    expect(rateFromAmount(100, 0)).toBe(0);
  });
});
