import { describe, expect, it } from "vitest";
import type { Asset } from "./domain";
import { bondName, findSameBond } from "./bondnames";

const bond = (o: Partial<Asset>): Asset => ({
  id: "x", kind: "obligation", name: "", isin: null, symbol: null, priceSource: "modele", manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null,
  couponRate: 0.03, maturityDate: "2033-05-25", couponFrequency: 1, issuer: "République française", bondKind: "etat", archived: false, ...o,
});

describe("noms et doublons d'obligations", () => {
  it("nomme une OAT et une obligation d'entreprise", () => {
    expect(bondName("etat", "République française", 0.03, "2033-05-25")).toBe("OAT 3 % 25/05/2033");
    expect(bondName("entreprise", "TotalEnergies", 0.01491, "2027-04-08")).toBe("TotalEnergies 1,491 % 08/04/2027");
  });
  it("retrouve une obligation déjà connue (même ISIN, ou même émetteur, coupon et échéance)", () => {
    const list = [bond({ id: "oat" }), bond({ id: "tte", bondKind: "entreprise", issuer: "TotalEnergies", couponRate: 0.01491, maturityDate: "2027-04-08", isin: "XS2153406868" })];
    expect(findSameBond(list, { isin: null, couponRate: 0.03, maturityDate: "2033-05-25", issuer: null, bondKind: "etat" })?.id).toBe("oat");
    expect(findSameBond(list, { isin: "XS2153406868", couponRate: null, maturityDate: null, issuer: null, bondKind: null })?.id).toBe("tte");
    expect(findSameBond(list, { isin: null, couponRate: 0.01491, maturityDate: "2027-04-08", issuer: "totalenergies ", bondKind: "entreprise" })?.id).toBe("tte");
    expect(findSameBond(list, { isin: null, couponRate: 0.035, maturityDate: "2033-05-25", issuer: null, bondKind: "etat" })).toBeNull();
  });
});
