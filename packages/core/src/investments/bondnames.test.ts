import { describe, expect, it } from "vitest";
import type { Asset } from "../model";
import { bondName, findSameBond, maturityFromMonth } from "./bondnames";

const bond = (o: Partial<Asset>): Asset => ({
  id: "x", kind: "obligation", name: "", isin: null, symbol: null, priceSource: "modele", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null,
  couponRate: 0.03, maturityDate: "2033-05-25", couponFrequency: 1, nextCouponDate: null, issuer: null, bondKind: "etat", issuerCountry: "FR", archived: false, ...o,
});

describe("noms et doublons d'obligations", () => {
  it("nomme une OAT, la dette d'un autre État et une obligation d'entreprise", () => {
    expect(bondName("etat", "République française", 0.03, "2033-05-25")).toBe("OAT 3 % mai 2033");
    expect(bondName("etat", null, 0.03, "2033-05-25", "FR")).toBe("OAT 3 % mai 2033");
    expect(bondName("etat", null, 0.03, "2033-06-22", "BE")).toBe("OLO 3 % juin 2033");
    expect(bondName("etat", null, 0.029, "2033-02-20", "AT")).toBe("Autriche 2,9 % février 2033");
    expect(bondName("entreprise", "TotalEnergies", 0.01491, "2027-04-08")).toBe("TotalEnergies 1,491 % avril 2027");
  });
  it("déduit la date d'échéance du mois annoncé", () => {
    expect(maturityFromMonth("2033-05", true)).toBe("2033-05-25");
    expect(maturityFromMonth("2033-05", true, 22)).toBe("2033-05-25");
    expect(maturityFromMonth("2027-04", false, 8)).toBe("2027-04-08");
    expect(maturityFromMonth("2027-04", false)).toBe("2027-04-01");
    expect(maturityFromMonth("2027-02", false, 31)).toBe("2027-02-28");
  });
  it("retrouve une obligation déjà connue (même ISIN, ou même émetteur, coupon et échéance)", () => {
    const list = [bond({ id: "oat" }), bond({ id: "tte", bondKind: "entreprise", issuer: "TotalEnergies", couponRate: 0.01491, maturityDate: "2027-04-08", isin: "XS2153406868" })];
    expect(findSameBond(list, { isin: null, couponRate: 0.03, maturityDate: "2033-05-25", issuer: null, bondKind: "etat" })?.id).toBe("oat");
    expect(findSameBond(list, { isin: "XS2153406868", couponRate: null, maturityDate: null, issuer: null, bondKind: null })?.id).toBe("tte");
    expect(findSameBond(list, { isin: null, couponRate: 0.01491, maturityDate: "2027-04-08", issuer: "totalenergies ", bondKind: "entreprise" })?.id).toBe("tte");
    expect(findSameBond(list, { isin: null, couponRate: 0.035, maturityDate: "2033-05-25", issuer: null, bondKind: "etat" })).toBeNull();
  });
  it("ne confond pas les obligations de deux États au même coupon et à la même échéance", () => {
    const list = [bond({ id: "oat" }), bond({ id: "ancienne", issuerCountry: null, couponRate: 0.04 }), bond({ id: "olo", issuerCountry: "BE", couponRate: 0.05 })];
    expect(findSameBond(list, { isin: null, couponRate: 0.03, maturityDate: "2033-05-25", issuer: null, bondKind: "etat", issuerCountry: "BE" })).toBeNull();
    expect(findSameBond(list, { isin: null, couponRate: 0.05, maturityDate: "2033-05-25", issuer: null, bondKind: "etat", issuerCountry: "BE" })?.id).toBe("olo");
    // Une fiche d'avant le choix du pays est française.
    expect(findSameBond(list, { isin: null, couponRate: 0.04, maturityDate: "2033-05-25", issuer: null, bondKind: "etat", issuerCountry: "FR" })?.id).toBe("ancienne");
  });
});
