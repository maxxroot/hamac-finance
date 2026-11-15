import { describe, expect, it } from "vitest";
import { PlanParams, classTargets, defaultParams, etfTarget, incomeTaxRate, normalizeParams, withholdingDispensed } from "./params";

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
    const t = classTargets(q, 62);
    expect(t.find((c) => c.key === "croissance")?.target).toBeCloseTo(0.225);
    expect(t.find((c) => c.key === "garanti")?.target).toBeCloseTo(0.275);
    expect(t.filter((c) => c.inAllocation).reduce((s, c) => s + c.target, 0)).toBeCloseTo(1);
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
    expect(PlanParams.safeParse({ ...p, targets: p.targets.map((l) => (l.key === "obligations" ? { ...l, target: 0.8 } : l)) }).success).toBe(false);
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
    const r = { ...q, profile: { ...q.profile, securisationAge: 70, horizonAge: 60 }, allocation: { etfAtRetirement: 0.6 } };
    expect(PlanParams.safeParse(r).success).toBe(true);
    expect(PlanParams.safeParse({ ...r, profile: { ...r.profile, goal: "retraite" } }).success).toBe(false);
  });

  it("anciens paramètres : plan de retraite par défaut", () => {
    expect(normalizeParams({ profile: { birthYear: 1995 } }, new Date(2026, 10, 7)).profile.goal).toBe("retraite");
  });

  it("reprise des anciens réglages : parts de base, classes personnalisées, cibles sur des comptes retirées", () => {
    const n = normalizeParams({
      allocation: { etfBefore: 0.4, etfAtRetirement: 0.1, obligations: 0.4 },
      customClasses: [{ id: "or", label: "Or", color: "#e0a458", behavesLike: "croissance", target: 0.1 }],
      customAllocations: [
        { id: "a", label: "", target: { kind: "type", accountKind: "livret" }, asTarget: true, asContribution: true, share: 0.2, limit: null, overflowTo: null },
        { id: "b", label: "Ma cible", target: { kind: "compte", accountId: "x" }, asTarget: true, asContribution: false, share: 0.1, limit: null, overflowTo: null },
      ],
    }, new Date(2026, 10, 7));
    const target = (k: string) => n.targets.find((l) => l.key === k);
    expect(target("croissance")).toMatchObject({ inAllocation: true, target: 0.3 });
    expect(target("or")).toMatchObject({ inAllocation: true, target: 0.1 });
    expect(target("obligations")?.target).toBeCloseTo(0.4);
    expect(target("garanti")?.target).toBeCloseTo(0.2);
    expect(target("precaution")).toMatchObject({ inAllocation: false, target: 0 });
    expect(n.customClasses).toEqual([{ id: "or", label: "Or", color: "#e0a458" }]);
    expect(n.customAllocations.map((r) => r.id)).toEqual(["a"]);
    expect(n.removedTargets).toEqual([{ label: "Livret", share: 0.2 }, { label: "Ma cible", share: 0.1 }]);
    expect(normalizeParams({}, new Date(2026, 10, 7)).customClasses).toEqual([]);
  });

  it("ligne Liquidités ajoutée, hors allocation, aux répartitions enregistrées avant elle", () => {
    const stored = { targets: defaultParams(new Date(2026, 10, 7)).targets.filter((l) => l.key !== "liquidites").map((l) => (l.key === "croissance" ? { ...l, target: 0.4 } : l.key === "obligations" ? { ...l, target: 0.4 } : l)) };
    const n = normalizeParams(stored, new Date(2026, 10, 7));
    expect(n.targets.find((l) => l.key === "liquidites")).toEqual({ key: "liquidites", inAllocation: false, target: 0, expectedReturn: null });
    expect(n.targets.find((l) => l.key === "croissance")?.target).toBe(0.4);
    expect(n.targets.filter((l) => l.key === "liquidites")).toHaveLength(1);
    expect(normalizeParams(n, new Date(2026, 10, 7)).targets).toEqual(n.targets);
  });

  it("ligne Matières premières ajoutée, hors allocation, aux répartitions enregistrées avant elle", () => {
    const stored = { targets: defaultParams(new Date(2026, 10, 15)).targets.filter((l) => l.key !== "matieres_premieres" && l.key !== "liquidites") };
    const n = normalizeParams(stored, new Date(2026, 10, 15));
    expect(n.targets.find((l) => l.key === "matieres_premieres")).toEqual({ key: "matieres_premieres", inAllocation: false, target: 0, expectedReturn: null });
    expect(n.targets.filter((l) => l.key === "matieres_premieres")).toHaveLength(1);
    expect(n.targets.filter((l) => l.key === "liquidites")).toHaveLength(1);
    expect(normalizeParams(n, new Date(2026, 10, 15)).targets).toEqual(n.targets);
  });

  it("modules : tous affichés par défaut, y compris depuis d'anciens paramètres", () => {
    const n = normalizeParams({ modules: { crypto: false } }, new Date(2026, 10, 7));
    expect(n.modules.crypto).toBe(false);
    expect(n.modules.livrets).toBe(true);
    expect(normalizeParams({}, new Date(2026, 10, 7)).modules.impots).toBe(true);
  });
});

describe("dispense de l'acompte sur les intérêts", () => {
  const today = new Date(2026, 10, 13);
  it("se règle par année et par établissement", () => {
    const p = defaultParams(today);
    expect(p.tax.withholdingDispenses).toEqual([]);
    p.tax.withholdingDispenses = [{ year: 2027, institutionIds: ["bricks"] }];
    expect(withholdingDispensed(p, 2027, "bricks")).toBe(true);
    expect(withholdingDispensed(p, 2027, "courtier")).toBe(false);
    expect(withholdingDispensed(p, 2027, null)).toBe(false);
    expect(withholdingDispensed(p, 2026, "bricks")).toBe(false);
  });

  it("anciennes formes : la case unique cochée vaut pour l'année en cours, la liste d'années pour chacune ; tous établissements", () => {
    const base = defaultParams(today);
    const stored = (tax: Record<string, unknown>) => {
      const { withholdingDispenses: _w, ...rest } = base.tax;
      return { ...base, tax: { ...rest, ...tax } };
    };
    expect(normalizeParams(stored({ withholdingDispense: true }), today).tax.withholdingDispenses).toEqual([{ year: 2026, institutionIds: null }]);
    expect(normalizeParams(stored({ withholdingDispense: false }), today).tax.withholdingDispenses).toEqual([]);
    expect(normalizeParams(stored({ withholdingDispenseYears: [2026, 2027] }), today).tax.withholdingDispenses).toEqual([
      { year: 2026, institutionIds: null },
      { year: 2027, institutionIds: null },
    ]);
    const migrated = normalizeParams(stored({ withholdingDispense: true }), today);
    expect("withholdingDispense" in migrated.tax).toBe(false);
    expect(withholdingDispensed(migrated, 2026, "nimporte")).toBe(true);
  });
});
