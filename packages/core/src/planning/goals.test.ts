import { describe, expect, it } from "vitest";
import { defaultParams, type Account, type Asset, type Transaction } from "../model";
import { computePortfolio, type EngineData } from "../portfolio";
import { goalProgress, monthlySaving, overAllocatedAccounts, type Goal } from "./goals";

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: kind === "livret" ? "AUTRE" : null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1,
  entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
const etf: Asset = {
  id: "etf", kind: "etf", name: "ETF", isin: null, symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: 100, manualPriceDate: "2026-01-01",
  targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false,
};
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra });

function state() {
  const params = defaultParams(new Date(2026, 0, 1));
  params.profile.startMonth = "2025-01";
  const data: EngineData = {
    params,
    accounts: [acc("livret", "livret"), acc("pea", "pea")],
    assets: [etf],
    transactions: [tx("2025-01-10", "apport_initial", "livret", 10_000), tx("2025-01-10", "apport_initial", "pea", 8_000), tx("2025-01-15", "achat", "pea", 8_000, { assetId: "etf", quantity: 80 })],
    plans: [],
    skips: [],
    prices: [],
  };
  return computePortfolio(data, "2026-06-01");
}

const goal = (over: Partial<Goal> = {}): Goal => ({ id: "g", name: "Voiture", target: 20_000, targetDate: "2028-06-01", startDate: "2025-06-01", rate: 0, allocations: [], comment: "", archived: false, ...over });

describe("projets", () => {
  it("additionne une part en pourcentage et un montant réservé, plafonné à la valeur du compte", () => {
    const s = state();
    const p = goalProgress(goal({ allocations: [{ accountId: "livret", mode: "pourcentage", value: 0.5 }, { accountId: "pea", mode: "montant", value: 12_000 }] }), s);
    expect(p.contributions.map((c) => c.amount)).toEqual([5_000, 8_000]);
    expect(p).toMatchObject({ saved: 13_000, remaining: 7_000, monthsLeft: 24 });
    expect(p.progress).toBeCloseTo(0.65, 5);
  });

  it("calcule le versement mensuel nécessaire, à 0 % et avec un rendement", () => {
    expect(monthlySaving(20_000, 13_000, 24, 0)).toBeCloseTo(291.67, 2);
    // Avec 3 % par an, l'épargne déjà réunie travaille : il faut moins chaque mois.
    expect(monthlySaving(20_000, 13_000, 24, 0.03)).toBeLessThan(291.67);
    expect(monthlySaving(20_000, 25_000, 24, 0)).toBe(0);
    expect(monthlySaving(20_000, 13_000, 0, 0)).toBe(7_000);
  });

  it("dit si le projet est en avance ou en retard, et prévient d'une échéance proche placée en actions", () => {
    const s = state();
    // 12 mois écoulés sur 36 : 6 667 € attendus.
    expect(goalProgress(goal({ allocations: [{ accountId: "livret", mode: "pourcentage", value: 1 }] }), s).status).toBe("en_avance");
    expect(goalProgress(goal({ allocations: [{ accountId: "livret", mode: "montant", value: 5_000 }] }), s).status).toBe("en_retard");
    expect(goalProgress(goal({ target: 5_000, allocations: [{ accountId: "livret", mode: "pourcentage", value: 1 }] }), s).status).toBe("atteint");
    const enActions = goalProgress(goal({ allocations: [{ accountId: "pea", mode: "pourcentage", value: 1 }] }), s);
    expect(enActions.riskyShare).toBe(1);
    expect(enActions.warning).toMatch(/100 % en actions/);
  });

  it("signale un compte affecté à plus que sa valeur", () => {
    const s = state();
    const goals = [goal({ allocations: [{ accountId: "livret", mode: "pourcentage", value: 0.7 }] }), goal({ id: "g2", allocations: [{ accountId: "livret", mode: "montant", value: 4_000 }] }), goal({ id: "g3", archived: true, allocations: [{ accountId: "pea", mode: "montant", value: 50_000 }] })];
    expect(overAllocatedAccounts(goals, s)).toEqual([{ accountId: "livret", name: "livret", allocated: 11_000, value: 10_000 }]);
  });
});
