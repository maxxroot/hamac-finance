import { describe, expect, it } from "vitest";
import { PlanParams, defaultParams, etfTarget, incomeTaxRate, normalizeParams, targetAllocation } from "./params";

describe("paramètres", () => {
  const p = defaultParams(new Date(2026, 10, 7));

  it("valeurs par défaut valides", () => {
    expect(PlanParams.safeParse(p).success).toBe(true);
  });

  it("désensibilisation linéaire (Paramètres!B27)", () => {
    const q = { ...p, profile: { ...p.profile, securisationAge: 57, retirementAge: 67 } };
    expect(etfTarget(q, 50)).toBe(0.3);
    expect(etfTarget(q, 62)).toBeCloseTo(0.225);
    expect(etfTarget(q, 67)).toBeCloseTo(0.15);
    expect(etfTarget(q, 70)).toBeCloseTo(0.15);
    const t = targetAllocation(q, 50);
    expect(t.garanti).toBeCloseTo(0.2);
  });

  it("sécurisation = départ : bascule au départ (cas du sheet 65/65)", () => {
    const q = { ...p, profile: { ...p.profile, securisationAge: 65, retirementAge: 65 } };
    expect(etfTarget(q, 64)).toBe(0.3);
    expect(etfTarget(q, 65)).toBe(0.15);
  });

  it("barème si plus avantageux", () => {
    expect(incomeTaxRate({ ...p, tax: { ...p.tax, tmi: 0 } })).toBe(0);
    expect(incomeTaxRate({ ...p, tax: { ...p.tax, tmi: 0.3 } })).toBe(0.128);
  });

  it("refuse des âges ou une allocation incohérents", () => {
    expect(PlanParams.safeParse({ ...p, profile: { ...p.profile, securisationAge: 70 } }).success).toBe(false);
    expect(PlanParams.safeParse({ ...p, allocation: { ...p.allocation, obligations: 0.8 } }).success).toBe(false);
  });

  it("complète des paramètres partiels", () => {
    const n = normalizeParams({ profile: { birthYear: 1995 } }, new Date(2026, 10, 7));
    expect(n.profile.birthYear).toBe(1995);
    expect(n.tax.socialGeneral).toBe(0.186);
  });
});
