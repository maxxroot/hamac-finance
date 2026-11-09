import { describe, expect, it } from "vitest";
import type { Account } from "./domain";
import { grossFromNet, describeOrderFees, embeddedOrderFee, orderFee, suggestTradeFee, type Institution, type OrderFees } from "./institutions";
import { defaultParams } from "./params";

const tiered: OrderFees = {
  tiers: [
    { upTo: 500, fixed: 1.99, rate: 0 },
    { upTo: null, fixed: 0, rate: 0.006 },
  ],
  min: null,
  max: null,
};

describe("frais d'ordre", () => {
  it("applique le palier du montant de l'ordre", () => {
    expect(orderFee(tiered, 300)).toBe(1.99);
    expect(orderFee(tiered, 500)).toBe(1.99);
    expect(orderFee(tiered, 1000)).toBe(6);
  });
  it("applique minimum et maximum", () => {
    const g: OrderFees = { tiers: [{ upTo: null, fixed: 0, rate: 0.005 }], min: 1, max: 10 };
    expect(orderFee(g, 100)).toBe(1);
    expect(orderFee(g, 1000)).toBe(5);
    expect(orderFee(g, 5000)).toBe(10);
  });
  it("retrouve les frais inclus dans un total débité ou un net reçu", () => {
    expect(embeddedOrderFee(tiered, "achat", 301.99)).toBe(1.99);
    expect(embeddedOrderFee(tiered, "achat", 1006)).toBe(6);
    expect(embeddedOrderFee(tiered, "vente", 994)).toBe(6);
    // 0,5 % sans minimum sur 904,50 € débités → 4,50 €.
    expect(embeddedOrderFee({ tiers: [{ upTo: null, fixed: 0, rate: 0.005 }], min: null, max: null }, "achat", 904.5)).toBe(4.5);
  });
  it("décrit une grille lisiblement", () => {
    expect(describeOrderFees(tiered)).toBe("jusqu'à 500 € : 1,99 € · au-delà de 500 € : 0,6 %");
  });
  it("utilise la grille de l'établissement du compte, sinon les frais par défaut", () => {
    const p = defaultParams();
    p.broker = { feeRate: 0.005, minFee: 0 };
    const inst: Institution = { id: "b", name: "Courtier B", kind: "courtier", website: "", score: null, comment: "", offers: { pea: { orderFees: tiered, custodyFixed: 0, custodyRate: 0, etfWorld: null, directBonds: null, programmed: null, reachableSupport: null } }, tax: { report: false, withheldIncomeTax: null, withheldSocial: null } };
    const account = { id: "pea", kind: "pea", institutionId: "b" } as Account;
    const map = new Map([["b", inst]]);
    expect(suggestTradeFee(account, map, p, "achat", 301.99)).toBe(1.99);
    expect(suggestTradeFee({ ...account, institutionId: null }, map, p, "achat", 1005)).toBe(5);
  });
});

describe("retenues d'un établissement", () => {
  it("retrouve le brut à partir du net", () => {
    expect(grossFromNet(87.2, { incomeTax: 0.128, social: 0 })).toEqual({ gross: 100, incomeTax: 12.8, social: 0 });
    expect(grossFromNet(100, { incomeTax: 0, social: 0 })).toEqual({ gross: 100, incomeTax: 0, social: 0 });
  });
});
