import { describe, expect, it } from "vitest";
import { NO_IRL_DATA, irlQuarterLabel, irlZone, leaseCanBeRevised, leaseIrlQuarter, pendingRevisionAnniversary, proposeRevision, revisedRent, revisionEffectiveDate, revisionStillPossible, type IrlData, type IrlPoint } from "./irl";
import type { Lease, LeaseRent } from "./leases";

const bail: Lease = { id: "l", propertyId: "b", lotId: "lot", kind: "vide", startDate: "2024-01-15", durationMonths: 36, rent: 800, charges: 50, deposit: 800, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: 2, landlordAddress: "", dueDay: 1 };
const point = (quarter: string, value: number, published: string): IrlPoint => ({ quarter, value, published });
// Valeurs publiées par l'INSEE.
const metropole = [point("2024-Q2", 145.17, "2024-07-13"), point("2025-Q2", 146.68, "2025-07-13"), point("2025-Q3", 145.77, "2025-10-17"), point("2026-Q2", 148.37, "2026-07-12"), point("2026-Q3", 148.06, "2026-10-16")];
const data: IrlData = { series: { ...NO_IRL_DATA.series, metropole, corse: [point("2024-Q2", 143.07, "2024-07-13"), point("2025-Q2", 144.56, "2025-07-13")] }, checkedAt: null };
const property = { postalCode: "69001", dpe: null };

describe("indice applicable", () => {
  it("zone d'après le code postal", () => {
    expect(irlZone("69001")).toBe("metropole");
    expect(irlZone("")).toBe("metropole");
    expect(irlZone("20200")).toBe("corse");
    expect(irlZone("97400")).toBe("outremer");
    expect(irlZone("97600")).toBe("outremer");
  });

  it("libellé du trimestre", () => {
    expect(irlQuarterLabel("2026-Q1")).toBe("1er trimestre 2026");
    expect(irlQuarterLabel("2026-Q3")).toBe("3e trimestre 2026");
  });

  it("trimestre du bail, sinon dernier indice publié à sa date, sinon calendrier", () => {
    expect(leaseIrlQuarter({ irlQuarter: 1, startDate: "2025-08-01" }, metropole)).toBe(1);
    expect(leaseIrlQuarter({ irlQuarter: null, startDate: "2025-08-01" }, metropole)).toBe(2);
    expect(leaseIrlQuarter({ irlQuarter: null, startDate: "2025-11-01" }, metropole)).toBe(3);
    expect(leaseIrlQuarter({ irlQuarter: null, startDate: "2025-08-01" }, [])).toBe(2);
    expect(leaseIrlQuarter({ irlQuarter: null, startDate: "2025-02-01" }, [])).toBe(4);
    expect(leaseIrlQuarter({ irlQuarter: null, startDate: "2025-01-05" }, [])).toBe(3);
  });
});

describe("révision à faire", () => {
  it("45 jours avant l'anniversaire, jusqu'à un an après", () => {
    expect(pendingRevisionAnniversary(bail, [], "2024-11-30")).toBeNull();
    expect(pendingRevisionAnniversary(bail, [], "2024-12-01")).toBe("2025-01-15");
    expect(pendingRevisionAnniversary(bail, [], "2025-11-30")).toBe("2025-01-15");
    expect(pendingRevisionAnniversary(bail, [], "2025-12-01")).toBe("2026-01-15");
  });

  it("plus rien une fois le loyer révisé", () => {
    const rents: LeaseRent[] = [{ id: "r", leaseId: "l", fromMonth: "2026-01", rent: 809, charges: 50 }];
    expect(pendingRevisionAnniversary(bail, rents, "2026-03-01")).toBeNull();
  });

  it("seulement si le bail le prévoit, en location vide ou meublée", () => {
    expect(pendingRevisionAnniversary({ ...bail, revisable: false }, [], "2026-01-15")).toBeNull();
    expect(leaseCanBeRevised({ kind: "meuble", revisable: true })).toBe(true);
    expect(leaseCanBeRevised({ kind: "mobilite", revisable: true })).toBe(false);
    expect(leaseCanBeRevised({ kind: "etudiant", revisable: true })).toBe(false);
  });

  it("prend effet à l'anniversaire, ou à la demande si elle est plus tardive ; un an pour la demander", () => {
    expect(revisionEffectiveDate("2026-01-15", "2026-01-02")).toBe("2026-01-15");
    expect(revisionEffectiveDate("2026-01-15", "2026-03-10")).toBe("2026-03-10");
    expect(revisionStillPossible("2026-01-15", "2027-01-15")).toBe(true);
    expect(revisionStillPossible("2026-01-15", "2027-01-16")).toBe(false);
  });
});

describe("calcul", () => {
  it("formule et arrondi au centime", () => {
    // 800 × 148,37 / 146,68 = 809,2173…
    expect(revisedRent(800, 146.68, 148.37)).toBe(809.22);
  });

  it("dernier indice du trimestre paru à l'anniversaire, comparé à celui de l'année d'avant", () => {
    expect(proposeRevision(bail, [], data, property, "2026-01-10")).toMatchObject({ anniversary: "2026-01-15", zone: "metropole", previousRent: 800, charges: 50, quarterNew: "2025-Q2", quarterOld: "2024-Q2", indexNew: 146.68, indexOld: 145.17, newRent: revisedRent(800, 145.17, 146.68) });
  });

  it("part du dernier loyer en vigueur", () => {
    const rents: LeaseRent[] = [{ id: "r", leaseId: "l", fromMonth: "2025-01", rent: 815, charges: 55 }];
    expect(proposeRevision(bail, rents, data, property, "2026-01-10")).toMatchObject({ previousRent: 815, charges: 55 });
  });

  it("indice de Corse pour un bien en Corse", () => {
    expect(proposeRevision(bail, [], data, { postalCode: "20000", dpe: null }, "2026-01-10")).toMatchObject({ zone: "corse", indexNew: 144.56, indexOld: 143.07 });
  });

  it("indice attendu mais pas encore connu : à saisir, le trimestre reste le bon", () => {
    const sansT2 = { ...data, series: { ...data.series, metropole: metropole.filter((p) => p.quarter !== "2026-Q2") } };
    expect(proposeRevision({ ...bail, startDate: "2024-08-01" }, [], sansT2, property, "2026-08-02")).toMatchObject({ quarterNew: "2026-Q2", indexNew: null, indexOld: 146.68, newRent: null });
  });

  it("aucune révision pour une note F ou G (art. 17-1, III)", () => {
    expect(proposeRevision(bail, [], data, { postalCode: "69001", dpe: "F" }, "2026-01-10")).toBeNull();
    expect(proposeRevision(bail, [], data, { postalCode: "69001", dpe: "G" }, "2026-01-10")).toBeNull();
  });
});
