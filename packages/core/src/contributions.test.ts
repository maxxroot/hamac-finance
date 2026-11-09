import { describe, expect, it } from "vitest";
import type { Account, Asset, Transaction } from "./domain";
import type { CrowdProject } from "./crowdlending";
import { computePortfolio, type EngineData } from "./engine";
import { proposeContributions } from "./contributions";
import { targetRows, targetsTotal } from "./allocationTargets";
import { defaultParams, type PlanParams } from "./params";
import type { AllocationRule } from "./allocations";

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: kind === "livret" ? "LEP" : null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "",
  beneficiaryClause: false, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
let n = 0;
const apport = (accountId: string, amount: number): Transaction => ({ id: `t${n++}`, date: "2026-01-02", type: "apport_initial", accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "" });

function setup(balances: Record<string, number>, over: (p: PlanParams) => PlanParams = (p) => p, accounts?: Account[]) {
  const base = defaultParams(new Date(2026, 10, 7));
  const params = over({ ...base, profile: { ...base.profile, birthYear: 1990, retirementAge: 64, securisationAge: 57, startMonth: "2026-11" } });
  const list = accounts ?? [acc("lep", "livret", { rate: 0.035 }), acc("ldds", "livret", { livretType: "LDDS", rate: 0.017 }), acc("av", "assurance_vie"), acc("cto", "cto"), acc("pea", "pea")];
  const data: EngineData = { params, accounts: list, assets: [], transactions: Object.entries(balances).map(([id, v]) => apport(id, v)), plans: [], skips: [], prices: [] };
  const state = computePortfolio(data, "2026-11-07");
  return { params, state };
}
const amountOf = (r: ReturnType<typeof proposeContributions>, id: string) => r.lines.find((l) => l.accountId === id)?.amount ?? 0;
const total = (r: ReturnType<typeof proposeContributions>) => r.lines.reduce((s, l) => s + l.amount, 0);

describe("gestion suggérée des versements", () => {
  it("matelas de précaution d'abord : le livret le mieux rémunéré, sous son plafond", () => {
    const { params, state } = setup({ lep: 2_000, ldds: 1_000, av: 5_000 });
    const r = proposeContributions(params, state, 1_000);
    expect(amountOf(r, "lep")).toBe(1_000);
    expect(r.lines.find((l) => l.accountId === "lep")?.reasons[0]).toContain("Matelas de précaution");
  });

  it("plafond du LEP atteint : le reste passe au livret suivant", () => {
    const { params, state } = setup({ lep: 9_900, ldds: 0, av: 5_000 }, (p) => ({ ...p, livrets: { ...p.livrets, floor: 12_000 } }));
    const r = proposeContributions(params, state, 1_000);
    expect(amountOf(r, "lep")).toBe(100);
    expect(amountOf(r, "ldds")).toBe(900);
  });

  it("matelas plein : allocation de base, vers les classes en retard sur leur cible", () => {
    const { params, state } = setup({ lep: 8_000, av: 10_000, cto: 0, pea: 0 });
    const r = proposeContributions(params, state, 1_000);
    expect(total(r)).toBe(1_000);
    expect(amountOf(r, "lep")).toBe(0);
    expect(amountOf(r, "av")).toBe(0);
    // Cibles par défaut : obligations 50 %, actions 30 %, fonds euros 20 % (déjà au-dessus : rien).
    // Total après versement 11 000 € : écarts 5 500 € (obligations) et 3 300 € (actions) → 625 / 375.
    expect(amountOf(r, "cto")).toBe(625);
    expect(amountOf(r, "pea")).toBe(375);
    expect(r.lines.find((l) => l.accountId === "pea")?.reasons[0]).toContain("Allocation de base : actions");
  });

  it("allocations personnalisées d'abord, plafonnées à ce qui reste avant la limite", () => {
    const rule: AllocationRule = { id: "liv", label: "", target: { kind: "type", accountKind: "livret" }, share: 0.3, limit: { basis: "verse", amount: 3_150 }, overflowTo: null };
    const { params, state } = setup({ lep: 2_000, ldds: 1_000, av: 5_000 }, (p) => ({ ...p, customAllocations: [rule] }));
    const r = proposeContributions(params, state, 1_000);
    // 30 % = 300 €, mais seulement 150 € avant la limite ; le plancher n'est pas forcé (la ligne gère les livrets).
    expect(amountOf(r, "lep") + amountOf(r, "ldds")).toBe(150);
    expect(total(r)).toBe(1_000);
  });

  it("arrondi à l'euro, total exact, et comptes absents signalés", () => {
    const { params, state } = setup({ lep: 9_000, pea: 3_000 }, (p) => p, [acc("lep", "livret", { rate: 0.03 }), acc("pea", "pea")]);
    const r = proposeContributions(params, state, 333.33);
    expect(r.lines.every((l) => Number.isInteger(l.amount))).toBe(true);
    expect(total(r)).toBe(333);
    expect(amountOf(r, "pea")).toBe(333);
    expect(r.notes.join(" ")).toContain("Aucun compte pour");
  });

  it("classe créée : sa propre ligne, versements vers le compte qui détient le titre", () => {
    const base = defaultParams(new Date(2026, 10, 7));
    const params: PlanParams = { ...base, profile: { ...base.profile, birthYear: 1990, retirementAge: 64, securisationAge: 57, startMonth: "2026-11" }, customClasses: [{ id: "or", label: "Or", color: "#e0a458" }], targets: [...base.targets.map((l) => (l.key === "croissance" ? { ...l, target: 0.2 } : l)), { key: "or", inAllocation: true, target: 0.1, expectedReturn: null }] };
    const accounts = [acc("av", "assurance_vie"), acc("cto", "cto"), acc("pea", "pea"), acc("pea2", "cto")];
    const asset: Asset = { id: "etc", kind: "etf", name: "ETC Or", isin: null, symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: "or", inAllocation: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false };
    const buy: Transaction = { id: "b", date: "2026-01-03", type: "achat", accountId: "pea2", assetId: "etc", counterAccountId: null, amount: 1_000, quantity: 10, fee: null, comment: "" };
    const data: EngineData = { params, accounts, assets: [asset], transactions: [apport("av", 4_000), apport("cto", 4_000), apport("pea", 1_000), apport("pea2", 1_000), buy], plans: [], skips: [], prices: [] };
    const state = computePortfolio(data, "2026-11-07");
    const or = state.allocation.rows.find((r) => r.key === "or")!;
    expect(or).toMatchObject({ bucket: null, label: "Or", value: 1_000 });
    expect(or.target).toBeCloseTo(0.1);
    expect(state.allocation.rows.find((r) => r.key === "croissance")).toMatchObject({ value: 1_000 });
    expect(state.allocation.rows.reduce((s, r) => s + r.target, 0)).toBeCloseTo(1);
    const r = proposeContributions(params, state, 1_000);
    expect(total(r)).toBe(1_000);
    expect(r.lines.find((l) => l.accountId === "pea2")?.reasons.join(" ")).toContain("Or");
  });

  it("dans ou hors allocation : le choix de chaque élément prime sur le type", () => {
    const base = defaultParams(new Date(2026, 10, 7));
    const params: PlanParams = { ...base, profile: { ...base.profile, birthYear: 1990, startMonth: "2026-11" } };
    const asset = (id: string, kind: Asset["kind"], inAllocation: boolean | null): Asset => ({ id, kind, name: id, isin: null, symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false });
    const buy = (id: string, accountId: string, assetId: string): Transaction => ({ id, date: "2026-01-03", type: "achat", accountId, assetId, counterAccountId: null, amount: 1_000, quantity: 10, fee: null, comment: "" });
    const compute = (crypto: boolean | null, etf: boolean | null, livret: boolean | null) =>
      computePortfolio({ params, accounts: [acc("lep", "livret", { inAllocation: livret }), acc("pea", "pea"), acc("btc", "crypto")], assets: [asset("c", "crypto", crypto), asset("e", "etf", etf)], transactions: [apport("lep", 500), apport("pea", 1_000), apport("btc", 1_000), buy("b1", "btc", "c"), buy("b2", "pea", "e")], plans: [], skips: [], prices: [] }, "2026-11-07");
    const row = (s: ReturnType<typeof compute>, k: string) => s.allocation.rows.find((r) => r.key === k)!.value;

    const byDefault = compute(null, null, null);
    expect(byDefault.allocation.invested).toBe(1_000);
    const withCrypto = compute(true, null, null);
    expect(withCrypto.allocation.invested).toBe(2_000);
    expect(row(withCrypto, "speculatif")).toBe(1_000); // sa propre ligne, sans cible tant qu'elle n'est pas réglée
    expect(row(withCrypto, "croissance")).toBe(1_000);
    expect(compute(null, false, null).allocation.invested).toBe(0);
    const withLivret = compute(null, null, true);
    expect(row(withLivret, "precaution")).toBe(500);
    expect(withLivret.totals.value).toBe(byDefault.totals.value);
  });

  it("crowdlending : l'argent investi quitte les espèces, hors allocation par défaut, défaut à 0 €", () => {
    const base = defaultParams(new Date(2026, 10, 7));
    const params: PlanParams = { ...base, profile: { ...base.profile, birthYear: 1990, startMonth: "2026-11" } };
    const project = (id: string, o: Partial<CrowdProject>): CrowdProject => ({ id, accountId: "c", name: id, amount: 1_000, rate: 0.1, startDate: "2026-02-01", termMonths: 24, repayment: "in_fine", status: "en_cours", statusDate: null, repaidCapital: null, expectedRecovery: null, inAllocation: null, comment: "", ...o });
    const data = (crowdProjects: CrowdProject[], platform: Partial<Account> = {}): EngineData => ({ params, accounts: [acc("c", "crowdlending", platform)], assets: [], transactions: [apport("c", 3_000)], plans: [], skips: [], prices: [], crowdProjects });
    const one = computePortfolio(data([project("a", {}), project("b", { status: "defaut" })]), "2026-11-07");
    const a = one.accountById.get("c")!;
    expect(a).toMatchObject({ cash: 1_000, value: 2_000, netContrib: 3_000, gain: -1_000 });
    expect(one.buckets.crowdlending).toBe(1_000 + 1_000);
    expect(one.allocation.invested).toBe(0);
    // Un projet pas encore commencé ne sort rien des espèces.
    expect(computePortfolio(data([project("a", { startDate: "2027-01-01" })]), "2026-11-07").accountById.get("c")!.cash).toBe(3_000);
    // Remboursé : le capital revient sur la plateforme.
    expect(computePortfolio(data([project("a", { status: "rembourse" })]), "2026-11-07").accountById.get("c")!).toMatchObject({ cash: 3_000, value: 3_000 });
    // Inclus par choix : sa propre ligne.
    const inc = computePortfolio(data([project("a", { inAllocation: true })]), "2026-11-07");
    expect(inc.allocation.rows.find((r) => r.key === "crowdlending")!.value).toBe(1_000);
  });

  it("ma répartition cible : seules les classes détenues, un Livret A inclus seul compte dans le total", () => {
    const base = defaultParams(new Date(2026, 10, 7));
    const accounts = [acc("lep", "livret"), acc("la", "livret", { livretType: "LIVRET_A", inAllocation: true }), acc("pea", "pea")];
    const rows = targetRows(base, { accounts, assets: [] });
    expect(rows.map((r) => r.key)).toEqual(["garanti", "obligations", "croissance", "precaution"]);
    const livrets = rows.find((r) => r.key === "precaution")!;
    expect(livrets).toMatchObject({ inAllocation: false, included: 1, active: true, returnField: "livrets" });
    expect(targetsTotal(rows)).toBeCloseTo(1);
    const params = { ...base, targets: base.targets.map((l) => (l.key === "precaution" ? { ...l, target: 0.1 } : l.key === "garanti" ? { ...l, target: 0.1 } : l)) };
    expect(targetsTotal(targetRows(params, { accounts, assets: [] }))).toBeCloseTo(1);
    const state = computePortfolio({ params, accounts, assets: [], transactions: [apport("lep", 500), apport("la", 1_000), apport("pea", 9_000)], plans: [], skips: [], prices: [] }, "2026-11-07");
    expect(state.allocation.rows.find((r) => r.key === "precaution")).toMatchObject({ value: 1_000, target: 0.1 });
    expect(state.allocation.invested).toBe(10_000);
    // Les versements suggérés vers cette ligne ne vont qu'au Livret A.
    const r = proposeContributions({ ...params, livrets: { ...params.livrets, floor: 0 } }, state, 1_000);
    expect(r.lines.find((l) => l.accountId === "lep")?.amount ?? 0).toBe(0);
  });
});
