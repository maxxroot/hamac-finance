import { describe, expect, it } from "vitest";
import { defaultParams, type Account, type Asset, type Transaction } from "../model";
import { computePortfolio, type EngineData } from "../portfolio";
import { bondTaxes } from "./bondTax";

// Montants fictifs. OAT 3 % échéance 25/05/2030, 10 000 € de nominal achetés à 96 % le jour d'un coupon.
const TODAY = "2026-11-13";
const account = (kind: Account["kind"], openedOn: string | null = null): Account => ({
  id: "c", kind, livretType: null, name: "c", institutionId: null, openedOn, depositCeiling: null, rate: null, role: "",
  beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false,
});
const oat: Asset = {
  id: "oat", kind: "obligation", name: "OAT", isin: null, symbol: null, priceSource: "modele", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null,
  targetWeight: null, ter: null, couponRate: 0.03, maturityDate: "2030-05-25", couponFrequency: 1, nextCouponDate: null, issuer: null, bondKind: "etat", issuerCountry: "FR", archived: false,
};
const tx = (type: Transaction["type"], amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: type, date: "2025-05-25", type, accountId: "c", assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra,
});

function run(acc: Account) {
  const params = defaultParams(new Date(2026, 10, 13));
  params.tax = { ...params.tax, tmi: 0.3, pfuIncomeTax: 0.128, socialGeneral: 0.186, socialAv: 0.172, avAfter8: 0.075 };
  const data: EngineData = { params, accounts: [acc], assets: [oat], transactions: [tx("apport_initial", 9600), tx("achat", 9600, { assetId: "oat", quantity: 10_000 })], plans: [], skips: [], prices: [] };
  const state = computePortfolio(data, TODAY);
  return { tax: bondTaxes(state.accounts, params, TODAY), ytm: state.accounts[0]!.positions[0]!.bond!.ytm! };
}

describe("obligations : impôts et rendement après impôts", () => {
  it("compte-titres : 12,8 % + 18,6 % sur les coupons et sur le gain au remboursement", () => {
    const { tax, ytm } = run(account("cto"));
    // Quatre coupons de 300 € restent à venir ; gain au remboursement : 10 000 − 9 600 = 400 €.
    expect(tax.couponsAhead).toBe(1200);
    expect(tax.couponTax).toBeCloseTo(1200 * 0.314, 2);
    expect(tax.gainAhead).toBe(400);
    expect(tax.gainTax).toBeCloseTo(400 * 0.314, 2);
    // Calcul à la main : −9 600 en 2025, 205,80 € net par an, 205,80 + 10 000 − 125,60 en 2030.
    expect(tax.netYtm!).toBeCloseTo(0.02684, 4);
    expect(ytm).toBeCloseTo(0.03894, 4);
    expect(tax.lifeInsurance).toBe(false);
  });

  it("assurance-vie de plus de 8 ans : 7,5 % + 17,2 %, au retrait", () => {
    const { tax } = run(account("assurance_vie", "2015-01-01"));
    expect(tax.couponTax).toBeCloseTo(1200 * 0.247, 2);
    expect(tax.gainTax).toBeCloseTo(400 * 0.247, 2);
    expect(tax.lifeInsurance).toBe(true);
  });

  it("une obligation achetée au-dessus du pair : pas d'impôt sur le remboursement", () => {
    const params = defaultParams(new Date(2026, 10, 13));
    const data: EngineData = { params, accounts: [account("cto")], assets: [oat], transactions: [tx("apport_initial", 10_400), tx("achat", 10_400, { assetId: "oat", quantity: 10_000 })], plans: [], skips: [], prices: [] };
    const tax = bondTaxes(computePortfolio(data, TODAY).accounts, params, TODAY);
    expect(tax.gainAhead).toBe(0);
    expect(tax.gainTax).toBe(0);
  });
});
