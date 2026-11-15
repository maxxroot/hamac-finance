import { describe, expect, it } from "vitest";
import { accountNoun, cashBucketOf, defaultParams, holdsEuroFunds, plannedBucketOf, validateTransaction, type Account, type Asset, type ContributionPlan, type PricePoint, type Transaction } from "../model";
import { computePortfolio, type EngineData } from "./engine";
import { buildHistory } from "./history";
import { assetPerformance, envelopePerformance, scopePerformance } from "../analysis";
import { withdrawalTaxes } from "../tax";

// Fonds euros comme support d'un contrat : mêmes chiffres que lorsqu'il était les espèces du contrat.

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: kind === "livret" ? "LIVRET_A" : null, name: id, institutionId: null, openedOn: "2020-01-15", depositCeiling: null, rate: null, role: "",
  beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
const asset = (id: string, kind: Asset["kind"]): Asset => ({
  id, kind, name: id, isin: null, symbol: null, priceSource: kind === "fonds_euros" ? "modele" : "auto", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null,
  targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false,
});
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra,
});
const price = (assetId: string, date: string, p: number): PricePoint => ({ assetId, date, price: p, source: "marche" });

const ASOF = "2026-06-30";

/** Un contrat d'assurance-vie avec versements, intérêts, frais, unités de compte et versements programmés. */
function contract(withFund: boolean): EngineData {
  const params = defaultParams(new Date(2026, 5, 30));
  params.profile = { ...params.profile, birthYear: 1985, startMonth: "2025-01" };
  const plans: ContributionPlan[] = [{ id: "p", accountId: "av", fromMonth: "2025-01", amount: 150, comment: "" }];
  return {
    params,
    accounts: [acc("av", "assurance_vie", withFund ? { defaultAssetId: "fe" } : {}), acc("livret", "livret")],
    assets: [asset("etf", "etf"), ...(withFund ? [asset("fe", "fonds_euros")] : [])],
    transactions: [
      tx("2025-01-10", "apport_initial", "av", 10_000),
      tx("2025-01-10", "apport_initial", "livret", 5_000),
      tx("2025-02-03", "achat", "av", 3_000, { assetId: "etf", quantity: 30 }),
      tx("2025-06-01", "transfert", "livret", 1_200, { counterAccountId: "av" }),
      tx("2025-12-31", "interets", "av", 182.4),
      tx("2025-12-31", "frais", "av", 12.5),
      tx("2026-03-02", "vente", "av", 1_150, { assetId: "etf", quantity: 10 }),
      tx("2026-04-15", "retrait", "av", 800),
      tx("2026-05-20", "correction", "av", -3.21),
    ],
    plans,
    skips: [],
    prices: [price("etf", "2025-02-03", 100), price("etf", ASOF, 118.4)],
  };
}

describe("fonds euros : support d'un contrat", () => {
  const before = computePortfolio(contract(false), ASOF);
  const after = computePortfolio(contract(true), ASOF);
  const av = (s: typeof before) => s.accountById.get("av")!;

  it("valeur, versé net, gain et intérêts identiques au centime", () => {
    for (const k of ["value", "netContrib", "gain", "interests", "fees", "corrections", "realizedGain"] as const) expect(av(after)[k]).toBe(av(before)[k]);
    // Seules les espèces changent : l'argent du contrat est désormais sur un support.
    expect({ ...after.totals, cash: 0 }).toEqual({ ...before.totals, cash: 0 });
    expect(after.totals.cash).toBe(before.totals.cash - av(before).cash);
    expect(after.buckets).toEqual(before.buckets);
    expect(after.allocation).toEqual(before.allocation);
  });

  it("l'argent du contrat est sur le fonds euros, plus en espèces", () => {
    const fund = av(after).positions.find((p) => p.asset.id === "fe")!;
    expect(av(after).cash).toBe(0);
    expect(fund.value).toBe(av(before).cash);
    expect(fund.quantity).toBeCloseTo(av(before).cash, 6);
    expect(fund.cost).toBe(fund.value);
    expect(fund.price).toBe(1);
    expect(fund.bucket).toBe("garanti");
    // Ses intérêts sont son revenu ; le fonds n'a pas de plus-value latente.
    expect(fund.income).toBe(182.4);
    expect(fund.gain).toBe(0);
  });

  it("historique mois par mois et impôt au retrait identiques", () => {
    const h0 = buildHistory(contract(false), ASOF);
    const h1 = buildHistory(contract(true), ASOF);
    expect(h1.map((h) => [h.month, h.value, h.netContrib, h.gain, h.buckets])).toEqual(h0.map((h) => [h.month, h.value, h.netContrib, h.gain, h.buckets]));
    expect(h1.map((h) => h.byAccount)).toEqual(h0.map((h) => h.byAccount));
    const tax = (d: EngineData) => withdrawalTaxes(d, computePortfolio(d, ASOF), { sales: [], years: [], remainingAcquisition: 0 }).map((r) => [r.accountId, r.tax]);
    expect(tax(contract(true))).toEqual(tax(contract(false)));
  });

  it("performance : rendement, classes, sources du gain et tableau par enveloppe identiques", () => {
    const view = (d: EngineData) => {
      const state = computePortfolio(d, ASOF);
      const history = buildHistory(d, ASOF);
      const p = scopePerformance(d, state, history, ["av", "livret"], null)!;
      const taxes = withdrawalTaxes(d, state, { sales: [], years: [], remainingAcquisition: 0 });
      return { summary: p.summary, byClass: p.byClass, sources: p.sources, curve: p.curve, years: p.years, envelopes: envelopePerformance(d, state, history, taxes, null) };
    };
    expect(view(contract(true))).toEqual(view(contract(false)));
  });

  it("classement par titre : le gain du fonds euros est ses intérêts, son rendement ne compte pas les versements", () => {
    const d = contract(true);
    const rows = assetPerformance(d, computePortfolio(d, ASOF), buildHistory(d, ASOF), ["av"], null);
    const fund = rows.find((r) => r.assetId === "fe")!;
    expect(fund.gain).toBe(182.4);
    expect(fund.income).toBe(182.4);
    // Environ 182,40 € d'intérêts sur un solde d'environ 9 000 € : quelques %, pas des centaines.
    expect(fund.rate).toBeGreaterThan(0.01);
    expect(fund.rate).toBeLessThan(0.04);
  });

  it("une opération peut viser un autre fonds euros du contrat, et un transfert son fonds d'arrivée", () => {
    const d = contract(true);
    const data: EngineData = {
      ...d,
      assets: [...d.assets, asset("fe2", "fonds_euros")],
      transactions: [
        ...d.transactions,
        tx("2026-06-01", "versement", "av", 500, { assetId: "fe2" }),
        tx("2026-06-02", "transfert", "livret", 300, { counterAccountId: "av", counterAssetId: "fe2" }),
        tx("2026-06-30", "interets", "av", 7, { assetId: "fe2" }),
      ],
    };
    const s = computePortfolio(data, ASOF).accountById.get("av")!;
    const fe2 = s.positions.find((p) => p.asset.id === "fe2")!;
    expect(fe2.value).toBe(807);
    expect(fe2.income).toBe(7);
    // Le fonds par défaut n'a pas bougé ; le contrat a reçu les 807 €.
    expect(s.positions.find((p) => p.asset.id === "fe")!.value).toBe(av(after).positions.find((p) => p.asset.id === "fe")!.value);
    expect(s.value).toBe(av(after).value + 807);
  });

  it("sans fonds euros par défaut, l'argent du contrat reste en espèces", () => {
    expect(av(before).cash).toBeGreaterThan(0);
    expect(av(before).positions.some((p) => p.asset.kind === "fonds_euros")).toBe(false);
  });

  it("un fonds euros à découvert reste visible et signalé", () => {
    const d = contract(true);
    const s = computePortfolio({ ...d, transactions: [...d.transactions, tx("2026-06-10", "retrait", "av", 50_000)] }, ASOF);
    const fund = s.accountById.get("av")!.positions.find((p) => p.asset.id === "fe")!;
    expect(fund.value).toBeLessThan(0);
    expect(s.warnings.some((w) => w.includes("Solde négatif sur « fe »"))).toBe(true);
  });
});

describe("fonds euros : validation des opérations", () => {
  const accounts = new Map([acc("av", "assurance_vie"), acc("per", "per"), acc("pea", "pea"), acc("livret", "livret")].map((a) => [a.id, a]));
  const assets = new Map([asset("fe", "fonds_euros"), asset("etf", "etf")].map((a) => [a.id, a]));
  const check = (t: Partial<Transaction> & Pick<Transaction, "type" | "accountId">) => validateTransaction({ date: "2026-01-01", assetId: null, counterAccountId: null, amount: 100, quantity: null, fee: null, comment: "", ...t }, accounts, assets);

  it("un versement, un retrait, des intérêts ou des frais peuvent viser le fonds euros d'un contrat", () => {
    for (const type of ["versement", "retrait", "interets", "frais", "correction", "transfert"] as const) {
      const extra = type === "transfert" ? { counterAccountId: "livret" } : {};
      expect(check({ type, accountId: "av", assetId: "fe", ...extra })).toEqual([]);
    }
    expect(check({ type: "versement", accountId: "per", assetId: "fe" })).toEqual([]);
  });

  it("un fonds euros ne s'achète pas et ne se vend pas", () => {
    expect(check({ type: "achat", accountId: "av", assetId: "fe", quantity: 100 }).map((e) => e.field)).toContain("assetId");
    expect(check({ type: "vente", accountId: "av", assetId: "fe", quantity: 100 }).map((e) => e.field)).toContain("assetId");
  });

  it("seuls l'assurance-vie et le PER détiennent un fonds euros", () => {
    expect(check({ type: "versement", accountId: "pea", assetId: "fe" }).map((e) => e.field)).toEqual(["assetId"]);
    expect(check({ type: "transfert", accountId: "av", counterAccountId: "livret", counterAssetId: "fe" }).map((e) => e.field)).toEqual(["counterAssetId"]);
  });

  it("un autre titre ne peut pas être le support d'un versement, ni d'arrivée d'un transfert", () => {
    expect(check({ type: "versement", accountId: "av", assetId: "etf" }).map((e) => e.field)).toEqual(["assetId"]);
    expect(check({ type: "transfert", accountId: "livret", counterAccountId: "av", counterAssetId: "etf" }).map((e) => e.field)).toEqual(["counterAssetId"]);
    expect(check({ type: "versement", accountId: "av", counterAssetId: "fe" }).map((e) => e.field)).toEqual(["counterAssetId"]);
  });
});

describe("PER assurantiel ou bancaire", () => {
  const bank = acc("perb", "per", { perKind: "bancaire" });
  const insured = acc("pera", "per", { perKind: "assurantiel" });
  const legacy = acc("perl", "per");

  it("un PER bancaire est un compte sans fonds euros ; un PER d'avant ce choix est assurantiel", () => {
    expect([accountNoun(bank), accountNoun(insured), accountNoun(legacy)]).toEqual(["compte", "contrat", "contrat"]);
    expect([holdsEuroFunds(bank), holdsEuroFunds(insured), holdsEuroFunds(legacy)]).toEqual([false, true, true]);
    expect([cashBucketOf(bank), cashBucketOf(insured), cashBucketOf(acc("pee", "epargne_salariale"))]).toEqual(["liquidites", "garanti", "liquidites"]);
    // Le plan, lui, investit l'argent d'un PER bancaire et de l'épargne salariale en actions.
    expect([plannedBucketOf(bank), plannedBucketOf(insured), plannedBucketOf(acc("pee", "epargne_salariale"))]).toEqual(["croissance", "garanti", "croissance"]);
  });

  it("pas de fonds euros dans un PER bancaire, même par défaut", () => {
    const accounts = new Map([bank].map((a) => [a.id, { ...a, defaultAssetId: "fe" }]));
    const assets = new Map([asset("fe", "fonds_euros")].map((a) => [a.id, a]));
    expect(validateTransaction({ date: "2026-01-01", type: "versement", accountId: "perb", assetId: "fe", counterAccountId: null, amount: 100, quantity: null, fee: null, comment: "" }, accounts, assets).map((e) => e.field)).toEqual(["assetId"]);
    const params = defaultParams(new Date(2026, 5, 30));
    const s = computePortfolio({ params, accounts: [...accounts.values()], assets: [...assets.values()], transactions: [tx("2026-01-05", "versement", "perb", 1_000)], plans: [], skips: [], prices: [] }, ASOF);
    const per = s.accountById.get("perb")!;
    expect(per.cash).toBe(1_000);
    expect(per.positions).toEqual([]);
    expect(s.buckets.liquidites).toBe(1_000);
  });
});
