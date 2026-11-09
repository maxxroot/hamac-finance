import { describe, expect, it } from "vitest";
import { loanPayment, loanState, loanYears, propertyValue, type Loan } from "./realestate";

const loan: Loan = { id: "l", kind: "immobilier", name: "Prêt", propertyId: null, principal: 200_000, rate: 0.03, termMonths: 240, firstPayment: "2024-01-05", insuranceMode: "montant", insurance: 30, insuranceRate: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false };

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

  describe("assurance", () => {
    const rate = (insuranceMode: Loan["insuranceMode"], extra: Partial<Loan> = {}): Loan => ({ ...loan, insuranceMode, insurance: 0, insuranceRate: 0.003, ...extra });

    it("montant fixe : inchangé, sur toute la durée", () => {
      expect(loanState(loan, "2024-01-04")).toMatchObject({ insurance: 30, totalInsurance: 7200 });
      expect(loanState(loan, "2024-01-04").monthly).toBeCloseTo(1109.2 + 30, 1);
    });

    it("taux sur le capital emprunté : prime constante", () => {
      // 200 000 € × 0,30 % / 12 = 50 € par mois, soit 12 000 € sur 240 mois.
      expect(loanState(rate("capital_initial"), "2024-01-04")).toMatchObject({ insurance: 50, totalInsurance: 12_000 });
      expect(loanState(rate("capital_initial"), "2034-01-05").insurance).toBe(50);
    });

    it("taux sur le capital restant dû : prime dégressive", () => {
      const start = loanState(rate("capital_restant"), "2024-01-04");
      expect(start.insurance).toBe(50);
      const later = loanState(rate("capital_restant"), "2034-01-05");
      expect(later.insurance).toBeCloseTo((later.balance * 0.003) / 12, 2);
      expect(later.insurance).toBeLessThan(30);
      // Assurance et intérêts suivent le même capital : à 0,30 % contre 3 %, l'assurance totale vaut le dixième des intérêts.
      expect(start.totalInsurance).toBeCloseTo(start.totalInterest / 10, 0);
    });

    it("un relevé sert de base au capital restant dû", () => {
      const s = loanState(rate("capital_restant", { manualBalance: 100_000, manualBalanceDate: "2030-01-20" }), "2030-01-25");
      expect(s.insurance).toBe(25);
    });

    it("plus d'assurance une fois le prêt remboursé", () => {
      expect(loanState(rate("capital_initial"), "2050-01-01")).toMatchObject({ insurance: 0, monthly: 0 });
    });
  });

  describe("coût par année", () => {
    const sum = (rows: ReturnType<typeof loanYears>, key: "capital" | "interest" | "insurance") => rows.reduce((s, y) => s + y[key], 0);

    it("répartit les échéances par année civile, sans intérêts à taux zéro", () => {
      const rows = loanYears({ ...loan, principal: 12_000, rate: 0, termMonths: 24, firstPayment: "2024-07-05", insurance: 0 });
      expect(rows).toEqual([
        { year: 2024, capital: 3000, interest: 0, insurance: 0, endBalance: 9000 },
        { year: 2025, capital: 6000, interest: 0, insurance: 0, endBalance: 3000 },
        { year: 2026, capital: 3000, interest: 0, insurance: 0, endBalance: 0 },
      ]);
    });

    it("le capital remboursé et le coût correspondent aux totaux du crédit", () => {
      const rated = { ...loan, insuranceMode: "capital_restant", insurance: 0, insuranceRate: 0.003 } as Loan;
      const rows = loanYears(rated);
      const state = loanState(rated, "2024-01-04");
      expect(rows).toHaveLength(20);
      expect(sum(rows, "capital")).toBeCloseTo(200_000, 0);
      expect(sum(rows, "interest")).toBeCloseTo(state.totalInterest, 0);
      expect(sum(rows, "insurance")).toBeCloseTo(state.totalInsurance, 0);
      expect(rows.at(-1)!.endBalance).toBeCloseTo(0, 0);
    });

    it("les intérêts baissent et le capital monte chaque année", () => {
      const rows = loanYears(loan);
      // Première échéance : 200 000 € × 3 % / 12 = 500 € d'intérêts.
      expect(rows[0]!.interest).toBeLessThan(6000);
      expect(rows[0]!.interest).toBeGreaterThan(5800);
      expect(rows.at(-1)!.interest).toBeLessThan(rows[0]!.interest);
      expect(rows.at(-1)!.capital).toBeGreaterThan(rows[0]!.capital);
    });

    it("un relevé plus bas qu'attendu compte comme du capital remboursé", () => {
      const reference = loanYears(loan).find((y) => y.year === 2026)!;
      const rows = loanYears({ ...loan, manualBalance: 100_000, manualBalanceDate: "2026-06-10" });
      expect(rows.find((y) => y.year === 2026)!.capital).toBeGreaterThan(reference.capital + 50_000);
      expect(sum(rows, "capital")).toBeCloseTo(200_000, -1);
      expect(rows.find((y) => y.year === 2027)!.interest).toBeLessThan(3000);
    });

    it("le coût total suit le relevé", () => {
      const rows = loanYears({ ...loan, manualBalance: 100_000, manualBalanceDate: "2026-06-10" });
      expect(loanState({ ...loan, manualBalance: 100_000, manualBalanceDate: "2026-06-10" }, "2026-06-10").totalInterest).toBeCloseTo(sum(rows, "interest"), 0);
    });
  });

  it("valeur d'un bien : part détenue", () => {
    expect(propertyValue({ value: 300_000, share: 0.5 })).toBe(150_000);
  });
});
