import { describe, expect, it } from "vitest";
import { comparePrepayment, loanCost, maxPrepaymentFee, placementPresets } from "./debt";
import { defaultParams } from "../model";
import type { Loan } from "./loan";

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

describe("coût restant d'un crédit", () => {
  it("retrouve le taux d'un crédit, assurance comprise", () => {
    expect(loanCost(credit({ rate: 0.03 }), "2025-06-01").rateWithInsurance).toBeCloseTo(0.03, 4);
    expect(loanCost(credit({ rate: 0.03, insurance: 20 }), "2025-06-01").rateWithInsurance).toBeGreaterThan(0.034);
  });
});

describe("indemnité de remboursement anticipé", () => {
  it("crédit immobilier : 6 mois d'intérêts, au plus 3 % du capital restant dû", () => {
    // 20 000 € à 3 % : 6 mois d'intérêts = 300 €, sous 3 % du capital restant dû.
    expect(maxPrepaymentFee(credit({ rate: 0.03 }), 20_000, "2025-06-01")).toBe(300);
    // Taux élevé : le plafond de 3 % du capital restant dû s'applique.
    const cher = credit({ rate: 0.12, principal: 50_000, termMonths: 120 });
    expect(maxPrepaymentFee(cher, 50_000, "2025-01-01")).toBe(1_500);
  });

  it("crédit à la consommation : rien sous 10 000 €, puis 1 % ou 0,5 %", () => {
    const conso = credit({ kind: "consommation", principal: 30_000, termMonths: 60, propertyId: null });
    expect(maxPrepaymentFee(conso, 8_000, "2025-06-01")).toBe(0);
    expect(maxPrepaymentFee(conso, 12_000, "2025-06-01")).toBe(120);
    // Moins d'un an restant (7 échéances de 4 000 €) : 0,5 %.
    expect(maxPrepaymentFee({ ...conso, principal: 240_000 }, 12_000, "2029-06-01")).toBe(60);
  });
});

describe("rembourser par avance ou placer", () => {
  it("à taux zéro des deux côtés, les deux options se valent", () => {
    const c = comparePrepayment({ loan: credit(), date: "2025-10-15", amount: 20_000, mode: "duree", fee: 0, placementRate: 0 });
    expect(c).toMatchObject({ horizon: "2033-04-05", monthsSaved: 20, newMonthly: 1_000, newEndDate: "2031-08-05", savedInterest: 0, repayWealth: 20_000, investWealth: 20_000, advantage: 0 });
  });

  it("rembourser gagne quand le crédit coûte plus que le placement, et inversement", () => {
    const loan = credit({ rate: 0.04, firstPayment: "2025-01-05", termMonths: 180 });
    const prudent = comparePrepayment({ loan, date: "2025-10-15", amount: 20_000, mode: "duree", fee: 0, placementRate: 0.02 });
    expect(prudent.advantage).toBeGreaterThan(0);
    expect(prudent.savedInterest).toBeGreaterThan(5_000);
    const dynamique = comparePrepayment({ loan, date: "2025-10-15", amount: 20_000, mode: "duree", fee: 0, placementRate: 0.07 });
    expect(dynamique.advantage).toBeLessThan(0);
    expect(prudent.breakEvenRate).toBeCloseTo(0.04, 2);
  });

  it("réduire la mensualité garde la durée", () => {
    const c = comparePrepayment({ loan: credit(), date: "2025-10-15", amount: 18_000, mode: "mensualite", fee: 0, placementRate: 0 });
    expect(c).toMatchObject({ monthsSaved: 0, newMonthly: 800, newEndDate: "2033-04-05" });
  });

  it("propose des rendements nets à partir des hypothèses du plan", () => {
    const p = defaultParams(new Date(2026, 0, 1));
    const presets = placementPresets(p);
    expect(presets.find((x) => x.key === "livrets")?.rate).toBe(p.returns.livrets);
    expect(presets.find((x) => x.key === "fondsEuros")?.rate).toBeCloseTo(p.returns.fondsEuros * (1 - 0.172), 5);
  });
});
