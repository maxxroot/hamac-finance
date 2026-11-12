import type { Transaction } from "@hamac/core";
import { describe, expect, it } from "vitest";
import { oneOffByMonth, oneOffTotal } from "./versements";

const tx = (date: string, accountId: string, amount: number, type: Transaction["type"] = "versement"): Transaction =>
  ({ id: `${date}-${accountId}-${type}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "" }) as Transaction;

describe("versements ponctuels", () => {
  it("additionne par mois et par compte, dans l'ordre des dates, sans les autres opérations", () => {
    const m = oneOffByMonth([tx("2026-03-20", "pea", 200), tx("2026-03-02", "pea", 500), tx("2026-03-10", "av", 1000), tx("2026-03-05", "pea", 50, "retrait"), tx("2026-01-01", "pea", 9000, "apport_initial")]);
    expect([...m.keys()]).toEqual(["2026-03"]);
    const mars = m.get("2026-03")!;
    expect(mars.get("pea")).toEqual({ total: 700, items: [{ date: "2026-03-02", amount: 500, comment: "" }, { date: "2026-03-20", amount: 200, comment: "" }] });
    expect(oneOffTotal(mars)).toBe(1700);
    expect(oneOffTotal(m.get("2026-04"))).toBe(0);
  });
});
