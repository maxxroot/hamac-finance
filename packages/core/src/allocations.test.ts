import { describe, expect, it } from "vitest";
import { allocationIssues, allocationReport, effectiveShares, type AllocationAccountInput, type AllocationRule } from "./allocations";
import { PlanParams, defaultParams, normalizeParams } from "./params";

const rule = (id: string, over: Partial<AllocationRule> = {}): AllocationRule => ({
  id,
  label: "",
  target: { kind: "type", accountKind: "livret" },
  asTarget: true,
  asContribution: true,
  share: 0.2,
  limit: null,
  overflowTo: null,
  ...over,
});
const acc = (id: string, kind: AllocationAccountInput["account"]["kind"], value: number, netContrib: number, currentMonthly: number): AllocationAccountInput => ({
  account: { id, name: id.toUpperCase(), kind, archived: false },
  value,
  netContrib,
  currentMonthly,
});

describe("allocations personnalisées", () => {
  it("une ligne terminée cède sa part aux autres au prorata", () => {
    const eff = effectiveShares([rule("a", { share: 0.2 }), rule("b", { share: 0.6 }), rule("c", { share: 0.2 })], new Set(["a"]));
    expect(eff.get("a")).toBe(0);
    expect(eff.get("b")).toBeCloseTo(0.75);
    expect(eff.get("c")).toBeCloseTo(0.25);
  });

  it("…ou à la ligne choisie, en suivant la chaîne si elle est aussi terminée", () => {
    const rules = [rule("a", { share: 0.2, overflowTo: "b" }), rule("b", { share: 0.3, overflowTo: "c" }), rule("c", { share: 0.1 }), rule("d", { share: 0.4 })];
    const eff = effectiveShares(rules, new Set(["a", "b"]));
    expect(eff.get("c")).toBeCloseTo(0.1 + 0.2 + 0.3);
    expect(eff.get("d")).toBeCloseTo(0.4);
  });

  it("limite « versé » : 20 % des versements au livret jusqu'à 10 000 € versés", () => {
    const accounts = [acc("lep", "livret", 9_000, 8_000, 100), acc("pea", "pea", 11_000, 10_000, 400)];
    const rules = [rule("liv", { share: 0.2, limit: { basis: "verse", amount: 10_000 } }), rule("pea", { target: { kind: "compte", accountId: "pea" }, share: 0.8 })];
    const before = allocationReport(rules, accounts, 20_000);
    expect(before.monthlyBase).toBe(500);
    expect(before.rows[0]).toMatchObject({ name: "Livrets", done: false, remaining: 2_000, advisedMonthly: 100, programmedMonthly: 100 });
    expect(before.rows[0].currentShare).toBeCloseTo(0.45);
    expect(before.rows[1]).toMatchObject({ name: "PEA", advisedMonthly: 400 });

    const after = allocationReport(rules, [acc("lep", "livret", 10_500, 10_000, 100), accounts[1]], 21_500);
    expect(after.rows[0]).toMatchObject({ done: true, progress: 1, advisedMonthly: 0, targetShare: 0 });
    expect(after.rows[1]).toMatchObject({ advisedMonthly: 500, targetShare: 1 });
  });

  it("limite « valeur » et ligne qui ne sert que de cible", () => {
    const rules = [rule("liv", { asContribution: false, share: 0.3, limit: { basis: "valeur", amount: 5_000 } })];
    const r = allocationReport(rules, [acc("lep", "livret", 4_000, 4_500, 0)], 10_000);
    expect(r.rows[0]).toMatchObject({ done: false, remaining: 1_000, contributionShare: 0, advisedMonthly: 0 });
    expect(r.rows[0].drift).toBeCloseTo(0.1);
  });

  it("validation : au moins un usage, total ≤ 100 % par usage, destination existante", () => {
    expect(allocationIssues([rule("a", { asTarget: false, asContribution: false })]).map((i) => i.field)).toEqual(["usage"]);
    expect(allocationIssues([rule("a", { share: 0.7 }), rule("b", { share: 0.4, asTarget: false })]).map((i) => i.field)).toEqual(["share"]);
    expect(allocationIssues([rule("a", { overflowTo: "zz" })]).map((i) => i.field)).toEqual(["overflowTo"]);
    const p = defaultParams(new Date(2026, 10, 7));
    expect(PlanParams.safeParse({ ...p, customAllocations: [rule("a", { share: 0.7 }), rule("b", { share: 0.4 })] }).success).toBe(false);
  });

  it("les paramètres d'avant n'ont pas de lignes ; une liste enregistrée est conservée", () => {
    expect(normalizeParams({ profile: { birthYear: 1990 } }).customAllocations).toEqual([]);
    const stored = { ...defaultParams(), customAllocations: [rule("a")] };
    expect(normalizeParams(JSON.parse(JSON.stringify(stored))).customAllocations).toHaveLength(1);
  });
});

describe("alerte de limite atteinte", () => {
  it("précise la destination usage par usage", async () => {
    const { computeAlerts } = await import("./alerts");
    const { computePortfolio } = await import("./engine");
    const p = defaultParams(new Date(2026, 10, 7));
    const params = {
      ...p,
      customAllocations: [
        rule("liv", { share: 0.2, limit: { basis: "verse" as const, amount: 1000 }, overflowTo: "av" }),
        rule("av", { target: { kind: "type", accountKind: "assurance_vie" }, asTarget: false, share: 0.2 }),
      ],
    };
    const data = {
      params,
      accounts: [{ id: "lep", name: "LEP", kind: "livret" as const, livretType: "LEP" as const, institutionId: null, archived: false, openedOn: null, rate: 0.03, ceiling: null, comment: "" }],
      assets: [],
      transactions: [{ id: "t", date: "2026-01-02", type: "apport_initial" as const, accountId: "lep", assetId: null, counterAccountId: null, amount: 2000, quantity: null, fee: null, comment: "" }],
      plans: [],
      skips: [],
      prices: [],
    };
    const state = computePortfolio(data as never, "2026-11-07");
    const alert = computeAlerts(data as never, state).find((a) => a.id === "alloc-limite-liv");
    expect(alert?.detail).toBe("Sa part de 20 % va désormais pour les versements, à « Assurance-vie » ; pour la cible, aux autres lignes, au prorata.");
  });
});
