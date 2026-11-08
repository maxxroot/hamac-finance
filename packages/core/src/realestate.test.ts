import { describe, expect, it } from "vitest";
import { loanPayment, loanState, propertyValue, type Loan } from "./realestate";

const loan: Loan = { id: "l", name: "Prêt", propertyId: null, principal: 200_000, rate: 0.03, termMonths: 240, firstPayment: "2024-01-05", insurance: 30, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false };

describe("crédits", () => {
  it("échéance constante, taux zéro compris", () => {
    expect(loanPayment(200_000, 0.03, 240)).toBeCloseTo(1109.2, 1);
    expect(loanPayment(12_000, 0, 24)).toBe(500);
  });

  it("capital restant dû calculé selon les échéances passées", () => {
    expect(loanState(loan, "2024-01-04")).toMatchObject({ balance: 200_000, paymentsDone: 0, paymentsLeft: 240, endDate: "2043-12-05" });
    const one = loanState(loan, "2024-01-05");
    expect(one.paymentsDone).toBe(1);
    expect(one.balance).toBeCloseTo(200_000 * 1.0025 - 1109.2, 0);
    expect(loanState(loan, "2024-02-04").paymentsDone).toBe(1);
    expect(loanState(loan, "2024-02-05").paymentsDone).toBe(2);
    expect(one.monthly).toBeCloseTo(1139.2, 1);
  });

  it("une fois remboursé : plus rien dû, plus de mensualité", () => {
    const end = loanState(loan, "2050-01-01");
    expect(end).toMatchObject({ balance: 0, monthly: 0, paymentsLeft: 0, paymentsDone: 240 });
  });

  it("saisie manuelle : le relevé sert de nouveau point de départ, l'échéance saisie remplace la calculée", () => {
    const manual = { ...loan, manualBalance: 150_000, manualBalanceDate: "2026-06-10", manualPayment: 1_200 };
    const atDate = loanState(manual, "2026-06-10");
    expect(atDate).toMatchObject({ balance: 150_000, payment: 1_200, fromManualBalance: true });
    expect(loanState(manual, "2026-07-05").balance).toBeCloseTo(150_000 * 1.0025 - 1_200, 2);
    expect(loanState(manual, "2026-06-01").fromManualBalance).toBe(false);
  });

  it("valeur d'un bien : part détenue", () => {
    expect(propertyValue({ value: 300_000, share: 0.5 })).toBe(150_000);
  });
});
