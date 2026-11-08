import { describe, expect, it } from "vitest";
import type { Asset } from "./domain";
import { bondName, findSameBond, maturityFromMonth } from "./bondnames";

const bond = (o: Partial<Asset>): Asset => ({
  id: "x", kind: "obligation", name: "", isin: null, symbol: null, priceSource: "modele", priceProvider: null, priceUrl: null, pricePath: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null,
  couponRate: 0.03, maturityDate: "2033-05-25", couponFrequency: 1, issuer: "République française", bondKind: "etat", archived: false, ...o,
});

describe("noms et doublons d'obligations", () => {
  it("nomme une OAT et une obligation d'entreprise", () => {
    expect(bondName("etat", "République française", 0.03, "2033-05-25")).toBe("OAT 3 % mai 2033");
    expect(bondName("entreprise", "TotalEnergies", 0.01491, "2027-04-08")).toBe("TotalEnergies 1,491 % avril 2027");
  });
  it("déduit la date d'échéance du mois annoncé", () => {
    expect(maturityFromMonth("2033-05", "etat")).toBe("2033-05-25");
    expect(maturityFromMonth("2027-04", "entreprise", 8)).toBe("2027-04-08");
    expect(maturityFromMonth("2027-04", "entreprise")).toBe("2027-04-01");
    expect(maturityFromMonth("2027-02", "entreprise", 31)).toBe("2027-02-28");
  });
  it("retrouve une obligation déjà connue (même ISIN, ou même émetteur, coupon et échéance)", () => {
    const list = [bond({ id: "oat" }), bond({ id: "tte", bondKind: "entreprise", issuer: "TotalEnergies", couponRate: 0.01491, maturityDate: "2027-04-08", isin: "XS2153406868" })];
    expect(findSameBond(list, { isin: null, couponRate: 0.03, maturityDate: "2033-05-25", issuer: null, bondKind: "etat" })?.id).toBe("oat");
    expect(findSameBond(list, { isin: "XS2153406868", couponRate: null, maturityDate: null, issuer: null, bondKind: null })?.id).toBe("tte");
    expect(findSameBond(list, { isin: null, couponRate: 0.01491, maturityDate: "2027-04-08", issuer: "totalenergies ", bondKind: "entreprise" })?.id).toBe("tte");
    expect(findSameBond(list, { isin: null, couponRate: 0.035, maturityDate: "2033-05-25", issuer: null, bondKind: "etat" })).toBeNull();
  });
});
