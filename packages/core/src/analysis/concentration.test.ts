import { describe, expect, it } from "vitest";
import { computeAlerts } from "../alerts";
import { concentrationReport } from "./concentration";
import { defaultParams, type Account, type Asset, type Transaction } from "../model";
import { computePortfolio, type EngineData } from "../portfolio";
import { volatility, type MonthReturn } from "./performance";

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: kind === "livret" ? "AUTRE" : null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1,
  entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
const titre = (id: string, kind: Asset["kind"], extra: Partial<Asset> = {}): Asset => ({
  id, kind, name: id, isin: null, symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: 100, manualPriceDate: "2026-01-01",
  targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, issuerCountry: null, archived: false, ...extra,
});
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra });

function data(): EngineData {
  const params = defaultParams(new Date(2026, 0, 1));
  params.profile.startMonth = "2025-01";
  return {
    params,
    accounts: [acc("pea", "pea"), acc("cto", "cto", { share: 0.5 }), acc("livret", "livret")],
    assets: [titre("ETF Monde", "etf"), titre("Action A", "action"), titre("OAT 2030", "obligation", { bondKind: "etat", manualPrice: null, priceSource: "manuel" })],
    transactions: [
      tx("2025-01-10", "apport_initial", "pea", 5_000),
      tx("2025-01-15", "achat", "pea", 3_000, { assetId: "ETF Monde", quantity: 30 }),
      tx("2025-01-15", "achat", "pea", 1_000, { assetId: "Action A", quantity: 10 }),
      tx("2025-01-10", "apport_initial", "cto", 2_000),
      tx("2025-01-15", "achat", "cto", 2_000, { assetId: "Action A", quantity: 20 }),
      tx("2025-01-10", "apport_initial", "livret", 3_000),
    ],
    plans: [],
    skips: [],
    prices: [],
  };
}

describe("concentration", () => {
  it("regroupe un titre d'un compte à l'autre, à la part détenue des comptes joints", () => {
    const d = data();
    const r = concentrationReport(d, computePortfolio(d, "2026-06-01"));
    // Patrimoine financier : PEA 5 000 + moitié du compte-titres 1 000 + livret 3 000.
    expect(r.base).toBe(9_000);
    expect(r.lines.map((l) => [l.label, l.value])).toEqual([
      ["ETF Monde", 3_000],
      ["Action A", 2_000],
    ]);
    expect(r.top1).toBeCloseTo(3_000 / 9_000, 5);
  });

  it("signale au-delà du seuil, ETF compris", () => {
    const d = data();
    const state = computePortfolio(d, "2026-06-01");
    expect(concentrationReport(d, state).alerts.map((a) => a.label)).toEqual(["ETF Monde", "Action A"]);
    d.params.alerts.concentrationMax = 0.3;
    expect(concentrationReport(d, state).alerts.map((a) => a.label)).toEqual(["ETF Monde"]);
    expect(computeAlerts(d, state).find((a) => a.id === "concentration-titre-ETF Monde")?.title).toBe("ETF Monde : 33 % du patrimoine financier");
    d.params.alerts.concentrationMax = 0;
    expect(concentrationReport(d, state).alerts).toEqual([]);
  });

  it("juge les obligations par émetteur, sans alerte pour l'État", () => {
    // Obligations sans cours : comptées à leur prix de revient.
    const base = data();
    const d: EngineData = {
      ...base,
      accounts: [...base.accounts, acc("cto2", "cto")],
      assets: [...base.assets, titre("Obligation B", "obligation", { issuer: "Entreprise Fictive", bondKind: "entreprise", manualPrice: null })],
      transactions: [
        ...base.transactions,
        tx("2025-01-10", "apport_initial", "cto2", 6_000),
        tx("2025-01-15", "achat", "cto2", 3_000, { assetId: "Obligation B", quantity: 3_000 }),
        tx("2025-01-15", "achat", "cto2", 3_000, { assetId: "OAT 2030", quantity: 3_000 }),
      ],
    };
    const r = concentrationReport(d, computePortfolio(d, "2026-06-01"));
    expect(r.issuers.map((i) => [i.label, i.value])).toEqual([["Entreprise Fictive", 3_000], ["État · France", 3_000]]);
    // Le pays d'un État émetteur, pour son drapeau.
    expect(r.issuers.map((i) => i.country)).toEqual([null, "FR"]);
    expect(r.issuers.find((i) => i.label === "Entreprise Fictive")?.over).toBe(false);
    d.params.alerts.concentrationMax = 0.15;
    const strict = concentrationReport(d, computePortfolio(d, "2026-06-01"));
    expect(strict.issuers.map((i) => [i.label, i.over])).toEqual([["Entreprise Fictive", true], ["État · France", false]]);
    // La ligne d'une obligation ne double pas l'alerte de son émetteur.
    expect(strict.lines.find((l) => l.label === "Obligation B")?.over).toBe(false);
  });
});

describe("volatilité", () => {
  const month = (rate: number | null, i: number): MonthReturn => ({ month: `2025-${String(i + 1).padStart(2, "0")}`, date: "", value: 0, inflow: 0, gain: 0, rate });
  it("annualise l'écart-type des rendements mensuels, à partir de 12 mois", () => {
    expect(volatility([0.01, -0.01].map(month))).toBeNull();
    const alternating = Array.from({ length: 12 }, (_, i) => month(i % 2 === 0 ? 0.02 : -0.02, i));
    // Écart-type de ±2 % (échantillon de 12) × √12.
    expect(volatility(alternating)).toBeCloseTo(0.02 * Math.sqrt(12 / 11) * Math.sqrt(12), 6);
  });
});
