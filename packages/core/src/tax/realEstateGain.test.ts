import { describe, expect, it } from "vitest";
import { gainSurtax, holdingAllowances, realEstateGain } from "./realEstateGain";

describe("plus-value immobilière", () => {
  it("abattements pour durée de détention : rien avant 6 ans, exonération après 22 et 30 ans", () => {
    expect(holdingAllowances(5)).toEqual({ incomeTax: 0, social: 0 });
    expect(holdingAllowances(10).incomeTax).toBeCloseTo(0.3, 10);
    expect(holdingAllowances(10).social).toBeCloseTo(0.0825, 10);
    expect(holdingAllowances(21).incomeTax).toBeCloseTo(0.96, 10);
    expect(holdingAllowances(22)).toMatchObject({ incomeTax: 1 });
    expect(holdingAllowances(22).social).toBeCloseTo(0.28, 10);
    expect(holdingAllowances(25).social).toBeCloseTo(0.55, 10);
    expect(holdingAllowances(30)).toEqual({ incomeTax: 1, social: 1 });
  });

  it("surtaxe : au-delà de 50 000 €, avec lissage", () => {
    expect(gainSurtax(50_000)).toBe(0);
    expect(gainSurtax(55_000)).toBeCloseTo(1_100 - 250, 6);
    expect(gainSurtax(80_000)).toBeCloseTo(1_600, 6);
    expect(gainSurtax(300_000)).toBeCloseTo(18_000, 6);
  });

  it("forfaits de frais et de travaux, abattements, 19 % + 17,2 %", () => {
    // Acheté 100 000 € en 2014, vendu 160 000 € en 2026 : 12 ans.
    const pv = realEstateGain({ purchaseDate: "2014-03-01", saleDate: "2026-06-01", purchasePrice: 100_000, acquisitionFees: 6_000, works: 0, salePrice: 160_000, saleFees: 0, amortization: 0 });
    // 100 000 + 7 500 de frais forfaitaires + 15 000 de travaux forfaitaires.
    expect(pv).toMatchObject({ years: 12, acquisition: 122_500, gain: 37_500 });
    // Abattements : 42 % pour l'impôt, 11,55 % pour les prélèvements sociaux.
    expect(pv.incomeTax).toBeCloseTo(37_500 * 0.58 * 0.19, 2);
    expect(pv.social).toBeCloseTo(37_500 * 0.8845 * 0.172, 1);
    expect(pv.surtax).toBe(0);
  });

  it("meublé : les amortissements déduits augmentent la plus-value ; pas de forfait travaux avant 6 ans ; moins-value à zéro", () => {
    const base = { purchaseDate: "2022-01-01", saleDate: "2026-06-01", purchasePrice: 100_000, acquisitionFees: 8_000, works: 0, salePrice: 120_000, saleFees: 2_000, amortization: 0 };
    expect(realEstateGain(base).gain).toBe(10_000);
    expect(realEstateGain({ ...base, amortization: 15_000 }).gain).toBe(25_000);
    expect(realEstateGain({ ...base, salePrice: 90_000 })).toMatchObject({ gain: 0, total: 0 });
  });
});
