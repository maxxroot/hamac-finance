import { describe, expect, it } from "vitest";
import { accruedFraction, approxYtm, couponPeriod, heldToMaturityValue, nextCoupon, remainingFlows, yieldToMaturity } from "./bonds";
import { xirr } from "../base";

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
  describe("date de coupon indiquée", () => {
    const decale = { ...oat, couponAnchor: "2026-12-10" };

    it("sans date : calendrier déduit de l'échéance, comme avant", () => {
      expect(nextCoupon(oat, "2026-11-07")).toEqual({ date: "2027-05-25", amount: 0.03 });
      expect(nextCoupon({ ...oat, couponAnchor: null }, "2026-11-07")).toEqual({ date: "2027-05-25", amount: 0.03 });
    });

    it("le calendrier suit la date, et reste juste une fois qu'elle est passée", () => {
      expect(couponPeriod(decale, "2026-11-07")).toEqual(["2025-12-10", "2026-12-10"]);
      expect(nextCoupon(decale, "2026-11-07")!.date).toBe("2026-12-10");
      expect(nextCoupon(decale, "2028-03-01")!.date).toBe("2028-12-10");
      expect(couponPeriod(decale, "2026-12-10")).toEqual(["2026-12-10", "2027-12-10"]);
    });

    it("le coupon couru repart de la vraie date", () => {
      // Du 10/12/2025 au 07/11/2026 : 332 jours sur 365.
      expect(accruedFraction(decale, "2026-11-07")).toBeCloseTo(0.03 * (332 / 365), 6);
      expect(accruedFraction(decale, "2026-12-10")).toBe(0);
    });

    it("semestriel : deux coupons par an, chacun de la moitié", () => {
      const t = { couponRate: 0.04, maturityDate: "2030-03-15", frequency: 2, couponAnchor: "2026-09-15" };
      expect(nextCoupon(t, "2026-11-07")).toEqual({ date: "2027-03-15", amount: 0.02 });
      expect(remainingFlows(t, "2029-01-01").map((f) => f.date)).toEqual(["2029-03-15", "2029-09-15", "2030-03-15"]);
    });

    it("le jour d'échéance peut différer de celui du coupon : un coupon entier, pas de coupon en plus", () => {
      // L'échéance se saisit au mois : le 15 du contrat et le 25 stocké ne créent ni double coupon ni coupon réduit.
      const t = { ...oat, couponAnchor: "2026-05-15" };
      expect(remainingFlows(t, "2030-06-01")).toEqual([
        { date: "2031-05-15", amount: 0.03 },
        { date: "2032-05-25", amount: 1.03 },
      ]);
      expect(accruedFraction(t, "2032-05-20")).toBeGreaterThan(0.029);
    });

    it("dernier coupon réduit si le remboursement tombe en cours de période", () => {
      const f = remainingFlows(decale, "2031-06-01");
      expect(f.map((x) => x.date)).toEqual(["2031-12-10", "2032-05-25"]);
      // Du 10/12/2031 au 25/05/2032 : 167 jours sur une période de 366.
      expect(f[1]!.amount).toBeCloseTo(1 + 0.03 * (167 / 366), 6);
    });

    it("ignore une date après l'échéance, et plus de coupon une fois remboursé", () => {
      expect(nextCoupon({ ...oat, couponAnchor: "2040-01-01" }, "2026-11-07")!.date).toBe("2027-05-25");
      expect(nextCoupon(decale, "2032-05-25")).toBeNull();
    });

    it("le rendement tient compte du calendrier : un coupon plus proche rapporte plus tôt", () => {
      const proche = { ...oat, couponAnchor: "2026-06-01" };
      expect(yieldToMaturity(proche, "2026-05-30", 1)).not.toBeCloseTo(yieldToMaturity(oat, "2026-05-30", 1)!, 3);
    });
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
