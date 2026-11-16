import { describe, expect, it } from "vitest";
import { bondKindOf, countryFromIsin, countryName, isOat, SOVEREIGN_COUNTRIES, sovereignCountry, sovereignDebtName, sovereignLabel } from "./bondIssuers";

describe("émetteur d'une obligation d'État", () => {
  it("connaît les 193 États membres de l'ONU, chacun une fois", () => {
    expect(SOVEREIGN_COUNTRIES).toHaveLength(193);
    expect(new Set(SOVEREIGN_COUNTRIES).size).toBe(193);
  });
  it("nomme les pays en français", () => {
    expect(countryName("BE")).toBe("Belgique");
    expect(countryName("DE")).toBe("Allemagne");
    expect(sovereignLabel("BE")).toBe("État · Belgique");
  });
  it("lit le pays dans l'ISIN, sauf pour un code qui n'est pas un État", () => {
    expect(countryFromIsin("BE0000357666")).toBe("BE");
    expect(countryFromIsin("fr0013508470")).toBe("FR");
    expect(countryFromIsin("XS2153406868")).toBeNull();
    expect(countryFromIsin("EU000A3K4DY4")).toBeNull();
    expect(countryFromIsin(null)).toBeNull();
  });
  it("prend le pays de la fiche, l'État français pour une fiche d'avant le choix du pays, aucun pour une entreprise", () => {
    expect(sovereignCountry({ bondKind: "etat", issuer: null, issuerCountry: "BE" })).toBe("BE");
    expect(sovereignCountry({ bondKind: "etat", issuer: "République française", issuerCountry: null })).toBe("FR");
    expect(sovereignCountry({ bondKind: null, issuer: null, issuerCountry: null })).toBe("FR");
    expect(sovereignCountry({ bondKind: "entreprise", issuer: "TotalEnergies", issuerCountry: null })).toBeNull();
    expect(bondKindOf({ bondKind: null, issuer: "TotalEnergies" })).toBe("entreprise");
  });
  it("réserve le nom et le 25 du mois à l'OAT", () => {
    expect(isOat("etat", "FR")).toBe(true);
    expect(isOat("etat", null)).toBe(true);
    expect(isOat("etat", "BE")).toBe(false);
    expect(isOat("entreprise", null)).toBe(false);
    expect(sovereignDebtName("FR")).toBe("OAT");
    expect(sovereignDebtName("BE")).toBe("OLO");
    expect(sovereignDebtName("PT")).toBe("Portugal");
  });
});
