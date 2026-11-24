import { describe, expect, it } from "vitest";
import { syncTradeAmounts, type TradeAmounts } from "./tradeAmounts";

const base: TradeAmounts = { side: "achat", basis: "unit", quantity: 10, unitPrice: 50, amount: null, fee: 2 };

describe("prix unitaire et montant total", () => {
  it("achat : le total ajoute les frais au prix", () => {
    expect(syncTradeAmounts(base)).toEqual({ amount: 502, unitPrice: 50 });
  });

  it("vente : le total reçu retire les frais", () => {
    expect(syncTradeAmounts({ ...base, side: "vente" })).toEqual({ amount: 498, unitPrice: 50 });
  });

  it("depuis le total, le prix se calcule hors frais", () => {
    expect(syncTradeAmounts({ ...base, basis: "total", unitPrice: null, amount: 502 })).toEqual({ amount: 502, unitPrice: 50 });
    expect(syncTradeAmounts({ ...base, side: "vente", basis: "total", unitPrice: null, amount: 498 })).toEqual({ amount: 498, unitPrice: 50 });
  });

  it("aller-retour : retrouve le même total, à l'arrondi près", () => {
    const unit = syncTradeAmounts({ side: "achat", basis: "total", quantity: 7, unitPrice: null, amount: 333.33, fee: 1.99 }).unitPrice!;
    expect(unit).toBeCloseTo(47.334286, 6);
    expect(syncTradeAmounts({ side: "achat", basis: "unit", quantity: 7, unitPrice: unit, amount: null, fee: 1.99 }).amount).toBe(333.33);
  });

  it("le total saisi n'est jamais modifié", () => {
    expect(syncTradeAmounts({ ...base, basis: "total", quantity: 3, unitPrice: 999, amount: 100.01 }).amount).toBe(100.01);
  });

  it("sans frais connus, le total vaut quantité × prix", () => {
    expect(syncTradeAmounts({ ...base, fee: null })).toEqual({ amount: 500, unitPrice: 50 });
  });

  it("donnée manquante : pas de calcul, et pas de reste d'un ancien calcul", () => {
    expect(syncTradeAmounts({ ...base, quantity: null, amount: 502 })).toEqual({ amount: null, unitPrice: 50 });
    expect(syncTradeAmounts({ ...base, unitPrice: null, amount: 502 })).toEqual({ amount: null, unitPrice: null });
    expect(syncTradeAmounts({ ...base, basis: "total", quantity: null, unitPrice: 50, amount: 502 })).toEqual({ amount: 502, unitPrice: null });
    expect(syncTradeAmounts({ ...base, basis: "total", unitPrice: 50, amount: null })).toEqual({ amount: null, unitPrice: null });
  });

  it("obligation : prix en % du nominal, coupon couru compris dans le total", () => {
    const bond = { side: "achat", quantity: 3000, fee: 5, accrued: 40, per: 100 } as const;
    expect(syncTradeAmounts({ ...bond, basis: "unit", unitPrice: 96.4, amount: null })).toEqual({ amount: 2937, unitPrice: 96.4 });
    expect(syncTradeAmounts({ ...bond, basis: "total", unitPrice: null, amount: 2937 })).toEqual({ amount: 2937, unitPrice: 96.4 });
  });

  it("titre en devise : prix en dollars, total et frais en euros", () => {
    // 10 000 USD de nominal à 98 %, 1 € de frais, 1,09 USD pour 1 € : 9 800 / 1,09 + 1 = 8 991,83 €.
    const bond: TradeAmounts = { side: "achat", basis: "unit", quantity: 10_000, unitPrice: 98, amount: null, fee: 1, per: 100, rate: 1.09 };
    expect(syncTradeAmounts(bond).amount).toBe(8991.83);
    expect(syncTradeAmounts({ ...bond, basis: "total", unitPrice: null, amount: 8991.83 }).unitPrice).toBeCloseTo(98, 3);
  });
});
