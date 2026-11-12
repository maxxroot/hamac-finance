import { describe, expect, it } from "vitest";
import { NO_RENT_LEDGER, rentMonths, type Lease, type RentPayment } from "./leases";
import type { Lot } from "./lots";
import { NO_PROPERTY_DETAILS, type Property } from "./realestate";
import { parkDebts, parkMonth, parkOccupancy, parkPropertyRows, parkSchedule, parkVacancies, propertyOccupancy, relocationGaps, type ParkData, type PropertyReminder } from "./rentalPark";

const property: Property = { id: "b", kind: "locatif", ownership: "nom_propre", name: "Maison", value: 300_000, valueDate: null, purchasePrice: 240_000, purchaseDate: "2024-06-01", newBuild: false, ...NO_PROPERTY_DETAILS, rentalMode: "chambres", notaryFees: 0, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
const lot = (id: string, kind: Lot["kind"], extra: Partial<Lot> = {}): Lot => ({ id, propertyId: "b", name: id, kind, surface: null, targetRent: null, comment: "", archived: false, sortOrder: 0, ...extra });
const bail = (id: string, lotId: string, extra: Partial<Lease> = {}): Lease => ({ id, propertyId: "b", lotId, kind: "meuble", startDate: "2025-01-01", durationMonths: 12, rent: 500, charges: 0, deposit: 0, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: null, landlordAddress: "", dueDay: 1, ...extra });
const reminder = (id: string, date: string, extra: Partial<PropertyReminder> = {}): PropertyReminder => ({ id, propertyId: "b", lotId: null, date, yearly: false, label: id, comment: "", doneOn: null, ...extra });

const lots = [lot("Chambre 1", "chambre", { targetRent: 500 }), lot("Chambre 2", "chambre"), lot("Parking", "parking", { targetRent: 80 })];
const a = bail("a", "Chambre 1", { charges: 50 });
const b = bail("b", "Chambre 2", { rent: 400, actualEnd: "2025-06-30", deposit: 800 });
const c = bail("c", "Chambre 2", { rent: 420, startDate: "2025-09-01" });
// Tout est reçu à l'échéance, sauf le loyer d'octobre de la chambre 1.
const payments: RentPayment[] = [a, b, c].flatMap((l) =>
  rentMonths(l, [], NO_RENT_LEDGER, "2026-12-31")
    .filter((m) => !(l.id === "a" && m.month === "2025-10"))
    .map((m) => ({ id: `${l.id}-${m.month}`, leaseId: l.id, month: m.month, date: m.dueDate, amount: m.due, method: "virement" as const, comment: "" })),
);
const data: ParkData = {
  properties: [property, { ...property, id: "rp", kind: "residence_principale", name: "Résidence" }],
  lots,
  leases: [a, b, c],
  leaseRents: [],
  rentPayments: payments,
  rentWaivers: [],
  renters: [{ id: "r", firstName: "Alice", lastName: "Fictive", email: "", phone: "", forwardingAddress: "", comment: "" }],
  leaseRenters: [{ leaseId: "a", renterId: "r", sortOrder: 0 }],
  leaseGuarantees: [{ id: "g", leaseId: "a", kind: "visale", name: "", contact: "", amount: null, until: "2026-03-01", comment: "", sortOrder: 0 }],
  propertyExpenses: [{ id: "tf", propertyId: "b", date: "2024-10-15", category: "taxe_fonciere", amount: 1_200, label: "", yearly: true, untilYear: null, improvement: false }],
  propertyIncomes: [],
  propertyDocuments: [],
  propertyReminders: [reminder("AG de copropriété", "2024-03-15", { yearly: true }), reminder("Chaudière", "2025-10-01"), reminder("Fait", "2025-10-01", { doneOn: "2025-10-02" })],
  loans: [],
};

describe("vue du parc", () => {
  it("loyers d'un mois : attendus, reçus et impayés, bail par bail", () => {
    const m = parkMonth(data, "2025-10", "2025-11-15");
    expect(m.lines.map((l) => [l.lease.id, l.lotName, l.renters, l.month.status])).toEqual([
      ["a", "Chambre 1", "Alice Fictive", "non_recu"],
      ["c", "Chambre 2", "", "recu"],
    ]);
    expect(m).toMatchObject({ expected: 970, received: 420, late: 550, pending: 0 });
    // Le mois en cours s'arrête à aujourd'hui ; un bien qui n'est pas en location n'apparaît pas.
    expect(parkMonth(data, "2025-11", "2025-11-15").lines).toHaveLength(2);
  });

  it("ce que chaque bail doit encore", () => {
    expect(parkDebts(data, "2025-11-15")).toMatchObject([{ lease: { id: "a" }, months: ["2025-10"], due: 550, renters: "Alice Fictive" }]);
  });

  it("lots vides : depuis quand, loyers perdus au loyer possible, prochain bail signé", () => {
    const v = parkVacancies(data, "2025-08-15");
    expect(v.map((x) => [x.lot.id, x.since, x.days, x.nextStart])).toEqual([
      ["Chambre 2", "2025-07-01", 45, "2025-09-01"],
      ["Parking", null, null, null],
    ]);
    expect(v[0].lost).toBeCloseTo((420 * 12 * 45) / 365, 2);
    expect(v[1]).toMatchObject({ potentialRent: 80, lost: null });
    expect(parkVacancies(data, "2025-11-15").map((x) => x.lot.id)).toEqual(["Parking"]);
  });

  it("délai de relocation : du lendemain du départ au début du bail suivant", () => {
    expect(relocationGaps([b, c])).toEqual([62]);
    expect(relocationGaps([a])).toEqual([]);
  });

  it("occupation physique (jours) et financière (loyers reçus ÷ loyers possibles)", () => {
    const o = propertyOccupancy(data, property, 2025, "2025-12-31");
    expect(o.physical).toBeCloseTo((365 + 181 + 122) / (365 * 3), 6);
    expect(o.received).toBe(5_500 + 400 * 6 + 420 * 4);
    expect(o.possible).toBeCloseTo(6_000 + 4_080 + (62 * 420 * 12) / 365 + 80 * 12, 1);
    expect(o.financial).toBeCloseTo(o.received / o.possible, 6);
    expect(parkOccupancy(data, 2025, "2025-12-31")).toEqual(o);
    expect(propertyOccupancy(data, property, 2023, "2025-12-31")).toMatchObject({ physical: null, financial: null });
  });

  it("une ligne par bien loué : lots loués, loyer du mois, relocation", () => {
    expect(parkPropertyRows(data, 2025, "2025-11-15")).toMatchObject([{ property: { id: "b" }, lots: 3, rentedLots: 2, monthlyRent: 920, averageRelocationDays: 62 }]);
  });

  it("échéancier : baux, garanties, dépenses annuelles et rappels, retards compris", () => {
    const items = parkSchedule(data, "2025-11-15");
    expect(items.map((i) => [i.kind, i.date, i.late])).toEqual([
      ["depot", "2025-08-30", true],
      ["rappel", "2025-10-01", true],
      ["revision", "2026-01-01", false],
      ["garantie", "2026-03-01", false],
      ["rappel", "2026-03-15", false],
      ["conge", "2026-05-31", false],
      ["revision", "2026-09-01", false],
      ["conge", "2026-09-30", false],
      ["depense", "2026-10-15", false],
    ]);
    expect(items[0]).toMatchObject({ lotName: "Chambre 2", amount: 800, title: "Rendre le dépôt de garantie" });
    expect(items.find((i) => i.kind === "depense")?.title).toBe("Taxe foncière");
    expect(items.find((i) => i.kind === "garantie")?.title).toBe("Garantie Visale prend fin");
    // Logement classé F : pas de révision proposée.
    expect(parkSchedule({ ...data, properties: [{ ...property, dpe: "F" }] }, "2025-11-15").some((i) => i.kind === "revision")).toBe(false);
  });
});
