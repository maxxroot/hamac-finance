import { describe, expect, it } from "vitest";
import { NO_RENT_LEDGER, validateLease, type Lease } from "./leases";
import { defaultLotName, leaseKindsFor, lotFitsMode, lotIsActive, lotKindsFor, rentalModeFromLeases, sortLots, type Lot } from "./lots";
import { NO_PROPERTY_DETAILS, type Property } from "./realestate";
import { propertyYears, type RentalData } from "./rental";
import { joinNames, leaseRenterNames, leaseRenters, renterName, type Renter } from "./renters";

const lot = (id: string, kind: Lot["kind"], extra: Partial<Lot> = {}): Lot => ({ id, propertyId: "b", name: id, kind, surface: null, targetRent: null, comment: "", archived: false, sortOrder: 0, ...extra });
const bail = (id: string, lotId: string, extra: Partial<Lease> = {}): Lease => ({ id, propertyId: "b", lotId, kind: "meuble", startDate: "2025-01-01", durationMonths: 12, rent: 500, charges: 0, deposit: 0, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: null, landlordAddress: "", dueDay: 1, ...extra });

describe("mode de location", () => {
  it("propose le logement entier, ou les chambres en colocation par chambre, avec les annexes", () => {
    expect(lotKindsFor("vide")).toEqual(["logement", "parking", "cave", "local", "autre"]);
    expect(lotKindsFor("colocation")).toContain("logement");
    expect(lotKindsFor("chambres")).toEqual(["chambre", "parking", "cave", "local", "autre"]);
    expect(lotFitsMode("logement", "chambres")).toBe(false);
  });

  it("limite les types de bail selon le mode et le lot", () => {
    expect(leaseKindsFor("vide", "logement")).toEqual(["vide", "autre"]);
    expect(leaseKindsFor("meuble", "logement")).toEqual(["meuble", "etudiant", "mobilite", "autre"]);
    expect(leaseKindsFor("chambres", "chambre")).toContain("etudiant");
    expect(leaseKindsFor("meuble", "parking")).toEqual(["autre"]);
  });

  it("un lot archivé ou qui ne correspond plus au mode n'est plus proposé", () => {
    expect(lotIsActive(lot("a", "chambre"), "chambres")).toBe(true);
    expect(lotIsActive(lot("a", "chambre", { archived: true }), "chambres")).toBe(false);
    expect(lotIsActive(lot("a", "logement"), "chambres")).toBe(false);
  });

  it("déduit le mode des anciens baux : celui du plus récent", () => {
    expect(rentalModeFromLeases([])).toBe("vide");
    expect(rentalModeFromLeases([{ kind: "meuble", startDate: "2020-01-01" }, { kind: "vide", startDate: "2023-01-01" }])).toBe("vide");
    expect(rentalModeFromLeases([{ kind: "etudiant", startDate: "2024-09-01" }])).toBe("meuble");
  });

  it("nomme les nouveaux lots et les trie dans l'ordre naturel", () => {
    expect(defaultLotName("chambre", [lot("a", "chambre"), lot("b", "chambre")])).toBe("Chambre 3");
    expect(defaultLotName("chambre", [])).toBe("Chambre 1");
    expect(defaultLotName("parking", [])).toBe("Parking ou box");
    expect(defaultLotName("logement", [])).toBe("Logement");
    expect(sortLots([lot("Chambre 10", "chambre"), lot("Chambre 2", "chambre")]).map((l) => l.name)).toEqual(["Chambre 2", "Chambre 10"]);
  });
});

describe("baux de plusieurs lots", () => {
  const lots = [lot("logement", "logement"), lot("c1", "chambre"), lot("c2", "chambre"), lot("p", "parking")];

  it("deux chambres se louent en même temps, pas deux fois la même", () => {
    expect(validateLease(bail("n", "c2"), [bail("a", "c1")], lots)).toBeNull();
    expect(validateLease(bail("n", "c1"), [bail("a", "c1")], lots)).toMatch(/Ce logement a déjà un bail/);
  });

  it("le logement entier ne se loue pas en même temps qu'une chambre ; une annexe, si", () => {
    expect(validateLease(bail("n", "logement"), [bail("a", "c1")], lots)).toMatch(/logement entier et une chambre/);
    expect(validateLease(bail("n", "p", { kind: "autre" }), [bail("a", "logement")], lots)).toBeNull();
  });

  it("le logement entier se reloue en chambres une fois son bail terminé", () => {
    expect(validateLease(bail("n", "c1", { startDate: "2026-01-01" }), [bail("a", "logement", { kind: "etudiant", durationMonths: 9 })], lots)).toBeNull();
  });
});

describe("occupation pondérée par le loyer", () => {
  const property: Property = { id: "b", kind: "locatif", ownership: "nom_propre", name: "Maison", value: 300_000, valueDate: null, purchasePrice: 250_000, purchaseDate: "2024-06-01", newBuild: false, ...NO_PROPERTY_DETAILS, rentalMode: "chambres", notaryFees: 0, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
  const base: RentalData = { incomes: [], property, leases: [], rents: [], ledger: NO_RENT_LEDGER, expenses: [], loans: [], lots: [] };

  it("une chambre à 600 € vide six mois pèse plus qu'un parking à 100 € vide toute l'année", () => {
    const lots = [lot("c1", "chambre"), lot("c2", "chambre"), lot("p", "parking", { targetRent: 100 })];
    const leases = [bail("l1", "c1", { rent: 600, durationMonths: 24 }), bail("l2", "c2", { rent: 600, actualEnd: "2025-06-30" })];
    const y = propertyYears({ ...base, lots, leases }, "2025-12-31").find((x) => x.year === 2025)!;
    // c1 occupée 365 j, c2 occupée du 1er janvier au 30 juin (181 j) ; le parking compte vide, au loyer espéré.
    expect(y.occupancy).toBeCloseTo((600 * 365 + 600 * 181) / (600 * 365 + 600 * 365 + 100 * 365), 6);
  });

  it("un lot sans bail ni loyer espéré ne compte pas", () => {
    const lots = [lot("c1", "chambre"), lot("c2", "chambre")];
    const y = propertyYears({ ...base, lots, leases: [bail("l1", "c1", { durationMonths: 24 })] }, "2025-12-31").find((x) => x.year === 2025)!;
    expect(y.occupancy).toBe(1);
  });

  it("le logement entier loué avant le passage en chambres s'arrête à la fin de son bail", () => {
    const lots = [lot("logement", "logement"), lot("c1", "chambre")];
    const leases = [bail("l1", "logement", { rent: 900, durationMonths: 12, actualEnd: "2025-06-30" }), bail("l2", "c1", { rent: 450, startDate: "2025-07-01", durationMonths: 24 })];
    const y = propertyYears({ ...base, lots, leases }, "2025-12-31").find((x) => x.year === 2025)!;
    // Logement loué jusqu'au 30 juin, puis la chambre à partir du 1er juillet : rien n'est compté vide.
    expect(y.occupancy).toBeCloseTo(1, 6);
  });
});

describe("locataires", () => {
  const renters: Renter[] = [
    { id: "a", firstName: "Alice", lastName: "Fictive", email: "", phone: "", forwardingAddress: "", comment: "" },
    { id: "b", firstName: "", lastName: "Bruno Exemple", email: "", phone: "", forwardingAddress: "", comment: "" },
    { id: "c", firstName: "Chloé", lastName: "", email: "", phone: "", forwardingAddress: "", comment: "" },
  ];
  const links = [
    { leaseId: "l", renterId: "c", sortOrder: 2 },
    { leaseId: "l", renterId: "a", sortOrder: 0 },
    { leaseId: "l", renterId: "b", sortOrder: 1 },
    { leaseId: "autre", renterId: "a", sortOrder: 0 },
  ];

  it("assemble les noms comme dans un courrier", () => {
    expect(renterName(renters[0])).toBe("Alice Fictive");
    expect(joinNames([])).toBe("");
    expect(joinNames(["Alice"])).toBe("Alice");
    expect(joinNames(["Alice", "Bruno"])).toBe("Alice et Bruno");
    expect(leaseRenterNames("l", links, renters)).toBe("Alice Fictive, Bruno Exemple et Chloé");
  });

  it("garde l'ordre de saisie et ignore un lien vers un locataire disparu", () => {
    expect(leaseRenters("l", [...links, { leaseId: "l", renterId: "x", sortOrder: 3 }], renters).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("état d'un lot", () => {
  it("loué, vide depuis le lendemain du départ, ou bientôt loué", async () => {
    const { lotStatus } = await import("./lots");
    const { monthlyRentNow } = await import("./leases");
    const c1 = lot("c1", "chambre");
    const parti = bail("a", "c1", { actualEnd: "2025-06-30" });
    expect(lotStatus(c1, [parti], [], "2025-03-01").current?.lease.id).toBe("a");
    expect(lotStatus(c1, [parti], [], "2025-08-01")).toMatchObject({ current: null, upcoming: null, vacantSince: "2025-07-01" });
    const suivant = bail("b", "c1", { startDate: "2025-09-01" });
    expect(lotStatus(c1, [parti, suivant], [], "2025-08-01").upcoming?.lease.id).toBe("b");
    expect(lotStatus(lot("c2", "chambre"), [parti], [], "2025-08-01").vacantSince).toBeNull();
    expect(monthlyRentNow([bail("x", "c1", { rent: 450 }), bail("y", "c2", { rent: 500.5 })], [], "2025-03-01")).toBe(950.5);
    expect(monthlyRentNow([parti], [], "2025-08-01")).toBeNull();
  });
});

describe("alertes lot par lot", () => {
  it("nomme le lot quand le bien en a plusieurs, prévient d'un lot vide et d'une garantie qui se termine", async () => {
    const { leaseAlerts } = await import("../alerts");
    const property: Property = { id: "b", kind: "locatif", ownership: "nom_propre", name: "Maison", value: 300_000, valueDate: null, purchasePrice: null, purchaseDate: null, newBuild: false, ...NO_PROPERTY_DETAILS, rentalMode: "chambres", notaryFees: 0, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
    const lots = [lot("c1", "chambre", { name: "Chambre 1" }), lot("c2", "chambre", { name: "Chambre 2" }), lot("old", "logement", { name: "Logement" })];
    const leases = [
      bail("a", "c1", { startDate: "2025-09-01", durationMonths: 12 }),
      bail("b", "c2", { startDate: "2024-09-01", actualEnd: "2025-06-30" }),
      bail("c", "old", { startDate: "2020-01-01", actualEnd: "2024-06-30" }),
    ];
    const guarantees = [{ id: "g", leaseId: "a", kind: "visale" as const, name: "", contact: "", amount: null, until: "2025-12-01", comment: "", sortOrder: 0 }];
    const titles = leaseAlerts({ properties: [property], leases, lots, leaseGuarantees: guarantees }, "2025-11-15").map((a) => a.title);
    expect(titles).toContain("Maison, Chambre 2 : aucun bail en cours");
    expect(titles).toContain("Maison, Chambre 1 : garantie visale jusqu'au 01/12/2025");
    // Le logement entier, sorti du mode de location, n'attend pas de nouveau bail.
    expect(titles.some((t) => t.startsWith("Maison, Logement : aucun bail"))).toBe(false);
    // Un bien à lot unique garde son nom seul.
    const single = leaseAlerts({ properties: [{ ...property, rentalMode: "meuble" }], leases: [bail("x", "old", { actualEnd: "2025-06-30" })], lots: [lots[2]] }, "2025-11-15");
    expect(single.filter((a) => !a.id.startsWith("loyers-non-recus")).map((a) => [a.id, a.title])).toEqual([["bail-vacant-b", "Maison : aucun bail en cours"]]);
    // Sans paiement pointé, le bail parti a des loyers non reçus, nommés par lot.
    expect(titles).toContain("Maison, Chambre 2 : 10 loyers non reçus");
  });
});
