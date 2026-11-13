import { describe, expect, it } from "vitest";
import { crowdWithholding, defaultParams, type Account, type Asset, type ContributionPlan, type Institution, type PricePoint, type Transaction } from "../model";
import { advisedMonthlyPurchase, computePortfolio, splitByTarget, type EngineData } from "./engine";
import { embeddedFee } from "../base";
import { crowdInterestEntries } from "../investments";
import { buildHistory } from "./history";
import { NO_PROPERTY_DETAILS, type Property } from "../realestate";
import type { Loan } from "../loans";
import { cryptoTax, withdrawalTaxes, yearlyTaxes } from "../tax";

// ——— Fabriques ———
const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: kind === "livret" ? "LEP" : null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "",
  beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
const asset = (id: string, kind: Asset["kind"], extra: Partial<Asset> = {}): Asset => ({
  id, kind, name: id, isin: null, symbol: null, priceSource: kind === "obligation" ? "modele" : "auto", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null,
  targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: kind === "obligation" ? 1 : null, nextCouponDate: null, issuer: null, bondKind: null, archived: false, ...extra,
});
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra,
});
const price = (assetId: string, date: string, p: number): PricePoint => ({ assetId, date, price: p, source: "marche" });

function data(over: Partial<EngineData>): EngineData {
  const params = defaultParams(new Date(2026, 10, 7));
  params.profile = { ...params.profile, birthYear: 1990, retirementAge: 65, securisationAge: 65, startMonth: "2026-11" };
  params.tax = { ...params.tax, tmi: 0 };
  params.broker = { feeRate: 0.005, minFee: 0 };
  return { params, accounts: [], assets: [], transactions: [], plans: [], skips: [], prices: [], ...over };
}

// ——— Portefeuille de départ fictif au 07/11/2026 ———
const TODAY = "2026-11-07";
const etfs = [
  { id: "monde", amount: 904.5, qty: 18, price: 60.1 },
  { id: "sante", amount: 301.5, qty: 6, price: 52 },
  { id: "em", amount: 402, qty: 12, price: 36.5 },
  { id: "europe", amount: 603, qty: 9, price: 78.4 },
];
function sheetCase(): EngineData {
  const plan = (accountId: string): ContributionPlan => ({ id: `p-${accountId}`, accountId, fromMonth: "2026-11", amount: 100, comment: "" });
  return data({
    accounts: [acc("lep", "livret"), acc("pea", "pea", { openedOn: "2024-06-01", monthsToInvest: 15 }), acc("cto", "cto"), acc("btc", "crypto")],
    assets: [...etfs.map((e) => asset(e.id, "etf")), asset("bitcoin", "crypto")],
    transactions: [
      tx("2026-11-01", "apport_initial", "lep", 5000),
      tx("2026-11-01", "apport_initial", "pea", 2300),
      ...etfs.map((e) => tx("2026-11-01", "achat", "pea", e.amount, { assetId: e.id, quantity: e.qty, fee: embeddedFee("achat", e.amount, 0.005, 0) })),
      tx("2026-11-01", "apport_initial", "btc", 4000),
      tx("2026-11-01", "achat", "btc", 4000, { assetId: "bitcoin", quantity: 0.08, fee: 0 }),
    ],
    plans: [plan("cto"), plan("pea"), plan("lep")],
    prices: [...etfs.map((e) => price(e.id, TODAY, e.price)), price("bitcoin", TODAY, 75000)],
  });
}

describe("moteur : portefeuille de départ", () => {
  const d = sheetCase();
  const s = computePortfolio(d, TODAY);
  const pea = s.accountById.get("pea")!;
  const btc = s.accountById.get("btc")!;

  it("frais de courtage : 11 € sur les quatre ETF (le sheet oubliait le 4e)", () => {
    expect(pea.fees).toBeCloseTo(11, 2);
  });

  it("PEA : investi 2 211 €, ETF ≈ 2 537 €, valeur ≈ 2 626 €, gain ≈ 326 € (+ versement de novembre)", () => {
    const monde = pea.positions.find((p) => p.asset.id === "monde")!;
    expect(monde.pru).toBeCloseTo(50.25, 2);
    expect(pea.positionsValue).toBeCloseTo(2537.4, 2);
    // Corrigé : le versement mensuel de novembre compte (le sheet l'ignorait).
    expect(pea.cash).toBeCloseTo(89 + 100, 2);
    expect(pea.value - 100).toBeCloseTo(2626.4, 2);
    expect(pea.gain).toBeCloseTo(326.4, 2);
  });

  it("Bitcoin : valeur 6 000 €, plus-value latente 2 000 €", () => {
    expect(btc.value).toBeCloseTo(6000, 0);
    expect(btc.gain).toBeCloseTo(2000, 0);
  });

  it("LEP et versements : 300 €/mois comptés dès novembre (bug du sheet corrigé)", () => {
    expect(s.accountById.get("lep")!.value).toBe(5100);
    expect(s.totals.monthly).toBe(300);
  });

  it("impôts si tout retiré : PEA < 5 ans ≈ 102 €, crypto ≈ 372 € (TMI 0 %)", () => {
    const rows = withdrawalTaxes(d, s, cryptoTax(d, TODAY));
    expect(rows.find((r) => r.accountId === "pea")!.tax).toBeCloseTo(326.4 * (0.186 + 0.128), 1);
    expect(rows.find((r) => r.accountId === "btc")!.tax).toBeCloseTo(2000 * 0.186, 0);
  });

  it("PEA : la règle des 5 ans s'applique bien (bug du sheet : toujours < 5 ans)", () => {
    const later = computePortfolio({ ...d, prices: d.prices.map((p) => ({ ...p, date: "2029-06-01" })) }, "2029-06-01");
    const rows = withdrawalTaxes(d, later, cryptoTax(d, "2029-06-01"));
    const row = rows.find((r) => r.accountId === "pea")!;
    expect(row.regime).toMatch(/Plus de 5 ans/);
    expect(row.tax).toBeCloseTo(later.accountById.get("pea")!.gain * 0.186, 1);
  });

  it("achat conseillé : espèces étalées sur les mois restants", () => {
    expect(advisedMonthlyPurchase(89, 15, 1)).toBeCloseTo(89 / 14, 2);
    expect(advisedMonthlyPurchase(89, 15, 15)).toBe(89);
    expect(advisedMonthlyPurchase(-5, 15, 1)).toBe(0);
  });

  it("répartition d'un achat selon les parts cibles", () => {
    const split = splitByTarget(300, [
      { assetId: "a", value: 700, target: 0.5 },
      { assetId: "b", value: 300, target: 0.5 },
    ]);
    expect(split.get("b")).toBe(300);
    expect(split.get("a") ?? 0).toBe(0);
  });
});

describe("moteur : mécanismes", () => {
  it("transfert : déplace la valeur et le versé net d'un compte à l'autre", () => {
    const d = data({
      accounts: [acc("ldds", "livret"), acc("av", "assurance_vie")],
      transactions: [tx("2026-01-01", "apport_initial", "ldds", 5000), tx("2026-03-01", "transfert", "ldds", 1000, { counterAccountId: "av" })],
    });
    const s = computePortfolio(d, "2026-06-01");
    expect(s.accountById.get("ldds")!.value).toBe(4000);
    expect(s.accountById.get("av")!.value).toBe(1000);
    expect(s.accountById.get("av")!.netContrib).toBe(1000);
    expect(s.totals.netContrib).toBe(5000);
  });

  it("obligation : valorisation amortie, puis remboursement du nominal à l'échéance", () => {
    const d = data({
      accounts: [acc("cto", "cto")],
      assets: [asset("oat", "obligation", { couponRate: 0.03, maturityDate: "2028-05-25" })],
      transactions: [tx("2026-05-25", "apport_initial", "cto", 3000), tx("2026-05-25", "achat", "cto", 2919.73, { assetId: "oat", quantity: 3000, fee: 14.53 })],
    });
    const mid = computePortfolio(d, "2027-05-24");
    const pos = mid.accountById.get("cto")!.positions[0];
    expect(pos.priceUsed).toBe("modele");
    expect(pos.value).toBeGreaterThan(2919.73);
    expect(pos.value).toBeLessThan(3000 + 90);
    expect(pos.bond!.ytm!).toBeGreaterThan(0.03);

    const after = computePortfolio(d, "2028-06-01");
    const cto = after.accountById.get("cto")!;
    expect(cto.positions).toHaveLength(0);
    expect(cto.maturedBonds).toHaveLength(1);
    expect(cto.cash).toBeCloseTo(3000 - 2919.73 + 3000, 2);
  });

  it("signale une vente supérieure à la quantité détenue", () => {
    const d = data({
      accounts: [acc("pea", "pea")],
      assets: [asset("etf", "etf")],
      transactions: [tx("2026-01-01", "apport_initial", "pea", 100), tx("2026-01-02", "achat", "pea", 100, { assetId: "etf", quantity: 1 }), tx("2026-02-01", "vente", "pea", 250, { assetId: "etf", quantity: 2 })],
    });
    expect(computePortfolio(d, "2026-03-01").warnings[0]).toMatch(/seulement 1 détenus/);
  });

  it("TRI masqué avant un an, calculé ensuite", () => {
    const d = data({
      accounts: [acc("lep", "livret")],
      transactions: [tx("2025-01-01", "apport_initial", "lep", 1000), tx("2025-12-31", "interets", "lep", 30)],
    });
    expect(computePortfolio(d, "2025-12-31").performance.find((r) => r.key === "total")!.irrReason).toMatch(/Moins d'un an/);
    const r = computePortfolio(d, "2026-01-02").performance.find((r) => r.key === "total")!;
    expect(r.irr!).toBeCloseTo(0.03, 2);
  });

  it("allocation de la partie investie et action de rééquilibrage", () => {
    const d = sheetCase();
    const s = computePortfolio(d, TODAY);
    const croissance = s.allocation.rows.find((r) => r.bucket === "croissance")!;
    expect(croissance.action).toBe("alleger");
    expect(s.allocation.rows.find((r) => r.bucket === "garanti")!.action).toBe("renforcer");
  });
});

describe("fiscalité", () => {
  it("crypto : formule 150 VH bis sur un portefeuille de deux cryptos", () => {
    const d = data({
      accounts: [acc("c", "crypto")],
      assets: [asset("btc", "crypto"), asset("eth", "crypto")],
      transactions: [
        tx("2026-01-01", "apport_initial", "c", 2000),
        tx("2026-01-02", "achat", "c", 1000, { assetId: "btc", quantity: 1 }),
        tx("2026-01-02", "achat", "c", 1000, { assetId: "eth", quantity: 10 }),
        tx("2026-06-01", "vente", "c", 990, { assetId: "btc", quantity: 0.5, fee: 10 }),
      ],
      prices: [price("eth", "2026-05-31", 150)],
    });
    const r = cryptoTax(d, "2026-12-31");
    // V = 1 BTC × 2 000 (prix de cession unitaire) + 10 ETH × 150 = 3 500 ; PTA = 2 000.
    const sale = r.sales[0];
    expect(sale.portfolioValue).toBe(3500);
    expect(sale.attributed).toBeCloseTo((2000 * 1000) / 3500, 2);
    expect(sale.gain).toBeCloseTo(990 - (2000 * 1000) / 3500, 2);
    expect(r.remainingAcquisition).toBeCloseTo(2000 - (2000 * 1000) / 3500, 2);
    expect(r.years[0].exempt).toBe(false);
  });

  it("crypto : ventes annuelles sous 305 € exonérées", () => {
    const d = data({
      accounts: [acc("c", "crypto")],
      assets: [asset("btc", "crypto")],
      transactions: [tx("2026-01-01", "achat", "c", 100, { assetId: "btc", quantity: 1 }), tx("2026-06-01", "vente", "c", 300, { assetId: "btc", quantity: 0.5 })],
    });
    const y = cryptoTax(d, "2026-12-31").years[0];
    expect(y.exempt).toBe(true);
    expect(y.total).toBe(0);
  });

  it("assurance-vie : abattement après 8 ans", () => {
    const d = data({
      accounts: [acc("av", "assurance_vie", { openedOn: "2016-01-01" })],
      transactions: [tx("2016-01-01", "apport_initial", "av", 10000), tx("2025-12-31", "interets", "av", 6000)],
    });
    d.params.tax.tmi = 0.3;
    const s = computePortfolio(d, "2026-06-01");
    const row = withdrawalTaxes(d, s, cryptoTax(d, "2026-06-01"))[0];
    expect(row.tax).toBeCloseTo((6000 - 4600) * 0.075, 2);
  });

  it("coupons : brut reconstitué, acompte et régularisation", () => {
    const d = data({ accounts: [acc("cto", "cto")], transactions: [tx("2026-05-25", "interets", "cto", 68.6)] });
    const row = yearlyTaxes(d, cryptoTax(d, "2026-12-31"), "2026-12-31", []).find((r) => r.year === 2026)!;
    expect(row.couponsGross).toBeCloseTo(68.6 / (1 - 0.186 - 0.128), 2);
    expect(row.regularisation).toBeCloseTo(-row.withholding, 2); // TMI 0 % : l'acompte est remboursé
  });
});

describe("registre des cessions", () => {
  it("date chaque vente au coût moyen pondéré, frais d'achat compris", () => {
    const d = data({
      accounts: [acc("cto", "cto")],
      assets: [asset("a", "action")],
      transactions: [
        tx("2025-01-10", "achat", "cto", 1000, { assetId: "a", quantity: 10, fee: 5 }),
        tx("2025-02-10", "achat", "cto", 2000, { assetId: "a", quantity: 10, fee: 5 }),
        tx("2025-06-10", "vente", "cto", 900, { assetId: "a", quantity: 5, fee: 4 }),
      ],
    });
    const [v] = computePortfolio(d, "2025-12-31").disposals;
    expect(v).toMatchObject({ kind: "vente", date: "2025-06-10", proceeds: 900, fee: 4, cost: 750, gain: 150, oversold: false });
  });

  it("signale une vente supérieure à la quantité détenue", () => {
    const d = data({ accounts: [acc("cto", "cto")], assets: [asset("a", "action")], transactions: [tx("2025-01-10", "achat", "cto", 100, { assetId: "a", quantity: 1 }), tx("2025-02-10", "vente", "cto", 300, { assetId: "a", quantity: 3 })] });
    expect(computePortfolio(d, "2025-12-31").disposals[0]).toMatchObject({ oversold: true, cost: 100, gain: 200 });
  });

  it("obligation : le coupon couru saisi à la main remplace le calcul pour le prix d'achat", () => {
    const bond = asset("oat", "obligation", { couponRate: 0.03, maturityDate: "2028-05-25" });
    // Achat le jour d'un coupon : coupon couru calculé nul. Saisi à 30 €, le prix pied de coupon baisse d'autant.
    const buy = (extra: Partial<Transaction>) =>
      data({ accounts: [acc("cto", "cto")], assets: [bond], transactions: [tx("2026-05-25", "apport_initial", "cto", 3000), tx("2026-05-25", "achat", "cto", 2940, { assetId: "oat", quantity: 3000, ...extra })] });
    const value = (d: EngineData) => computePortfolio(d, "2026-05-25").accountById.get("cto")!.positions[0].value;
    expect(value(buy({}))).toBeCloseTo(2940, 2);
    expect(value(buy({ accrued: 30 }))).toBeCloseTo(2910, 2);
  });

  it("date le remboursement d'une obligation à son échéance", () => {
    const d = data({
      accounts: [acc("cto", "cto")],
      assets: [asset("oat", "obligation", { couponRate: 0.02, maturityDate: "2025-05-25" })],
      transactions: [tx("2024-01-15", "achat", "cto", 950, { assetId: "oat", quantity: 1000 })],
    });
    expect(computePortfolio(d, "2025-12-31").disposals[0]).toMatchObject({ kind: "remboursement", txId: null, date: "2025-05-25", proceeds: 1000, cost: 950, gain: 50 });
  });
});

describe("historique reconstruit", () => {
  it("un point par mois, cohérent avec le calcul du jour", () => {
    const d = sheetCase();
    const h = buildHistory(d, "2027-02-15");
    expect(h.map((p) => p.month)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(h.at(-1)!.value).toBe(computePortfolio(d, "2027-02-15").totals.value);
    expect(h[1].netContrib - h[0].netContrib).toBe(300);
  });

  it("PER, épargne salariale, PEA-PME : fiscalité au retrait", () => {
    const p = defaultParams(new Date(2026, 0, 1));
    const params = { ...p, tax: { ...p.tax, tmi: 0.3 as const } };
    const value = (id: string, kind: Account["kind"]) => ({ id, kind, livretType: null, name: id, institutionId: null, openedOn: "2015-01-01", depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false }) as Account;
    const tx = (id: string, accountId: string, type: "apport_initial" | "interets", amount: number) => ({ id, date: "2020-01-02", type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "" }) as const;
    const accounts = [value("per", "per"), value("pee", "epargne_salariale"), value("pme", "pea_pme")];
    const d: EngineData = { params, accounts, assets: [], plans: [], skips: [], prices: [], transactions: accounts.flatMap((a) => [tx(`a${a.id}`, a.id, "apport_initial", 1_000), tx(`i${a.id}`, a.id, "interets", 100)]) };
    const s = computePortfolio(d, "2026-06-01");
    const rows = withdrawalTaxes(d, s, cryptoTax(d, "2026-06-01"));
    const tax = (id: string) => rows.find((r) => r.accountId === id)!.tax;
    expect(tax("per")).toBeCloseTo(1_000 * 0.3 + 100 * (0.128 + 0.186));
    expect(tax("pee")).toBeCloseTo(100 * 0.186);
    expect(tax("pme")).toBeCloseTo(100 * 0.186);
    // Espèces du PER (assurantiel) : fonds euros ; celles de l'épargne salariale attendent d'être investies, comme dans un PEA.
    expect(s.buckets.garanti).toBe(1_100);
    expect(s.buckets.croissance).toBe(2_200);
  });

  it("crypto sur deux plateformes : le prix d'acquisition global n'est déduit qu'une fois", () => {
    const p = defaultParams(new Date(2026, 0, 1));
    const crypto = (id: string) => ({ id, kind: "crypto", livretType: null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false }) as Account;
    const btc = { id: "btc", kind: "crypto", name: "BTC", isin: null, symbol: "bitcoin", priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false } as Asset;
    const tx = (id: string, accountId: string, type: "apport_initial" | "achat") => ({ id, date: "2026-01-02", type, accountId, assetId: type === "achat" ? "btc" : null, counterAccountId: null, amount: 6_000, quantity: type === "achat" ? 5 : null, fee: null, comment: "" }) as Transaction;
    const accounts = [crypto("a"), crypto("b")];
    const d: EngineData = { params: p, accounts, assets: [btc], plans: [], skips: [], prices: [{ assetId: "btc", date: "2026-06-01", price: 2_000, source: "manuel" }], transactions: accounts.flatMap((a) => [tx(`d${a.id}`, a.id, "apport_initial"), tx(`b${a.id}`, a.id, "achat")]) };
    const s = computePortfolio(d, "2026-06-02");
    const rows = withdrawalTaxes(d, s, cryptoTax(d, "2026-06-02"));
    // 20 000 € de valeur, 12 000 € d'acquisition : 8 000 € de plus-value latente, à 11 % + 18,6 %.
    expect(rows.reduce((t, r) => t + r.tax, 0)).toBeCloseTo(8_000 * (0.11 + 0.186), 2);
    expect(rows[0]!.tax).toBeCloseTo(rows[1]!.tax, 2);
  });

  it("crowdlending : impôts prélevés par la plateforme ou restant à payer", () => {
    const p = defaultParams(new Date(2026, 0, 1));
    const plateforme = (id: string, institutionId: string | null) => ({ id, kind: "crowdlending", livretType: null, name: id, institutionId, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false }) as Account;
    const etab = (id: string, crowdlending: { taxWithheld: boolean; taxRate: number | null }) => ({ id, name: id, kind: "crowdlending", website: "", score: null, comment: "", offers: { crowdlending } }) as Institution;
    const interets = (accountId: string, amount: number) => ({ id: accountId, date: "2026-03-01", type: "interets", accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "" }) as Transaction;
    const accounts = [plateforme("preleve", "e30"), plateforme("forfait", "pfu"), plateforme("adeclarer", null)];
    const d: EngineData = { params: p, accounts, assets: [], plans: [], skips: [], prices: [], institutions: [etab("e30", { taxWithheld: true, taxRate: 0.3 }), etab("pfu", { taxWithheld: true, taxRate: null })], transactions: [interets("preleve", 70), interets("forfait", 68.6), interets("adeclarer", 100)] };
    const row = yearlyTaxes(d, cryptoTax(d, "2026-06-01"), "2026-06-01", []).find((y) => y.year === 2026)!;
    expect(row.crowdReceived).toBeCloseTo(238.6, 2);
    // 70 € nets à 30 % : 100 € bruts, 30 € prélevés. 68,60 € nets à 31,4 % : 100 € bruts, 31,40 € prélevés.
    expect(row.crowdWithheld).toBeCloseTo(61.4, 2);
    expect(row.crowdDue).toBeCloseTo(100 * (0.11 + 0.186), 2);
    expect(row.couponsNet).toBe(0);
    expect(row.total).toBeCloseTo(61.4 + 29.6, 2);
    const s = computePortfolio(d, "2026-06-01");
    const regime = (id: string) => withdrawalTaxes(d, s, cryptoTax(d, "2026-06-01")).find((r) => r.accountId === id)!.regime;
    expect(regime("preleve")).toContain("30 %");
    expect(regime("adeclarer")).toContain("à déclarer");
  });

  it("crowdlending : intérêts bruts puis impôts débités à part, comme sur le relevé de la plateforme", () => {
    const p = defaultParams(new Date(2026, 0, 1));
    const account = { id: "c", kind: "crowdlending", livretType: null, name: "c", institutionId: "e", openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false } as Account;
    const institution = { id: "e", name: "e", kind: "crowdlending", website: "", score: null, comment: "", offers: { crowdlending: { taxWithheld: true, taxRate: 0.314 } } } as Institution;
    const lines = crowdInterestEntries({ accountId: "c", month: "2026-03", monthLabel: "mars 2026", gross: 100, withheld: crowdWithholding(100, 0.314, p), today: "2026-06-01" });
    const transactions = lines.map((l, i) => ({ id: `t${i}`, assetId: null, counterAccountId: null, quantity: null, fee: null, ...l }) as Transaction);
    const d: EngineData = { params: p, accounts: [account], assets: [], plans: [], skips: [], prices: [], institutions: [institution], transactions };
    const row = yearlyTaxes(d, cryptoTax(d, "2026-06-01"), "2026-06-01", []).find((y) => y.year === 2026)!;
    // Comme 68,60 € saisis nets : 31,40 € déjà payés, rien de plus à payer.
    expect(row.crowdReceived).toBeCloseTo(68.6, 2);
    expect(row.crowdWithheld).toBeCloseTo(31.4, 2);
    expect(row.crowdDue).toBe(0);
    const acc = computePortfolio(d, "2026-06-01").accounts[0]!;
    expect(acc.cash).toBeCloseTo(68.6, 2);
    expect(acc.interests).toBeCloseTo(100, 2);
    expect(acc.taxes).toBeCloseTo(31.4, 2);
    expect(acc.fees).toBe(0);
  });
});

describe("patrimoine net dans le temps", () => {
  it("l'historique suit les estimations et le capital restant dû", () => {
    const bien: Property = { id: "b", kind: "locatif", ownership: "nom_propre", name: "Studio", value: 110_000, valueDate: "2026-03-15", purchasePrice: 100_000, purchaseDate: "2026-01-10", newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 0, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
    const pret: Loan = { id: "l", kind: "immobilier", name: "Prêt", propertyId: "b", share: 1, principal: 12_000, rate: 0, termMonths: 12, firstPayment: "2026-02-05", insuranceMode: "montant", insurance: 0, insuranceRate: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false, closedOn: null, deferredMonths: 0, deferredKind: "partiel", prepayments: [] };
    const d = data({ properties: [bien], loans: [pret], params: { ...data({}).params, profile: { ...data({}).params.profile, startMonth: "2025-12" } } });
    const h = buildHistory(d, "2026-04-20");
    expect(h.map((p) => [p.month, p.realEstate, p.debts, p.netWorth])).toEqual([
      ["2025-12", 0, 0, 0],
      ["2026-01", 100_000, 0, 100_000],
      ["2026-02", 100_000, 11_000, 89_000],
      ["2026-03", 110_000, 10_000, 100_000],
      ["2026-04", 110_000, 9_000, 101_000],
    ]);
  });
});

describe("patrimoine net", () => {
  it("compte la part détenue des biens et la part à charge des crédits", () => {
    const bien: Property = { id: "b", kind: "locatif", ownership: "indivision", name: "Studio", value: 200_000, valueDate: null, purchasePrice: null, purchaseDate: null, newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 0, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 0.5, inAllocation: null, classId: null, comment: "", archived: false };
    // Taux zéro : 1 000 € de capital par mois, 5 échéances passées au 1er juin.
    const pret: Loan = { id: "l", kind: "immobilier", name: "Prêt", propertyId: "b", share: 0.5, principal: 100_000, rate: 0, termMonths: 100, firstPayment: "2026-01-05", insuranceMode: "montant", insurance: 10, insuranceRate: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false, closedOn: null, deferredMonths: 0, deferredKind: "partiel", prepayments: [] };
    const { netWorth } = computePortfolio(data({ properties: [bien], loans: [pret] }), "2026-06-01");
    expect(netWorth.realEstate).toBe(100_000);
    expect(netWorth.debts).toBe(47_500);
    expect(netWorth.monthlyLoans).toBe(505);
    expect(netWorth.net).toBe(52_500);
  });

  it("ne compte que la part détenue d'un compte joint, sans toucher aux totaux du compte", () => {
    const joint = acc("joint", "livret", { livretType: "AUTRE", share: 0.5, inAllocation: true });
    const state = computePortfolio(data({ accounts: [joint], transactions: [tx("2026-01-10", "versement", "joint", 10_000)] }), "2026-06-01");
    expect(state.totals.value).toBe(10_000);
    expect(state.netWorth.financial).toBe(5_000);
    expect(state.netWorth.net).toBe(5_000);
    expect(state.allocation.invested).toBe(5_000);
  });

  it("évalue un bien en nue-propriété selon l'âge de l'usufruitier", () => {
    const bien: Property = { id: "b", kind: "autre", ownership: "nom_propre", name: "Maison", value: 300_000, valueDate: null, purchasePrice: null, purchaseDate: null, newBuild: false, ...NO_PROPERTY_DETAILS, dismemberment: "nue_propriete", usufructBirthDate: "1955-01-01", notaryFees: 0, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
    // Usufruitier de 71 ans : usufruit 30 %, nue-propriété 70 %.
    expect(computePortfolio(data({ properties: [bien] }), "2026-06-01").netWorth.realEstate).toBe(210_000);
    expect(buildHistory(data({ properties: [bien], transactions: [tx("2026-05-02", "versement", "x", 0)], accounts: [acc("x", "cto")] }), "2026-06-01").at(-1)?.realEstate).toBe(210_000);
  });
});
