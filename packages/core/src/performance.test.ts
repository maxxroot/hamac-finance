import { describe, expect, it } from "vitest";
import type { Account, Asset, PricePoint, Transaction } from "./domain";
import { computePortfolio, type EngineData } from "./engine";
import { buildHistory } from "./history";
import { defaultParams } from "./params";
import { assetPerformance, chainRates, comparableAssetIds, comparePerformance, envelopePerformance, gainSources, maxDrawdown, monthlyReturns, sameFlowsOn, scopePerformance, type MonthReturn } from "./performance";
import { PriceBook } from "./prices";

const acc = (id: string, kind: Account["kind"]): Account => ({ id, kind, livretType: null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false });
const asset = (id: string, kind: Asset["kind"] = "etf"): Asset => ({ id, kind, name: id, isin: null, symbol: null, priceSource: "auto", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false });
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra });
const price = (assetId: string, date: string, p: number): PricePoint => ({ assetId, date, price: p, source: "marche" });
function data(over: Partial<EngineData>): EngineData {
  const params = defaultParams(new Date(2026, 10, 7));
  params.profile = { ...params.profile, birthYear: 1990, retirementAge: 65, securisationAge: 65, startMonth: "2025-01" };
  return { params, accounts: [], assets: [], transactions: [], plans: [], skips: [], prices: [], ...over };
}
const month = (m: string, rate: number | null): MonthReturn => ({ month: m, date: `${m}-28`, value: 0, inflow: 0, gain: 0, rate });

describe("rendements mensuels (Dietz modifiée)", () => {
  it("pondère un versement selon le temps passé dans le mois", () => {
    const points = [{ month: "2025-03", date: "2025-03-31", value: 1000 }, { month: "2025-04", date: "2025-04-30", value: 1150 }];
    const [, april] = monthlyReturns(points, [{ date: "2025-04-15", amount: -100 }]);
    // Gain 50, base 1000 + 100 × 15/30 = 1050.
    expect(april!.gain).toBe(50);
    expect(april!.inflow).toBe(100);
    expect(april!.rate).toBeCloseTo(50 / 1050, 10);
  });
  it("un versement seul ne crée aucun rendement", () => {
    const points = [{ month: "2025-03", date: "2025-03-31", value: 1000 }, { month: "2025-04", date: "2025-04-30", value: 1500 }];
    expect(monthlyReturns(points, [{ date: "2025-04-10", amount: -500 }])[1]!.rate).toBe(0);
  });
  it("ne donne pas de taux quand l'argent vient d'arriver", () => {
    const [first] = monthlyReturns([{ month: "2025-04", date: "2025-04-30", value: 10_050 }], [{ date: "2025-04-30", amount: -10_000 }]);
    expect(first!.rate).toBeNull();
    expect(first!.gain).toBe(50);
  });
  it("enchaîne les mois, et un mois sans taux ne casse pas la chaîne", () => {
    expect(chainRates([0.1, null, -0.1])).toBeCloseTo(1.1 * 0.9 - 1, 10);
    expect(chainRates([null, null])).toBeNull();
  });
});

describe("plus forte baisse", () => {
  it("mesure du plus haut au plus bas, puis le retour au plus haut", () => {
    const d = maxDrawdown([month("2025-01", 0.1), month("2025-02", -0.2), month("2025-03", -0.1), month("2025-04", 0.5)])!;
    expect(d.depth).toBeCloseTo(0.8 * 0.9 - 1, 10);
    expect(d.troughMonth).toBe("2025-03");
    expect(d.recoveredMonth).toBe("2025-04");
  });
  it("sans retour au plus haut, et sans aucune baisse", () => {
    expect(maxDrawdown([month("2025-01", -0.1), month("2025-02", 0.05)])!.recoveredMonth).toBeNull();
    expect(maxDrawdown([month("2025-01", 0.1), month("2025-02", 0.05)])).toBeNull();
  });
});

describe("page Performance sur un portefeuille", () => {
  const ASOF = "2025-12-31";
  const base = () =>
    data({
      accounts: [acc("pea", "pea"), acc("cto", "cto")],
      assets: [asset("a"), asset("b"), asset("ref")],
      prices: [price("a", "2025-01-31", 10), price("a", "2025-06-30", 12), price("a", "2025-12-31", 15), price("b", "2025-01-31", 20), price("b", "2025-06-30", 30), price("ref", "2025-01-31", 100), price("ref", "2025-06-30", 110), price("ref", "2025-12-31", 121)],
      transactions: [
        tx("2025-01-10", "apport_initial", "pea", 1000),
        tx("2025-01-20", "achat", "pea", 500, { assetId: "a", quantity: 50, fee: 5 }),
        tx("2025-03-15", "dividende", "pea", 20, { assetId: "a" }),
        tx("2025-04-10", "frais", "pea", 10),
        tx("2025-01-10", "versement", "cto", 2000),
        tx("2025-02-01", "achat", "cto", 400, { assetId: "b", quantity: 20 }),
        tx("2025-07-01", "vente", "cto", 700, { assetId: "b", quantity: 20 }),
        tx("2025-09-30", "interets", "cto", 30),
      ],
    });

  it("d'où vient le gain : les lignes redonnent le gain du tableau de bord", () => {
    const d = base();
    const state = computePortfolio(d, ASOF);
    const history = buildHistory(d, ASOF);
    const ids = ["pea", "cto"];
    const s = gainSources(null, history.at(-1)!, ids);
    expect(s.total).toBe(state.totals.gain);
    expect(s.unrealized + s.realized + s.dividends + s.interests - s.billedFees + s.other).toBeCloseTo(s.total, 2);
    expect(s.unrealized).toBe(250); // 50 × 15 − 500
    expect(s.realized).toBe(300); // 700 − 400
    expect(s.dividends).toBe(20);
    expect(s.interests).toBe(30);
    expect(s.billedFees).toBe(10);
    expect(s.allFees).toBe(15); // 10 à part + 5 dans l'achat
    expect(s.other).toBe(0);
  });

  it("d'où vient le gain : les impôts débités à part ont leur ligne, distincte des frais", () => {
    const d = base();
    d.transactions = [...d.transactions, tx("2025-09-30", "impots", "cto", 9)];
    const state = computePortfolio(d, ASOF);
    const s = gainSources(null, buildHistory(d, ASOF).at(-1)!, ["pea", "cto"]);
    expect(s.total).toBe(state.totals.gain);
    expect(s.taxes).toBe(9);
    expect(s.billedFees).toBe(10);
    expect(s.other).toBe(0);
    const cto = state.accounts.find((a) => a.account.id === "cto")!;
    expect(cto).toMatchObject({ taxes: 9, fees: 0 });
  });

  it("sur une période, seul ce qui s'est passé depuis le point de départ compte", () => {
    const d = base();
    const state = computePortfolio(d, ASOF);
    const p = scopePerformance(d, state, buildHistory(d, ASOF), ["pea", "cto"], 3)!;
    // Départ fin septembre : A à 12 € au dernier cours connu, puis 15 € ; les intérêts du 30/09 sont déjà passés.
    expect(p.sources.total).toBe(150);
    expect(p.sources.interests).toBe(0);
    expect(p.summary.inflow).toBe(0);
    expect(p.curve[0]!.cumulative).toBe(0);
    expect(p.windowMonths).toBe(3);
    expect(p.summary.annualized).toBeNull();
  });

  it("année par année et calendrier", () => {
    const d = base();
    const p = scopePerformance(d, computePortfolio(d, ASOF), buildHistory(d, ASOF), ["pea"], null)!;
    expect(p.years).toHaveLength(1);
    expect(p.years[0]).toMatchObject({ year: 2025, startValue: 0, inflow: 1000, income: 20, fees: 15 });
    expect(p.years[0]!.gain).toBe(p.summary.gain);
    expect(p.calendar[0]!.months).toHaveLength(12);
    expect(p.stats!.counted).toBeGreaterThan(0);
  });

  it("signale les mois comptés au prix de revient, faute de cours", () => {
    const d = base();
    d.prices = d.prices.filter((x) => x.assetId !== "a");
    const p = scopePerformance(d, computePortfolio(d, ASOF), buildHistory(d, ASOF), ["pea"], null)!;
    expect(p.unpricedMonths).toBe(12);
  });

  it("classe les titres, y compris ceux entièrement vendus", () => {
    const d = base();
    const rows = assetPerformance(d, computePortfolio(d, ASOF), buildHistory(d, ASOF), ["pea", "cto"], null);
    expect(rows.map((r) => r.assetId)).toEqual(["b", "a"]);
    expect(rows[0]).toMatchObject({ value: 0, gain: 300 });
    expect(rows[1]).toMatchObject({ value: 750, gain: 270, income: 20 });
  });

  it("tableau par enveloppe : mêmes chiffres que le moteur depuis le début, impôts déduits", () => {
    const d = base();
    const state = computePortfolio(d, ASOF);
    const rows = envelopePerformance(d, state, buildHistory(d, ASOF), [{ accountId: "cto", label: "cto", value: 0, gain: 0, tax: 40, regime: "" }], null);
    const cto = rows.find((r) => r.key === "cto")!;
    const stateRow = state.performance.find((r) => r.key === "cto")!;
    expect(cto.gain).toBe(stateRow.gain);
    expect(cto.afterTax).toBe(stateRow.gain - 40);
    expect(cto.accounts.map((a) => a.key)).toEqual(["cto"]);
    expect(rows.at(-1)!.key).toBe("total");
  });

  it("compare un compte à un titre depuis un même point de départ", () => {
    const d = base();
    expect(comparableAssetIds(d)).toEqual(["a", "b", "ref"]);
    const c = comparePerformance(d, computePortfolio(d, ASOF), buildHistory(d, ASOF), { kind: "accounts", accountIds: ["pea"] }, { kind: "asset", assetId: "ref" }, null)!;
    expect(c.left[0]).toBe(0);
    expect(c.right[0]).toBe(0);
    expect(c.dates[0]).toBe("2025-01");
    expect(c.daily).toBe(false);
    expect(c.rightRate).toBeCloseTo(0.21, 10);
    expect(c.whatIf!.actual).toBe(1260);
    // 1000 € fin janvier au cours de 100 → 10 parts, valant 121 € à la fin.
    expect(c.whatIf!.simulated).toBeCloseTo(1210, 2);
  });

  it("deux titres : seule leur période commune compte, et pas de versements à simuler", () => {
    const d = base();
    d.prices = [...d.prices, price("late", "2025-11-30", 50), price("late", "2025-12-31", 55)];
    d.assets = [...d.assets, asset("late")];
    const c = comparePerformance(d, computePortfolio(d, ASOF), buildHistory(d, ASOF), { kind: "asset", assetId: "a" }, { kind: "asset", assetId: "late" }, null)!;
    expect(c.daily).toBe(true);
    expect(c.dates[0]).toBe("2025-11-30");
    expect(c.dates.at(-1)).toBe("2025-12-31");
    expect(c.rightRate).toBeCloseTo(0.1, 10);
    expect(c.whatIf).toBeNull();
  });

  it("deux titres qu'on ne détient pas : comparés au-delà de la durée du portefeuille, et sur la période demandée", () => {
    const d = base();
    const history = buildHistory(d, ASOF);
    const state = computePortfolio(d, ASOF);
    const gauche = { kind: "series", points: [{ date: "2015-01-01", price: 100 }, { date: "2024-12-31", price: 150 }, { date: "2025-12-31", price: 200 }] } as const;
    const droite = { kind: "series", points: [{ date: "2010-06-01", price: 10 }, { date: "2015-01-01", price: 20 }, { date: "2025-12-31", price: 30 }] } as const;
    const tout = comparePerformance(d, state, history, gauche, droite, null)!;
    expect(tout.dates[0]).toBe("2015-01-01");
    expect(tout.leftRate).toBeCloseTo(1, 10);
    expect(tout.rightRate).toBeCloseTo(0.5, 10);
    // Sur un an, le départ est le dernier cours connu à cette date, ici celui de fin 2024 pour le premier titre.
    const unAn = comparePerformance(d, state, history, gauche, droite, 12)!;
    expect(unAn.dates[0] > "2024-12-30").toBe(true);
    expect(unAn.leftRate).toBeCloseTo(200 / 150 - 1, 10);
    expect(unAn.rightRate).toBeCloseTo(0.5, 10);
  });

  it("un portefeuille face à un titre non détenu garde les mêmes versements simulés", () => {
    const d = base();
    const ref = d.prices.filter((p) => p.assetId === "ref").map((p) => ({ date: p.date, price: p.price }));
    const parSerie = comparePerformance(d, computePortfolio(d, ASOF), buildHistory(d, ASOF), { kind: "accounts", accountIds: ["pea"] }, { kind: "series", points: ref }, null)!;
    expect(parSerie.rightRate).toBeCloseTo(0.21, 10);
    expect(parSerie.whatIf!.simulated).toBeCloseTo(1210, 2);
  });

  it("espace les points d'un très long historique, en gardant le premier et le dernier", () => {
    const d = base();
    const jours = (prix: number) => Array.from({ length: 2000 }, (_, i) => ({ date: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10), price: prix + i }));
    const c = comparePerformance(d, computePortfolio(d, "2025-06-20"), buildHistory(d, "2025-06-20"), { kind: "series", points: jours(100) }, { kind: "series", points: jours(50) }, null)!;
    expect(c.dates.length).toBeLessThanOrEqual(301);
    expect(c.dates[0]).toBe("2020-01-01");
    expect(c.dates.at(-1)).toBe("2025-06-20");
  });

  it("une référence sans assez de cours communs ne donne rien", () => {
    const d = base();
    const c = comparePerformance(d, computePortfolio(d, ASOF), buildHistory(d, ASOF), { kind: "accounts", accountIds: ["pea"] }, { kind: "asset", assetId: "absent" }, null);
    expect(c).toBeNull();
  });
});

describe("mêmes versements sur un autre titre", () => {
  it("achète au cours connu à chaque date et revend aux retraits", () => {
    const book = new PriceBook([price("x", "2025-01-31", 10), price("x", "2025-02-28", 20), price("x", "2025-03-31", 40)]);
    const flows = [{ date: "2025-02-28", amount: -200 }, { date: "2025-03-31", amount: 400 }];
    // 100 € à 10 € = 10 parts ; +200 € à 20 € = 20 parts ; −400 € à 40 € = 10 parts ; 10 × 40 €.
    expect(sameFlowsOn(book, "x", 100, "2025-01-31", flows, "2025-03-31")).toBe(400);
  });
});

describe("hypothèse du plan d'un compte-titres", () => {
  it("suit ce que contient le compte", () => {
    const d = data({
      accounts: [acc("cto", "cto")],
      assets: [asset("etf"), asset("bond", "obligation")],
      prices: [price("etf", "2025-06-30", 10)],
      transactions: [tx("2025-01-10", "versement", "cto", 1000), tx("2025-02-01", "achat", "cto", 1000, { assetId: "etf", quantity: 100 })],
    });
    const row = computePortfolio(d, "2025-12-31").performance.find((r) => r.key === "cto")!;
    expect(row.assumption).toBe(d.params.returns.actions);
  });
  it("sans titre, reste sur les obligations", () => {
    const d = data({ accounts: [acc("cto", "cto")], transactions: [tx("2025-01-10", "versement", "cto", 1000)] });
    expect(computePortfolio(d, "2025-12-31").performance.find((r) => r.key === "cto")!.assumption).toBe(d.params.returns.obligations);
  });
});
