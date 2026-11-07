import { describe, expect, it } from "vitest";
import { accruedFraction, approxYtm, couponPeriod, heldToMaturityValue, remainingFlows, yieldToMaturity } from "./bonds";
import { xirr } from "./xirr";

const oat = { couponRate: 0.03, maturityDate: "2032-05-25", frequency: 1 };

describe("obligations", () => {
  it("encadre la date entre deux coupons", () => {
    expect(couponPeriod(oat, "2026-11-07")).toEqual(["2026-05-25", "2027-05-25"]);
  });
  it("calcule le coupon couru", () => {
    expect(accruedFraction(oat, "2026-05-25")).toBe(0);
    expect(accruedFraction(oat, "2026-11-24")).toBeCloseTo(0.03 * (183 / 365), 6);
  });
  it("liste les flux restants avec remboursement à 100 %", () => {
    const f = remainingFlows(oat, "2030-06-01");
    expect(f).toEqual([
      { date: "2031-05-25", amount: 0.03 },
      { date: "2032-05-25", amount: 1.03 },
    ]);
  });
  it("rendement actuariel : au pair, il égale le coupon", () => {
    expect(yieldToMaturity(oat, "2026-05-25", 1)).toBeCloseTo(0.03, 4);
  });
  it("rendement actuariel : sous le pair, il dépasse le coupon (proche de l'approximation)", () => {
    const y = yieldToMaturity(oat, "2026-05-25", 0.9684)!;
    expect(y).toBeGreaterThan(0.03);
    expect(Math.abs(y - approxYtm(0.03, 96.84, 6))).toBeLessThan(0.002);
  });
  it("valeur détenue : part du prix d'achat et rejoint 100 % à l'échéance", () => {
    expect(heldToMaturityValue(oat, "2026-05-25", 0.96, "2026-05-25")).toBeCloseTo(0.96, 6);
    expect(heldToMaturityValue(oat, "2026-05-25", 0.96, "2032-05-25")).toBe(1);
  });
});

describe("xirr", () => {
  it("retrouve 10 % sur un an", () => {
    expect(xirr([{ date: "2025-01-01", amount: -1000 }, { date: "2026-01-01", amount: 1100 }])).toBeCloseTo(0.1, 4);
  });
  it("versements mensuels", () => {
    const flows = Array.from({ length: 12 }, (_, i) => ({ date: `2025-${String(i + 1).padStart(2, "0")}-01`, amount: -100 }));
    const r = xirr([...flows, { date: "2026-01-01", amount: 1250 }])!;
    expect(r).toBeGreaterThan(0.07);
    expect(r).toBeLessThan(0.09);
  });
  it("null sans flux de signes opposés", () => {
    expect(xirr([{ date: "2025-01-01", amount: -1 }])).toBeNull();
  });
});
