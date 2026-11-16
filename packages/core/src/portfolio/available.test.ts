import { describe, expect, it } from "vitest";
import { defaultParams, type Account, type Asset, type ContributionPlan, type Transaction } from "../model";
import { availableBalance } from "./available";
import type { EngineData } from "./engine";

// Montants fictifs.

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: kind === "livret" ? "LIVRET_A" : null, name: id, institutionId: null, openedOn: "2020-01-15", depositCeiling: null, rate: null, role: "",
  beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
const fund = (id: string): Asset => ({
  id, kind: "fonds_euros", name: `Fonds ${id}`, isin: null, symbol: null, priceSource: "modele", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null,
  targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, issuerCountry: null, archived: false,
});
const tx = (id: string, date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra,
});

function data(transactions: Transaction[], plans: ContributionPlan[] = []): EngineData {
  const params = defaultParams(new Date(2026, 5, 30));
  params.profile = { ...params.profile, birthYear: 1985, startMonth: "2026-01" };
  return {
    params,
    accounts: [acc("livret", "livret"), acc("av", "assurance_vie", { defaultAssetId: "fe" })],
    assets: [fund("fe"), fund("fe2")],
    transactions,
    plans,
    skips: [],
    prices: [],
  };
}

describe("solde disponible pour un retrait", () => {
  const base = [
    tx("a", "2026-01-10", "apport_initial", "livret", 2_000),
    tx("b", "2026-03-01", "retrait", "livret", 300),
    tx("c", "2026-05-02", "versement", "livret", 150),
    tx("d", "2026-01-10", "apport_initial", "av", 5_000),
    tx("e", "2026-02-01", "versement", "av", 1_000, { assetId: "fe2" }),
  ];

  it("espèces d'un livret à la date choisie", () => {
    expect(availableBalance(data(base), "livret", "2026-04-01")).toEqual({ amount: 1_700, source: { kind: "especes" } });
    expect(availableBalance(data(base), "livret", "2026-06-01")?.amount).toBe(1_850);
  });

  it("les opérations du même jour sont comptées, l'opération modifiée ne l'est pas", () => {
    expect(availableBalance(data(base), "livret", "2026-03-01")?.amount).toBe(1_700);
    expect(availableBalance(data(base), "livret", "2026-03-01", { excludeTxId: "b" })?.amount).toBe(2_000);
  });

  it("contrat : le fonds euros visé, sinon celui du contrat", () => {
    expect(availableBalance(data(base), "av", "2026-06-01")).toEqual({ amount: 5_000, source: { kind: "fonds_euros", assetId: "fe", name: "Fonds fe" } });
    expect(availableBalance(data(base), "av", "2026-06-01", { supportId: "fe2" })?.amount).toBe(1_000);
  });

  it("versements programmés compris", () => {
    const plans: ContributionPlan[] = [{ id: "p", accountId: "livret", fromMonth: "2026-01", amount: 100, comment: "" }];
    const withPlan = availableBalance(data(base, plans), "livret", "2026-06-30")!.amount;
    expect(withPlan).toBe(1_850 + 6 * 100);
  });

  it("compte inconnu", () => {
    expect(availableBalance(data(base), "nope", "2026-06-01")).toBeNull();
  });
});
