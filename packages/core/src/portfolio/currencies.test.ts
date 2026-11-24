import { describe, expect, it } from "vitest";
import { defaultParams, FxBook, validateTransaction, type Account, type Asset, type FxRate, type PricePoint, type Transaction } from "../model";
import { couponCheck, maturityLadder, upcomingBondFlows } from "../analysis";
import { bondTaxes } from "../tax";
import { computePortfolio, type EngineData } from "./engine";

/** Titres en devise : coût en euros historiques, valeur au taux de change du jour, remboursement au taux de l'échéance. */

const cto: Account = {
  id: "cto", kind: "cto", livretType: null, name: "CTO", institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "",
  beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false,
};
const base: Asset = {
  id: "x", kind: "etf", name: "x", isin: null, symbol: null, priceSource: "auto", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null,
  manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null,
  issuer: null, bondKind: null, issuerCountry: null, archived: false,
};
const treasury: Asset = { ...base, id: "ust", kind: "obligation", name: "US Treasury 4 % 2030", priceSource: "modele", couponRate: 0.04, maturityDate: "2030-11-15", couponFrequency: 1, bondKind: "etat", issuerCountry: "US", currency: "USD" };
let n = 0;
const tx = (date: string, type: Transaction["type"], amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, date, type, accountId: "cto", assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra,
});
const usd = (date: string, rate: number): FxRate => ({ currency: "USD", date, rate });

function data(over: Partial<EngineData>): EngineData {
  return { params: defaultParams(new Date(2026, 10, 24)), accounts: [cto], assets: [treasury], transactions: [], plans: [], skips: [], prices: [], ...over };
}

// 10 000 USD de nominal payés 9 000 € frais compris (1 €), au taux de 1,09 USD pour 1 € : 9 808,91 USD hors frais.
const buy = tx("2026-11-16", "achat", 9000, { assetId: "ust", quantity: 10_000, fee: 1, fxRate: 1.09 });
const trades = [tx("2026-11-16", "apport_initial", 9000), buy];
const rates = [usd("2026-11-13", 1.08), usd("2027-05-14", 1.2), usd("2030-11-15", 1)];

describe("carnet des taux de change", () => {
  const book = new FxBook([usd("2026-11-13", 1.08), usd("2026-11-16", 1.1)]);
  it("prend le dernier taux publié (week-end : celui du vendredi)", () => {
    expect(book.rate("USD", "2026-11-15")).toBe(1.08);
    expect(book.rate("USD", "2026-11-16")).toBe(1.1);
  });
  it("l'euro vaut 1 ; une devise sans taux n'en a aucun ; avant le premier taux, le premier", () => {
    expect(book.rate("EUR", "2026-01-01")).toBe(1);
    expect(book.rate("GBP", "2026-11-16")).toBeNull();
    expect(book.rate("USD", "2020-01-01")).toBe(1.08);
  });
});

describe("moteur : obligation en dollars", () => {
  it("prix pied de coupon en dollars d'après le taux saisi, coût en euros", () => {
    const s = computePortfolio(data({ transactions: trades, fxRates: rates }), "2026-11-16");
    const p = s.accountById.get("cto")!.positions[0]!;
    expect(p.currency).toBe("USD");
    expect(p.cost).toBe(9000);
    expect(p.costFx).toBeCloseTo(9810, 2);
    // Prix pied de coupon = 8 999 € × 1,09 / 10 000, moins un jour de coupon couru.
    expect(p.bond!.lots[0]!.clean).toBeCloseTo(0.980891 - 0.04 / 365, 5);
    // Le jour de l'achat, la BCE donne 1,08 (taux du vendredi) : la valeur en euros en tient compte.
    expect(p.fxRate).toBe(1.08);
    expect(p.valueFx).toBeCloseTo(9808.91, 1);
    expect(p.value).toBeCloseTo(9808.91 / 1.08, 1);
  });

  it("valeur en euros au taux du jour, effet de change isolé", () => {
    const s = computePortfolio(data({ transactions: trades, fxRates: rates }), "2027-05-16");
    const p = s.accountById.get("cto")!.positions[0]!;
    expect(p.fxRate).toBe(1.2);
    expect(p.value).toBeCloseTo(p.valueFx / 1.2, 1);
    // Le dollar a baissé : 9 810 USD de coût ne valent plus que 8 175 €.
    expect(p.fxGain).toBeCloseTo(9810 / 1.2 - 9000, 1);
    expect(p.bond!.ytm!).toBeGreaterThan(0.04);
  });

  it("remboursement du nominal converti au taux de l'échéance, gain imposable en euros", () => {
    const s = computePortfolio(data({ transactions: trades, fxRates: rates }), "2030-12-01");
    const a = s.accountById.get("cto")!;
    expect(a.positions).toHaveLength(0);
    expect(a.cash).toBeCloseTo(10_000, 2);
    const d = s.disposals.find((x) => x.kind === "remboursement")!;
    expect(d.proceeds).toBe(10_000);
    expect(d.gain).toBe(1000);
  });

  it("sans aucun taux de la BCE : au pair, avec un avertissement", () => {
    const s = computePortfolio(data({ transactions: [tx("2026-11-16", "apport_initial", 9000), { ...buy, fxRate: null }] }), "2026-11-20");
    expect(s.warnings.some((w) => /Aucun taux de change connu pour USD/.test(w))).toBe(true);
    expect(s.accountById.get("cto")!.positions[0]!.fxRate).toBe(1);
  });

  it("flux à venir, échelle et impôts en euros au taux du jour", () => {
    const s = computePortfolio(data({ transactions: trades, fxRates: rates }), "2027-05-16");
    const held = s.accountById.get("cto")!.positions;
    const flows = upcomingBondFlows(held, "2027-05-16");
    expect(flows[0]!.coupon).toBeCloseTo(400 / 1.2, 2);
    expect(flows.at(-1)!.redemption).toBeCloseTo(10_000 / 1.2, 2);
    expect(maturityLadder(held, [], "2027-05-16").find((y) => y.year === 2030)!.etat).toBeCloseTo(10_000 / 1.2, 2);
    // 8 333 € remboursés pour 9 000 € payés : pas de gain à imposer.
    expect(bondTaxes(s.accounts, data({}).params, "2027-05-16").gainAhead).toBe(0);
  });

  it("coupon attendu en euros au taux de l'opération rapprochée", () => {
    const coupon = tx("2027-11-16", "interets", 350, { assetId: "ust", fxRate: 400 / 350 });
    const check = couponCheck([...trades, coupon], [treasury], "2027-12-31", new FxBook(rates));
    expect(check.events[0]!.expected).toBeCloseTo(350, 2);
    expect(check.events[0]!.received).toBe(350);
  });
});

describe("titre coté en devise", () => {
  const apple: Asset = { ...base, id: "aapl", kind: "action", name: "Apple", currency: "USD" };
  const price = (date: string, p: number): PricePoint => ({ assetId: "aapl", date, price: p, source: "marche" });
  it("cours en dollars converti au taux du jour", () => {
    const d = data({
      assets: [apple],
      transactions: [tx("2026-01-02", "apport_initial", 1000), tx("2026-01-02", "achat", 1000, { assetId: "aapl", quantity: 5, fxRate: 1.1 })],
      prices: [price("2026-06-01", 250)],
      fxRates: [usd("2026-06-01", 1.25)],
    });
    const p = computePortfolio(d, "2026-06-01").accountById.get("cto")!.positions[0]!;
    expect(p.value).toBe(1000);
    expect(p.pruFx).toBeCloseTo(220, 6);
    expect(p.fxGain).toBeCloseTo(1100 / 1.25 - 1000, 2);
  });
});

describe("validation du taux de change", () => {
  const accounts = new Map([["cto", cto]]);
  it("seulement sur un titre en devise, et positif", () => {
    const eurBond = { ...treasury, id: "oat", currency: null };
    const assets = new Map([["ust", treasury], ["oat", eurBond]]);
    const errs = (t: Partial<Transaction>) => validateTransaction({ ...tx("2026-11-16", "achat", 100, { quantity: 100 }), ...t }, accounts, assets).map((e) => e.field);
    expect(errs({ assetId: "ust", fxRate: 1.1 })).toEqual([]);
    expect(errs({ assetId: "ust", fxRate: 0 })).toEqual(["fxRate"]);
    expect(errs({ assetId: "oat", fxRate: 1.1 })).toEqual(["fxRate"]);
  });
});
