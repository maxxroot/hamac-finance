import { describe, expect, it } from "vitest";
import { defaultParams } from "../model";
import { annuity, monteCarlo, project, type ProjectionInput } from "./projection";

/** Vecteur de non-régression (mécanique du sheet, montants fictifs) : 2026 → 2062, aucun versement en cours (bug du sheet). */
function sheetInput(): ProjectionInput {
  const params = defaultParams(new Date(2026, 10, 7));
  params.profile = { ...params.profile, birthYear: 1995, retirementAge: 67, securisationAge: 67, horizonAge: 92, startMonth: "2026-11" };
  params.returns = { livrets: 0.02, fondsEuros: 0.03, obligations: 0.04, actions: 0.06, inflation: 0.02, realReturnRetirement: 0.01 };
  params.allocation = { etfAtRetirement: 0.15 };
  params.livrets = { floor: 0, ceiling: 15000, driftAlert: 0.05 }; // plancher neutralisé : le sheet ne l'appliquait pas
  return {
    params,
    startYear: 2026,
    start: { livrets: 5000, fondsEuros: 0, obligations: 0, actions: 2626 },
    startContributed: 7300,
    contributions: () => ({ livrets: 0, fondsEuros: 0, obligations: 0, actions: 0 }),
    expenses: () => 0,
  };
}

describe("projection", () => {
  it("valeurs de non-régression (2027, 2061, 2062)", () => {
    const p = project(sheetInput());
    const at = (y: number) => p.rows.find((r) => r.year === y)!;
    expect(at(2027).livrets).toBeCloseTo(5100, 0);
    expect(at(2027).actions).toBeCloseTo(2783.56, 1);
    expect(at(2061).actions).toBeCloseTo(20184, -1);
    // 2062 : âge 67 = sécurisation = départ → ETF ramenés à 15 %, le reste en fonds euros.
    expect(at(2062).invested).toBeCloseTo(21395, -1);
    expect(at(2062).actions).toBeCloseTo(3209, -1);
    expect(at(2062).total).toBeCloseTo(31594, -1);
    expect(at(2062).real).toBeCloseTo(15488, -1);
  });

  it("revenu mensuel possible : 40 € d'aujourd'hui, 81 € en 2062", () => {
    const p = project(sheetInput());
    expect(p.income.investedToday).toBeCloseTo(10488, -1);
    expect(p.income.monthlyToday).toBeCloseTo(39.5, 0);
    expect(p.income.monthlyNominal).toBeCloseTo(81, 0);
  });

  it("la phase de retraits épuise le capital à l'âge horizon", () => {
    const p = project(sheetInput());
    expect(p.drawdown).toHaveLength(25);
    expect(p.drawdown.at(-1)!.capital).toBeLessThan(p.atRetirement.invested * 0.02);
  });

  it("utilise les versements prévus et plafonne les livrets", () => {
    const input = sheetInput();
    input.contributions = () => ({ livrets: 1200, fondsEuros: 0, obligations: 1200, actions: 1200 });
    const p = project(input);
    expect(Math.max(...p.rows.map((r) => r.livrets))).toBeLessThanOrEqual(15000 + 0.01);
    expect(p.rows.some((r) => r.excessToFe > 0)).toBe(true);
    expect(p.atRetirement.contributed).toBe(7300 + 36 * 3600);
  });

  it("respecte le plancher des livrets en puisant dans le fonds euros", () => {
    const input = sheetInput();
    input.params.livrets.floor = 5000;
    input.start.fondsEuros = 10000;
    input.expenses = (y) => (y === 2030 ? 3000 : 0);
    const r = project(input).rows.find((x) => x.year === 2030)!;
    expect(r.livrets).toBeCloseTo(5000, 0);
    expect(r.belowFloor).toBe(false);
  });

  it("annuité : formule PMT", () => {
    expect(annuity(1200, 0, 12)).toBe(100);
    expect(annuity(10000, 0.01, 12)).toBeCloseTo(888.49, 2);
  });

  it("fourchette Monte-Carlo ordonnée et reproductible", () => {
    const bands = monteCarlo(sheetInput(), 200);
    const last = bands.at(-1)!;
    expect(last.p10).toBeLessThan(last.p50);
    expect(last.p50).toBeLessThan(last.p90);
    expect(monteCarlo(sheetInput(), 200).at(-1)!.p50).toBe(last.p50);
  });

  it("les frais réduisent le patrimoine projeté, pas l'argent versé, et sont totalisés", () => {
    const base = sheetInput();
    base.contributions = () => ({ livrets: 0, fondsEuros: 1200, obligations: 0, actions: 0 });
    const withFees = { ...base, contributions: () => ({ livrets: 0, fondsEuros: 1176, obligations: 0, actions: 0 }), contributionFees: () => 24, feeDrag: { fondsEuros: 0.006 } };
    const a = project(base).atRetirement;
    const b = project(withFees).atRetirement;
    expect(b.contributed).toBeCloseTo(a.contributed, 6);
    expect(b.total).toBeLessThan(a.total);
    expect(b.fees).toBeGreaterThan(36 * 24);
  });
});

describe("autres classes dans la projection", () => {
  it("une classe avec un rendement attendu suit son taux et s'ajoute au total", () => {
    const base = sheetInput();
    const without = project(base, undefined, { drawdown: false }).rows;
    const withOther = project({ ...base, others: [{ key: "crowdlending", start: 1_000, rate: 0.08, contribution: () => 100 }] }, undefined, { drawdown: false }).rows;
    expect(withOther[0]!.others).toBe(1_000);
    expect(withOther[1]!.others).toBeCloseTo(1_180);
    expect(withOther[1]!.total - without[1]!.total).toBeCloseTo(1_180);
    expect(withOther[1]!.contributed - without[1]!.contributed).toBe(100);
  });
});
