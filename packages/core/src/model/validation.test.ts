import { describe, expect, it } from "vitest";
import type { Account, Asset } from "./domain";
import { uniqueAccountConflict, validateTransaction } from "./validation";

const acc = (id: string, kind: Account["kind"]): Account => ({
  id, kind, livretType: null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "",
  beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false,
});
const asset = (id: string, kind: Asset["kind"]): Asset => ({
  id, kind, name: id, isin: null, symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null, targetWeight: null,
  ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false,
});
const accounts = new Map([["pea", acc("pea", "pea")], ["lep", acc("lep", "livret")], ["btc", acc("btc", "crypto")]]);
const assets = new Map([["sp500", asset("sp500", "etf")], ["bitcoin", asset("bitcoin", "crypto")]]);
const base = { date: "2026-11-01", accountId: "pea", assetId: null, counterAccountId: null, amount: 100, quantity: null, fee: null, comment: "" };

describe("validateTransaction", () => {
  it("accepte un achat d'ETF dans un PEA", () => {
    expect(validateTransaction({ ...base, type: "achat", assetId: "sp500", quantity: 2 }, accounts, assets)).toEqual([]);
  });
  it("refuse une crypto dans un PEA et un achat sans quantité", () => {
    const errs = validateTransaction({ ...base, type: "achat", assetId: "bitcoin" }, accounts, assets).map((e) => e.field);
    expect(errs).toContain("assetId");
    expect(errs).toContain("quantity");
  });
  it("brut et retenues : seulement sur un revenu, et jamais un brut sous le net reçu", () => {
    expect(validateTransaction({ ...base, type: "dividende", gross: 145.77, withheldIncomeTax: 18.66, withheldSocial: 27.11 }, accounts, assets)).toEqual([]);
    expect(validateTransaction({ ...base, type: "dividende", gross: 90 }, accounts, assets)[0].field).toBe("gross");
    expect(validateTransaction({ ...base, type: "versement", gross: 120 }, accounts, assets)[0].field).toBe("gross");
  });
  it("refuse un achat sur un livret", () => {
    expect(validateTransaction({ ...base, accountId: "lep", type: "achat", assetId: "sp500", quantity: 1 }, accounts, assets).length).toBeGreaterThan(0);
  });
  it("exige une destination distincte pour un transfert", () => {
    expect(validateTransaction({ ...base, accountId: "lep", type: "transfert" }, accounts, assets)[0].field).toBe("counterAccountId");
    expect(validateTransaction({ ...base, accountId: "lep", type: "transfert", counterAccountId: "lep" }, accounts, assets)[0].field).toBe("counterAccountId");
    expect(validateTransaction({ ...base, accountId: "lep", type: "transfert", counterAccountId: "pea" }, accounts, assets)).toEqual([]);
  });
  it("montant positif, sauf correction (non nulle)", () => {
    expect(validateTransaction({ ...base, type: "versement", amount: -5 }, accounts, assets)[0].field).toBe("amount");
    expect(validateTransaction({ ...base, type: "correction", amount: -5 }, accounts, assets)).toEqual([]);
    expect(validateTransaction({ ...base, type: "correction", amount: 0 }, accounts, assets)[0].field).toBe("amount");
  });
  it("coupon couru saisi : seulement à l'achat ou à la vente d'une obligation, et sous le montant", () => {
    const cto = new Map([["cto", acc("cto", "cto")]]);
    const bonds = new Map([...assets, ["oat", asset("oat", "obligation")]]);
    const buy = { ...base, accountId: "cto", type: "achat" as const, assetId: "oat", quantity: 1000, amount: 990, fee: 2 };
    expect(validateTransaction({ ...buy, accrued: 10 }, cto, bonds)).toEqual([]);
    expect(validateTransaction({ ...buy, accrued: 0 }, cto, bonds)).toEqual([]);
    expect(validateTransaction({ ...buy, accrued: 989 }, cto, bonds)[0].field).toBe("accrued");
    expect(validateTransaction({ ...buy, type: "vente", accrued: 989 }, cto, bonds)).toEqual([]);
    expect(validateTransaction({ ...buy, assetId: "sp500", quantity: 1, accrued: 10 }, cto, bonds)[0].field).toBe("accrued");
  });
});

describe("comptes uniques", () => {
  it("un seul PEA, LEP, LDDS, Livret A ; comptes-titres et autres livrets illimités", () => {
    const list = [acc("pea", "pea"), { ...acc("lep", "livret"), livretType: "LEP" as const }];
    expect(uniqueAccountConflict(list, { kind: "pea", livretType: null })?.id).toBe("pea");
    expect(uniqueAccountConflict(list, { id: "pea", kind: "pea", livretType: null })).toBeNull();
    expect(uniqueAccountConflict(list, { kind: "livret", livretType: "LEP" })?.id).toBe("lep");
    expect(uniqueAccountConflict(list, { kind: "livret", livretType: "LDDS" })).toBeNull();
    expect(uniqueAccountConflict(list, { kind: "livret", livretType: "AUTRE" })).toBeNull();
    expect(uniqueAccountConflict(list, { kind: "cto", livretType: null })).toBeNull();
    expect(uniqueAccountConflict([{ ...acc("old", "pea"), archived: true }], { kind: "pea", livretType: null })).toBeNull();
    expect(uniqueAccountConflict([acc("p", "pea_pme")], { kind: "pea_pme", livretType: null })?.id).toBe("p");
    expect(uniqueAccountConflict([acc("p", "pea")], { kind: "pea_pme", livretType: null })).toBeNull();
    expect(uniqueAccountConflict([acc("p", "per")], { kind: "per", livretType: null })).toBeNull();
  });
});