import { describe, expect, it } from "vitest";
import type { Transaction } from "./domain";
import { livretInterest, rateAt, type AccountRate } from "./rates";

const tx = (date: string, type: Transaction["type"], amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `${date}${type}`,
  date,
  type,
  accountId: "lep",
  assetId: null,
  counterAccountId: null,
  amount,
  quantity: null,
  fee: null,
  comment: "",
  ...extra,
});
const rate = (fromDate: string, r: number): AccountRate => ({ id: fromDate, accountId: "lep", fromDate, rate: r, comment: "" });
const base = { plans: [], skips: [], startMonth: "2020-01" };

describe("taux datés et intérêts des livrets", () => {
  it("prend le taux en vigueur à la date", () => {
    const rates = [rate("2025-08-01", 0.027), rate("2026-02-01", 0.025)];
    expect(rateAt(rates, "lep", "2026-01-31")!.rate).toBe(0.027);
    expect(rateAt(rates, "lep", "2026-02-01")!.rate).toBe(0.025);
    expect(rateAt(rates, "lep", "2025-01-01")).toBeNull();
  });

  it("solde stable toute l'année : solde × taux", () => {
    const r = livretInterest("lep", 2026, { ...base, transactions: [tx("2025-06-10", "apport_initial", 10000)] }, [rate("2020-01-01", 0.024)], null, "2026-12-31");
    expect(r.estimated).toBe(240);
    expect(r.earnedToDate).toBe(240);
  });

  it("règle des quinzaines : un dépôt du 10 mars compte à partir du 16 mars", () => {
    const r = livretInterest("lep", 2026, { ...base, transactions: [tx("2026-03-10", "versement", 2400)] }, [rate("2020-01-01", 0.03)], null, "2026-12-31");
    // 19 quinzaines (16 mars → 31 déc) × 2 400 × 3 % / 24
    expect(r.estimated).toBeCloseTo((19 * 2400 * 0.03) / 24, 2);
  });

  it("un retrait cesse de rapporter dès sa quinzaine", () => {
    const r = livretInterest("lep", 2026, { ...base, transactions: [tx("2025-01-01", "apport_initial", 2400), tx("2026-01-20", "retrait", 2400)] }, [rate("2020-01-01", 0.03)], null, "2026-12-31");
    expect(r.estimated).toBeCloseTo((1 * 2400 * 0.03) / 24, 2);
  });

  it("changement de taux en cours d'année et intérêts acquis à date", () => {
    const rates = [rate("2020-01-01", 0.03), rate("2026-07-01", 0.024)];
    const r = livretInterest("lep", 2026, { ...base, transactions: [tx("2025-01-01", "apport_initial", 12000)] }, rates, null, "2026-03-20");
    expect(r.estimated).toBeCloseTo(12000 * (0.03 / 2 + 0.024 / 2), 2);
    expect(r.earnedToDate).toBeCloseTo((6 * 12000 * 0.03) / 24, 2);
    expect(r.averageRate).toBeCloseTo(0.027, 6);
  });

  it("compte les versements programmés, y compris ceux à venir", () => {
    const plans = [{ id: "p", accountId: "lep", fromMonth: "2026-01", amount: 100, comment: "" }];
    const r = livretInterest("lep", 2026, { transactions: [], plans, skips: [], startMonth: "2026-01" }, [rate("2020-01-01", 0.024)], null, "2026-01-05");
    // Versement du 1er de chaque mois → rapporte dès le 16 : Σ (solde de chaque quinzaine).
    let total = 0;
    for (let q = 0; q < 24; q++) total += 100 * Math.floor((q + 1) / 2);
    expect(r.estimated).toBeCloseTo((total * 0.024) / 24, 2);
  });
});
