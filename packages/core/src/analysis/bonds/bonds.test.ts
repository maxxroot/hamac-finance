import { describe, expect, it } from "vitest";
import { defaultParams, type Account, type Asset, type BondPlan, type Transaction } from "../../model";
import { computePortfolio, type EngineData } from "../../portfolio";
import { bondBreakdown, bondGain, couponCheck, flowsByYear, flowsWithin, maturityLadder, realizedBondYield, trajectoryByYear, upcomingBondFlows, valueTrajectory } from ".";

// ——— Fabriques (montants fictifs) ———
const acc = (id: string, kind: Account["kind"]): Account => ({
  id, kind, livretType: null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "",
  beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false,
});
const bond = (id: string, extra: Partial<Asset>): Asset => ({
  id, kind: "obligation", name: id, isin: null, symbol: null, priceSource: "modele", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null,
  targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: 1, nextCouponDate: null, issuer: null, bondKind: null, issuerCountry: null, archived: false, ...extra,
});
let n = 0;
const tx = (date: string, type: Transaction["type"], amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, date, type, accountId: "cto", assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra,
});

const TODAY = "2026-11-13";
const oat = bond("oat", { couponRate: 0.03, maturityDate: "2030-05-25", bondKind: "etat", issuer: "République française" });
const societe = bond("societe", { couponRate: 0.04, maturityDate: "2027-03-01", bondKind: "entreprise", issuer: "Société Fictive" });
const echue = bond("echue", { couponRate: 0.01, maturityDate: "2023-05-25", bondKind: "etat" });
const plan: BondPlan = { id: "p", accountId: "cto", label: "Ligne longue", targetYear: 2032, nominal: 3000, comment: "" };

function data(transactions: Transaction[]): EngineData {
  return { params: defaultParams(new Date(2026, 10, 13)), accounts: [acc("cto", "cto")], assets: [oat, societe, echue], transactions, plans: [], skips: [], prices: [] };
}
const BUYS = [
  tx("2021-05-25", "apport_initial", 20_000),
  tx("2021-05-25", "achat", 2900, { assetId: "echue", quantity: 3000 }),
  tx("2025-03-01", "achat", 5000, { assetId: "societe", quantity: 5000 }),
  tx("2025-05-25", "achat", 9600, { assetId: "oat", quantity: 10_000 }),
];
function held(transactions = BUYS) {
  const cto = computePortfolio(data(transactions), TODAY).accountById.get("cto")!;
  return { held: cto.positions.filter((p) => p.bond), matured: cto.maturedBonds };
}

describe("obligations : flux à venir", () => {
  it("sépare coupons et remboursements, par 12 mois et par année", () => {
    const flows = upcomingBondFlows(held().held, TODAY);
    expect(flows.map((f) => [f.date, f.coupon, f.redemption])).toEqual([
      ["2027-03-01", 200, 5000],
      ["2027-05-25", 300, 0],
      ["2028-05-25", 300, 0],
      ["2029-05-25", 300, 0],
      ["2030-05-25", 300, 10_000],
    ]);
    expect(flowsWithin(flows, TODAY, 12)).toEqual({ coupons: 500, redemptions: 5000, count: 2 });
    expect(flowsByYear(flows)).toEqual([
      { year: 2027, coupons: 500, redemptions: 5000 },
      { year: 2028, coupons: 300, redemptions: 0 },
      { year: 2029, coupons: 300, redemptions: 0 },
      { year: 2030, coupons: 300, redemptions: 10_000 },
    ]);
  });

  it("trajectoire : la valeur rejoint le nominal, puis passe en remboursé", () => {
    const { held: h } = held();
    const points = valueTrajectory(h, TODAY);
    expect(points[0]!.date).toBe(TODAY);
    expect(points[0]!.value).toBeCloseTo(h.reduce((s, p) => s + p.value, 0), 2);
    // La veille de l'échéance de l'OAT : 100 % du nominal, plus un coupon couru presque complet.
    const before = points.find((p) => p.date === "2030-04-13")!;
    expect(before.value).toBeGreaterThan(10_000);
    expect(before.value).toBeLessThan(10_300);
    expect(before.redeemed).toBe(5000);
    expect(points.at(-1)).toEqual({ date: "2030-05-25", value: 0, redeemed: 15_000, coupons: 1400 });
  });

  it("trajectoire par année : aujourd'hui, la fin de chaque année, puis la dernière échéance", () => {
    const years = trajectoryByYear(valueTrajectory(held().held, TODAY));
    expect(years.map((y) => [y.year, y.date])).toEqual([
      [null, TODAY],
      [2026, "2026-12-31"],
      [2027, "2027-12-31"],
      [2028, "2028-12-31"],
      [2029, "2029-12-31"],
      [2030, "2030-05-25"],
    ]);
    // Fin 2027 : la Société Fictive est remboursée (5 000 €), deux coupons sont tombés (200 + 300 €).
    expect(years[2]).toMatchObject({ redeemed: 5000, coupons: 500 });
    expect(years.at(-1)).toMatchObject({ value: 0, redeemed: 15_000, coupons: 1400 });
  });
});

describe("obligations : échelle et répartition", () => {
  it("une barre par année, trous compris, jusqu'à la dernière ligne prévue", () => {
    const ladder = maturityLadder(held().held, [plan], TODAY);
    expect(ladder.map((r) => r.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032]);
    expect(ladder[1]).toEqual({ year: 2027, etat: 0, entreprise: 5000, planned: 0 });
    expect(ladder[4]).toEqual({ year: 2030, etat: 10_000, entreprise: 0, planned: 0 });
    expect(ladder[6]).toEqual({ year: 2032, etat: 0, entreprise: 0, planned: 3000 });
  });

  it("part de l'État et des entreprises, émetteurs du plus gros au plus petit", () => {
    const b = bondBreakdown(held().held);
    expect(b.nominal).toBe(15_000);
    expect(b.byKind.etat.share).toBeCloseTo(2 / 3, 6);
    expect(b.byIssuer.map((i) => [i.issuer, i.nominal])).toEqual([
      ["État · France", 10_000],
      ["Société Fictive", 5000],
    ]);
  });

  it("compte chaque État à part : une OLO n'est pas de la dette française", () => {
    const olo = bond("olo", { couponRate: 0.03, maturityDate: "2033-06-22", bondKind: "etat", issuerCountry: "BE" });
    const d = data([...BUYS, tx("2026-01-10", "achat", 4000, { assetId: "olo", quantity: 4000 })]);
    const cto = computePortfolio({ ...d, assets: [...d.assets, olo] }, TODAY).accountById.get("cto")!;
    const b = bondBreakdown(cto.positions.filter((p) => p.bond));
    expect(b.byIssuer.map((i) => [i.issuer, i.country, i.nominal])).toEqual([
      ["État · France", "FR", 10_000],
      ["Société Fictive", null, 5000],
      ["État · Belgique", "BE", 4000],
    ]);
    expect(b.byKind.etat.nominal).toBe(14_000);
  });
});

describe("obligations : coupons attendus et saisis", () => {
  it("rapproche le coupon saisi (brut si connu) et signale celui qui manque", () => {
    const txs = [...BUYS, tx("2026-05-27", "interets", 210, { assetId: "oat", gross: 300 })];
    const c = couponCheck(txs, [oat, societe, echue], TODAY);
    const in2026 = c.byYear.find((y) => y.year === 2026);
    expect(in2026).toEqual({ year: 2026, expected: 500, received: 300 });
    // Manquent : le coupon 2026 de la Société Fictive, et les deux coupons de l'OAT échue (2022, 2023).
    expect(c.events.filter((e) => e.received == null).map((e) => [e.assetId, e.date, e.expected])).toEqual([
      ["echue", "2022-05-25", 30],
      ["echue", "2023-05-25", 30],
      ["societe", "2026-03-01", 200],
    ]);
    expect(c.missing).toBe(3);
    expect(c.missingAmount).toBe(260);
    expect(c.receivedByLine.get("cto|oat")).toBe(300);
  });

  it("le coupon dû depuis moins de dix jours n'est pas encore réclamé", () => {
    const c = couponCheck(BUYS, [oat, societe, echue], "2026-05-30");
    expect(c.events.some((e) => e.date === "2026-05-25")).toBe(false);
    expect(couponCheck(BUYS, [oat, societe, echue], "2026-06-05").events.some((e) => e.date === "2026-05-25" && e.received == null)).toBe(true);
  });

  it("coupon mensuel : un coupon oublié reste manquant, celui du mois suivant ne le remplace pas", () => {
    const mensuel = bond("mensuel", { couponRate: 0.06, maturityDate: "2027-06-10", couponFrequency: 12, nextCouponDate: "2026-06-10" });
    const txs = [
      tx("2026-06-01", "achat", 1000, { assetId: "mensuel", quantity: 1000 }),
      tx("2026-07-10", "interets", 5, { assetId: "mensuel" }),
      // Août oublié ; septembre saisi deux jours en retard.
      tx("2026-09-12", "interets", 5, { assetId: "mensuel" }),
    ];
    const c = couponCheck(txs, [mensuel], "2026-09-30");
    expect(c.events.map((e) => [e.date, e.expected, e.received])).toEqual([
      ["2026-06-10", 5, null],
      ["2026-07-10", 5, 5],
      ["2026-08-10", 5, null],
      ["2026-09-10", 5, 5],
    ]);
  });

  it("le coupon revient à qui détient le titre la veille : un achat le jour du coupon n'y a pas droit", () => {
    const c = couponCheck(BUYS, [oat], TODAY);
    expect(c.events.filter((e) => e.assetId === "oat").map((e) => e.date)).toEqual(["2026-05-25"]);
  });
});

describe("obligations : ligne échue et gains", () => {
  it("rendement obtenu : achat, coupons saisis, remboursement du nominal", () => {
    const txs = [...BUYS, tx("2022-05-25", "interets", 30, { assetId: "echue" }), tx("2023-05-25", "interets", 30, { assetId: "echue" })];
    const { matured } = held(txs);
    // 2 900 = 30 / (1 + r) + 3 030 / (1 + r)², sur deux années pleines de 365 jours.
    expect(realizedBondYield(matured[0]!, txs)!).toBeCloseTo(0.027354, 5);
  });

  it("gain total : plus-value latente, gains réalisés et coupons reçus", () => {
    const txs = [...BUYS, tx("2022-05-25", "interets", 30, { assetId: "echue" })];
    const { held: h, matured } = held(txs);
    const g = bondGain(h, matured, couponCheck(txs, [oat, societe, echue], TODAY).receivedByLine);
    expect(g.realized).toBe(100);
    expect(g.coupons).toBe(30);
    expect(g.total).toBeCloseTo(g.latent + 130, 2);
  });
});
