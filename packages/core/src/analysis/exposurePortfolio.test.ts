import { describe, expect, it } from "vitest";
import { defaultParams, type Account, type Asset, type Transaction } from "../model";
import { computePortfolio, type EngineData } from "../portfolio";
import { isinCountry, portfolioExposure, summarizeComposition, type EtfHolding } from "./exposure";

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1,
  entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
const titre = (id: string, kind: Asset["kind"], extra: Partial<Asset> = {}): Asset => ({
  id, kind, name: id, isin: null, symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: 100, manualPriceDate: "2026-01-01",
  targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, issuerCountry: null, archived: false, ...extra,
});
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra });
const line = (over: Partial<EtfHolding>): EtfHolding => ({ name: "X", isin: null, ticker: null, weight: 0, kind: "action", sector: "technologie", country: "US", currency: "USD", ...over });

/** PEA : ETF monde 6 000 €, ETF émergents 1 000 € (sans composition), action TotalEnergies 1 000 € ; compte-titres joint à 50 % : 4 000 € de l'ETF monde. */
function data(): EngineData {
  const params = defaultParams(new Date(2026, 0, 1));
  params.profile.startMonth = "2025-01";
  return {
    params,
    accounts: [acc("pea", "pea"), acc("cto", "cto", { share: 0.5 })],
    assets: [titre("Monde", "etf", { isin: "IE00B4L5Y983" }), titre("Émergents", "etf", { isin: "LU1681045370" }), titre("TotalEnergies", "action", { isin: "FR0000120271" }), titre("OAT", "obligation", { manualPrice: 100 })],
    transactions: [
      tx("2025-01-10", "apport_initial", "pea", 9_000),
      tx("2025-01-15", "achat", "pea", 6_000, { assetId: "Monde", quantity: 60 }),
      tx("2025-01-15", "achat", "pea", 1_000, { assetId: "Émergents", quantity: 10 }),
      tx("2025-01-15", "achat", "pea", 1_000, { assetId: "TotalEnergies", quantity: 10 }),
      tx("2025-01-10", "apport_initial", "cto", 5_000),
      tx("2025-01-15", "achat", "cto", 4_000, { assetId: "Monde", quantity: 40 }),
      tx("2025-01-15", "achat", "cto", 1_000, { assetId: "OAT", quantity: 10 }),
    ],
    plans: [],
    skips: [],
    prices: [],
  };
}

const monde = summarizeComposition([
  line({ name: "APPLE", ticker: "AAPL", weight: 0.7 }),
  line({ name: "TOTALENERGIES SE", isin: "FR0000120271", weight: 0.3, country: "FR", sector: "energie", currency: "EUR" }),
]);

describe("exposition réelle du portefeuille", () => {
  it("ETF répartis selon leur composition, part détenue des comptes joints, actions en direct par le pays de l'ISIN", () => {
    const d = data();
    const r = portfolioExposure(computePortfolio(d, "2026-06-01"), new Map([["Monde", monde]]));
    // Monde : 6 000 + 4 000 × 50 % = 8 000 € ; émergents 1 000 € sans composition ; TotalEnergies 1 000 € ; l'OAT n'en fait pas partie.
    expect(r.total).toBe(10_000);
    expect(r.covered).toBe(9_000);
    expect(r.assets.map((a) => [a.name, a.value, a.covered])).toEqual([
      ["Monde", 8_000, true],
      ["Émergents", 1_000, false],
      ["TotalEnergies", 1_000, true],
    ]);
    expect(r.countries.map((c) => [c.key, c.value])).toEqual([
      ["US", 5_600],
      ["FR", 3_400],
    ]);
    expect(r.countries[0]!.share).toBeCloseTo(5_600 / 9_000);
    // L'action en direct n'a pas de secteur connu.
    expect(r.sectors.map((s) => [s.key, s.value])).toEqual([
      ["technologie", 5_600],
      ["energie", 2_400],
      ["", 1_000],
    ]);
  });

  it("une même ligne détenue en direct et par un ETF est regroupée par son ISIN", () => {
    const d = data();
    const r = portfolioExposure(computePortfolio(d, "2026-06-01"), new Map([["Monde", monde]]));
    expect(r.top.map((t) => [t.name, t.value, t.via])).toEqual([
      ["APPLE", 5_600, ["Monde"]],
      ["TOTALENERGIES SE", 3_400, ["Monde", "en direct"]],
    ]);
  });

  it("sans aucune composition : tout est à part", () => {
    const d = data();
    d.assets = d.assets.filter((a) => a.kind !== "action");
    d.transactions = d.transactions.filter((t) => t.assetId !== "TotalEnergies");
    const r = portfolioExposure(computePortfolio(d, "2026-06-01"), new Map());
    expect(r).toMatchObject({ total: 9_000, covered: 0, countries: [], top: [] });
  });

  it("pays d'un ISIN : pas pour un titre international", () => {
    expect(isinCountry("FR0000120271")).toBe("FR");
    expect(isinCountry("XS1234567890")).toBeNull();
    expect(isinCountry(null)).toBeNull();
  });
});
