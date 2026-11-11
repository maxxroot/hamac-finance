import { describe, expect, it } from "vitest";
import { dismembermentRatio, fixedUsufructPeriods, heldShareLabel, lifeUsufructRate, usufructRate, withCompanyShares } from "./ownership";
import { NO_PROPERTY_DETAILS, companySummary, propertyValue, type Loan, type Property } from "./realestate";

describe("barème de l'usufruit (CGI, art. 669)", () => {
  it("suit l'âge révolu de l'usufruitier, par tranches de dix ans", () => {
    expect([0, 20, 21, 30, 31, 40, 41, 50, 51, 60, 61, 70, 71, 80, 81, 90, 91, 100].map(lifeUsufructRate)).toEqual([
      0.9, 0.9, 0.8, 0.8, 0.7, 0.7, 0.6, 0.6, 0.5, 0.5, 0.4, 0.4, 0.3, 0.3, 0.2, 0.2, 0.1, 0.1,
    ]);
  });

  it("compte l'âge révolu à la date", () => {
    // 61 ans le 15 mars 2026 : 50 % la veille, 40 % le jour même.
    expect(usufructRate({ usufructBirthDate: "1965-03-15", usufructEnd: null }, "2026-03-14")).toBe(0.5);
    expect(usufructRate({ usufructBirthDate: "1965-03-15", usufructEnd: null }, "2026-03-15")).toBe(0.4);
  });

  it("évalue l'usufruit à durée fixe à 23 % par période de dix ans commencée", () => {
    expect(fixedUsufructPeriods("2026-01-01", "2036-01-01")).toBe(1);
    expect(fixedUsufructPeriods("2026-01-01", "2036-01-02")).toBe(2);
    expect(usufructRate({ usufructBirthDate: null, usufructEnd: "2041-01-01" }, "2026-01-01")).toBe(0.46);
    expect(usufructRate({ usufructBirthDate: null, usufructEnd: "2025-12-31" }, "2026-01-01")).toBe(0);
  });

  it("ne dépasse jamais l'usufruit viager", () => {
    // 30 ans d'usufruit (69 %) pour un usufruitier de 75 ans : plafonné à 30 %.
    expect(usufructRate({ usufructBirthDate: "1951-01-01", usufructEnd: "2056-01-01" }, "2026-01-01")).toBe(0.3);
  });

  it("donne au nu-propriétaire le complément", () => {
    const d = { dismemberment: "nue_propriete" as const, usufructBirthDate: "1960-06-01", usufructEnd: null };
    expect(dismembermentRatio(d, "2026-01-01")).toBe(0.6);
    expect(dismembermentRatio({ ...d, dismemberment: "usufruit" }, "2026-01-01")).toBe(0.4);
    expect(dismembermentRatio({ ...d, dismemberment: "pleine" }, "2026-01-01")).toBe(1);
  });
});

const bien = (over: Partial<Property> = {}): Property => ({
  id: "b",
  kind: "locatif",
  ownership: "nom_propre",
  name: "Studio",
  value: 200_000,
  valueDate: null,
  purchasePrice: null,
  purchaseDate: null,
  newBuild: false,
  ...NO_PROPERTY_DETAILS,
  notaryFees: 0,
  agencyFees: 0,
  initialWorks: 0,
  otherFees: 0,
  share: 1,
  inAllocation: null,
  classId: null,
  comment: "",
  archived: false,
  ...over,
});

const credit = (over: Partial<Loan> = {}): Loan => ({
  id: "l",
  kind: "immobilier",
  name: "Prêt",
  propertyId: "b",
  share: 1,
  principal: 100_000,
  rate: 0,
  termMonths: 100,
  firstPayment: "2026-01-05",
  insuranceMode: "montant",
  insurance: 0,
  insuranceRate: 0,
  manualPayment: null,
  manualBalance: null,
  manualBalanceDate: null,
  archived: false,
  closedOn: null,
  deferredMonths: 0,
  deferredKind: "partiel",
  prepayments: [],
  ...over,
});

describe("valeur détenue d'un bien", () => {
  it("applique la part détenue puis le droit détenu", () => {
    const nue = bien({ share: 0.5, dismemberment: "nue_propriete", usufructBirthDate: "1960-06-01" });
    expect(propertyValue(nue, "2026-01-01")).toBe(60_000);
    expect(heldShareLabel(nue, "2026-01-01")).toBe("part détenue 50 % · nue-propriété (60 %)");
    expect(heldShareLabel(bien(), "2026-01-01")).toBe("");
  });
});

describe("parts de SCI", () => {
  const sci = { id: "s", name: "SCI Fictive", share: 0.4, comment: "", archived: false };

  it("applique la part des parts aux biens de la société et à leurs crédits", () => {
    const { properties, loans } = withCompanyShares({ properties: [bien({ companyId: "s" }), bien({ id: "autre" })], loans: [credit(), credit({ id: "l2", propertyId: "autre" })], companies: [sci] });
    expect(properties.map((p) => p.share)).toEqual([0.4, 1]);
    expect(loans.map((l) => l.share)).toEqual([0.4, 1]);
  });

  it("résume la société : biens, crédits, actif net et valeur des parts", () => {
    // Prêt sans intérêt de 100 000 € sur 100 mois : 2 échéances payées au 1er mars 2026.
    const s = companySummary(sci, [bien({ companyId: "s" })], [credit()], "2026-03-01");
    expect(s).toMatchObject({ value: 200_000, debt: 98_000, net: 102_000, held: 40_800 });
  });
});
