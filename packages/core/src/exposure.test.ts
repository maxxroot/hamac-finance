import { describe, expect, it } from "vitest";
import { countryCode, currencyCode, SECTOR_LABELS, SECTORS, sectorFromLabel } from "./exposure";

describe("exposition : harmonisation des libellés d'émetteurs", () => {
  it("ramène les noms de pays d'Amundi et d'iShares au même code ISO", () => {
    expect(countryCode("United States")).toBe("US");
    expect(countryCode(" united kingdom ")).toBe("GB");
    // Amundi écrit « UAE », iShares « United Arab Emirates ».
    expect(countryCode("UAE")).toBe("AE");
    expect(countryCode("United Arab Emirates")).toBe("AE");
    expect(countryCode("Korea (South)")).toBe("KR");
    expect(countryCode("Croatia (Hrvatska)")).toBe("HR");
    expect(countryCode("Russian Federation")).toBe("RU");
  });

  it("une zone ou un tiret ne sont pas des pays", () => {
    expect(countryCode("European Union")).toBeNull();
    expect(countryCode("-")).toBeNull();
    expect(countryCode(null)).toBeNull();
    expect(countryCode("Atlantide")).toBeNull();
  });

  it("secteurs des actions et secteurs des obligations iShares vont dans la même liste", () => {
    expect(sectorFromLabel("Information Technology")).toBe("technologie");
    expect(sectorFromLabel("Communication")).toBe("communication");
    expect(sectorFromLabel("Communication Services")).toBe("communication");
    expect(sectorFromLabel("Banking")).toBe("finance");
    expect(sectorFromLabel("Insurance")).toBe("finance");
    expect(sectorFromLabel("Electric")).toBe("services_publics");
    expect(sectorFromLabel("Consumer Non-Cyclical")).toBe("consommation_courante");
    expect(sectorFromLabel("Consumer Cyclical")).toBe("consommation_non_essentielle");
    expect(sectorFromLabel("Basic Industry")).toBe("materiaux");
    expect(sectorFromLabel("Reits")).toBe("immobilier");
    expect(sectorFromLabel("Treasuries")).toBe("etats");
  });

  it("un secteur inconnu ou vide devient « autre », et chaque secteur a un libellé", () => {
    expect(sectorFromLabel("Other")).toBe("autre");
    expect(sectorFromLabel("")).toBe("autre");
    expect(sectorFromLabel(undefined)).toBe("autre");
    for (const s of SECTORS) expect(SECTOR_LABELS[s]).toBeTruthy();
  });

  it("devise : un code à trois lettres, sinon rien", () => {
    expect(currencyCode("usd")).toBe("USD");
    expect(currencyCode("-")).toBeNull();
    expect(currencyCode("")).toBeNull();
  });
});
