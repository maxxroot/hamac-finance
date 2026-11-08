import { describe, expect, it } from "vitest";
import { PlanParams, classTargets, defaultParams, etfTarget, incomeTaxRate, normalizeParams, targetAllocation } from "./params";

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

  it("gestion de patrimoine : allocation fixe, contrôles de retraite ignorés", () => {
    const q = { ...p, profile: { ...p.profile, goal: "patrimoine" as const, securisationAge: 57, retirementAge: 67 } };
    expect(etfTarget(q, 50)).toBe(0.3);
    expect(etfTarget(q, 70)).toBe(0.3);
    // Part actions sous l'ancienne part « au départ » et âges incohérents : sans objet ici.
    const r = { ...q, profile: { ...q.profile, securisationAge: 70, horizonAge: 60 }, allocation: { ...q.allocation, etfBefore: 0.1, etfAtRetirement: 0.6 } };
    expect(PlanParams.safeParse(r).success).toBe(true);
    expect(PlanParams.safeParse({ ...r, profile: { ...r.profile, goal: "retraite" } }).success).toBe(false);
  });

  it("anciens paramètres : plan de retraite par défaut", () => {
    expect(normalizeParams({ profile: { birthYear: 1995 } }, new Date(2026, 10, 7)).profile.goal).toBe("retraite");
  });

  it("classes personnalisées : prises sur la cible de base, réduites si elle baisse avec l'âge", () => {
    const or = { id: "or", label: "Or", color: "#e0a458", behavesLike: "croissance" as const, target: 0.2 };
    const q = { ...p, customClasses: [or] };
    const young = classTargets(q, 40);
    expect(young.find((c) => c.key === "or")?.target).toBeCloseTo(0.2);
    expect(young.find((c) => c.key === "croissance")?.target).toBeCloseTo(0.1);
    expect(young.reduce((s, c) => s + c.target, 0)).toBeCloseTo(1);
    const old = classTargets({ ...q, profile: { ...q.profile, securisationAge: 57, retirementAge: 64 } }, 64);
    expect(old.find((c) => c.key === "or")?.target).toBeCloseTo(0.15);
    expect(old.find((c) => c.key === "croissance")?.target).toBeCloseTo(0);
    expect(PlanParams.safeParse({ ...q, customClasses: [{ ...or, target: 0.4 }] }).success).toBe(false);
    expect(normalizeParams({}, new Date(2026, 10, 7)).customClasses).toEqual([]);
  });

  it("modules : tous affichés par défaut, y compris depuis d'anciens paramètres", () => {
    const n = normalizeParams({ modules: { crypto: false } }, new Date(2026, 10, 7));
    expect(n.modules.crypto).toBe(false);
    expect(n.modules.livrets).toBe(true);
    expect(normalizeParams({}, new Date(2026, 10, 7)).modules.impots).toBe(true);
  });
});
