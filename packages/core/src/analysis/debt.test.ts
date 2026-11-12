import { describe, expect, it } from "vitest";
import type { Loan } from "../loans";
import { defaultParams } from "../model";
import { computePortfolio } from "../portfolio";
import { NO_PROPERTY_DETAILS, type Property } from "../realestate";
import { debtOverview } from "./debt";

const credit = (over: Partial<Loan> = {}): Loan => ({
  id: "l",
  kind: "immobilier",
  name: "Prêt",
  propertyId: "b",
  share: 1,
  principal: 100_000,
  rate: 0,
  termMonths: 100,
  firstPayment: "2025-01-05",
  insuranceMode: "montant",
  insurance: 0,
  insuranceRate: 0,
  manualPayment: null,
  manualBalance: null,
  manualBalanceDate: null,
  archived: false,
  closedOn: null,
  deferredMonths: 0,
  deferredKind: "partiel",
  prepayments: [],
  ...over,
});

const bien: Property = { id: "b", kind: "residence_principale", ownership: "nom_propre", name: "Maison", value: 250_000, valueDate: null, purchasePrice: null, purchaseDate: null, newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 0, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };

describe("poids des crédits", () => {
  it("rapporte les dettes au patrimoine, aux biens et aux revenus", () => {
    const params = defaultParams(new Date(2025, 0, 1));
    params.profile.netMonthlyIncome = 4_000;
    // Taux zéro : 1 000 € par mois, 10 échéances passées au 15 octobre 2025.
    const state = computePortfolio({ params, accounts: [], assets: [], transactions: [], plans: [], skips: [], prices: [], properties: [bien], loans: [credit()] }, "2025-10-15");
    const o = debtOverview(state, [bien], params);
    expect(o).toMatchObject({ assets: 250_000, debts: 90_000, monthly: 1_000, income: 4_000, effortRate: 0.25 });
    expect(o.debtRatio).toBeCloseTo(0.36, 5);
    expect(o.properties[0]).toMatchObject({ value: 250_000, debt: 90_000 });
  });
});
