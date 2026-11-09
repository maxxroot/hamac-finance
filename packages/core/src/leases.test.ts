import { describe, expect, it } from "vitest";
import { documentAlerts, leaseAlerts } from "./alerts";
import { currentLease, defaultLeaseMonths, leaseDurationNote, leaseEnd, leaseRentAt, leaseRevisionDue, leaseState, rentReceipt, depositRetained, maxDeposit, rentMonths, validateLease, type Lease, type LeaseRent, type RentException } from "./leases";
import { NO_PROPERTY_DETAILS, type Property } from "./realestate";

const vide: Lease = { id: "l", propertyId: "b", kind: "vide", tenant: "", startDate: "2024-01-15", durationMonths: 36, rent: 800, charges: 50, deposit: 800, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", guarantor: "", tenantInsuranceUntil: null };
const meuble: Lease = { ...vide, kind: "meuble", durationMonths: 12, startDate: "2025-03-01" };

describe("règles légales", () => {
  it("durée proposée selon le type de bail et le statut (art. 10, 13, 25-7, 25-14)", () => {
    expect(defaultLeaseMonths("vide", "nom_propre")).toBe(36);
    expect(defaultLeaseMonths("vide", "indivision")).toBe(36);
    expect(defaultLeaseMonths("vide", "sci_familiale")).toBe(36);
    expect(defaultLeaseMonths("vide", "sci")).toBe(72);
    expect(defaultLeaseMonths("meuble", "sci")).toBe(12);
    expect(defaultLeaseMonths("etudiant", "nom_propre")).toBe(9);
    expect(defaultLeaseMonths("mobilite", "nom_propre")).toBe(10);
  });

  it("dépôt de garantie maximal (art. 22, 25-6, 25-17)", () => {
    expect(maxDeposit("vide", 800)).toBe(800);
    expect(maxDeposit("meuble", 800)).toBe(1600);
    expect(maxDeposit("etudiant", 800)).toBe(1600);
    expect(maxDeposit("mobilite", 800)).toBe(0);
    expect(maxDeposit("autre", 800)).toBeNull();
  });

  it("signale une durée sous le minimum légal sans bloquer", () => {
    expect(leaseDurationNote("vide", "nom_propre", 24)).toContain("3 ans");
    expect(leaseDurationNote("vide", "sci", 36)).toContain("6 ans");
    expect(leaseDurationNote("vide", "nom_propre", 36)).toBeNull();
    expect(leaseDurationNote("mobilite", "nom_propre", 12)).toContain("dix mois");
  });
});

describe("échéances d'un bail", () => {
  it("période initiale : fin la veille de l'anniversaire, congé du propriétaire 6 mois avant", () => {
    const s = leaseState(vide, [], "2026-05-01");
    expect(s.status).toBe("en_cours");
    expect(s.end).toBeNull();
    expect(s.termEnd).toBe("2027-01-14");
    expect(s.nextDeadline).toBe("2026-07-14");
    expect(s.nextDeadlineTermEnd).toBe("2027-01-14");
  });

  it("date limite passée : la prochaine vise la période suivante", () => {
    const s = leaseState(vide, [], "2026-08-01");
    expect(s.termEnd).toBe("2027-01-14");
    expect(s.nextDeadline).toBe("2029-07-14");
    expect(s.nextDeadlineTermEnd).toBe("2030-01-14");
  });

  it("reconduction automatique pour la même durée", () => {
    const s = leaseState(vide, [], "2027-03-01");
    expect(s.status).toBe("en_cours");
    expect(s.termEnd).toBe("2030-01-14");
  });

  it("meublé : reconduit d'un an, congé du propriétaire 3 mois avant", () => {
    const s = leaseState(meuble, [], "2025-06-01");
    expect(s.termEnd).toBe("2026-02-28");
    expect(s.nextDeadline).toBe("2025-11-28");
  });

  it("bail étudiant et bail mobilité : s'arrêtent seuls, sans date limite", () => {
    const etudiant = leaseState({ ...meuble, kind: "etudiant", durationMonths: 9 }, [], "2025-06-01");
    expect(etudiant.end).toBe("2025-11-30");
    expect(etudiant.nextDeadline).toBeNull();
    expect(leaseEnd({ ...meuble, kind: "mobilite", durationMonths: 4 })).toBe("2025-06-30");
  });

  it("congé du locataire : même quantième, ou dernier jour du mois (F32360)", () => {
    expect(leaseEnd({ ...meuble, noticeBy: "locataire", noticeDate: "2025-09-05" })).toBe("2025-10-05");
    expect(leaseEnd({ ...meuble, noticeBy: "locataire", noticeDate: "2026-01-30" })).toBe("2026-02-28");
    expect(leaseEnd({ ...vide, noticeBy: "locataire", noticeDate: "2025-09-05" })).toBe("2025-12-05");
    expect(leaseEnd({ ...vide, noticeBy: "locataire", noticeDate: "2025-09-05", noticeMonths: 1 })).toBe("2025-10-05");
  });

  it("congé du locataire : statut, puis terminé après la date de fin", () => {
    const l = { ...meuble, noticeBy: "locataire" as const, noticeDate: "2025-09-05" };
    expect(leaseState(l, [], "2025-10-05").status).toBe("conge");
    expect(leaseState(l, [], "2025-10-06").status).toBe("termine");
  });

  it("congé du propriétaire : à la fin de la période s'il est dans les temps", () => {
    const l = { ...vide, noticeBy: "proprietaire" as const, noticeDate: "2026-07-14" };
    expect(leaseEnd(l)).toBe("2027-01-14");
    expect(leaseState(l, [], "2026-08-01").noticeTooLateFor).toBeNull();
  });

  it("congé du propriétaire trop tardif : vaut pour la période suivante", () => {
    const l = { ...vide, noticeBy: "proprietaire" as const, noticeDate: "2026-07-15" };
    expect(leaseEnd(l)).toBe("2030-01-14");
    expect(leaseState(l, [], "2026-08-01").noticeTooLateFor).toBe("2027-01-14");
  });

  it("le départ réel prime sur la fin calculée", () => {
    expect(leaseEnd({ ...vide, noticeBy: "locataire", noticeDate: "2025-09-05", actualEnd: "2025-11-01" })).toBe("2025-11-01");
  });

  it("à venir avant son début", () => {
    expect(leaseState(vide, [], "2023-12-01").status).toBe("a_venir");
  });
});

describe("loyer en vigueur", () => {
  const rents: LeaseRent[] = [
    { id: "r2", leaseId: "l", fromMonth: "2026-01", rent: 830, charges: 60 },
    { id: "r1", leaseId: "l", fromMonth: "2025-01", rent: 815, charges: 50 },
    { id: "x", leaseId: "autre", fromMonth: "2024-06", rent: 1, charges: 1 },
  ];
  it("loyer de départ, puis dernier changement applicable", () => {
    expect(leaseRentAt(vide, rents, "2024-12")).toEqual({ rent: 800, charges: 50 });
    expect(leaseRentAt(vide, rents, "2025-01")).toEqual({ rent: 815, charges: 50 });
    expect(leaseRentAt(vide, rents, "2026-06")).toEqual({ rent: 830, charges: 60 });
    expect(leaseState(vide, rents, "2026-06-15").rent).toBe(830);
  });
});

describe("validation d'un bail", () => {
  const nouveau = { ...vide, id: undefined, startDate: "2028-01-01" };
  it("refuse un second bail tant que le premier court sans date de fin", () => {
    expect(validateLease(nouveau, [vide])).toContain("déjà un bail");
  });
  it("accepte un bail après la fin du précédent, refuse le chevauchement", () => {
    const parti = { ...vide, noticeBy: "locataire" as const, noticeDate: "2025-09-05" };
    expect(validateLease({ ...nouveau, startDate: "2025-12-06" }, [parti])).toBeNull();
    expect(validateLease({ ...nouveau, startDate: "2025-12-05" }, [parti])).toContain("déjà un bail");
  });
  it("ignore le bail en cours de modification, contrôle congé et départ", () => {
    expect(validateLease(vide, [vide])).toBeNull();
    expect(validateLease({ ...vide, noticeBy: "locataire" }, [])).toContain("qui donne congé");
    expect(validateLease({ ...vide, noticeBy: "locataire", noticeDate: "2023-01-01" }, [])).toContain("précéder");
    expect(validateLease({ ...vide, actualEnd: "2023-01-01" }, [])).toContain("précéder");
  });
});

describe("bail à mettre en avant", () => {
  it("en cours, sinon à venir, sinon le dernier terminé", () => {
    const fini = leaseState({ ...vide, id: "a", actualEnd: "2024-06-01" }, [], "2026-01-01");
    const encours = leaseState({ ...vide, id: "b", startDate: "2024-07-01" }, [], "2026-01-01");
    const avenir = leaseState({ ...vide, id: "c", startDate: "2027-01-01" }, [], "2026-01-01");
    expect(currentLease([fini, encours, avenir])?.lease.id).toBe("b");
    expect(currentLease([fini, avenir])?.lease.id).toBe("c");
    expect(currentLease([fini])?.lease.id).toBe("a");
    expect(currentLease([])).toBeNull();
  });
});

describe("rappels", () => {
  const bien: Property = { id: "b", kind: "locatif", ownership: "nom_propre", name: "Studio", value: 100_000, valueDate: null, purchasePrice: null, purchaseDate: null, newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 0, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
  const run = (lease: Lease, today: string, property = bien) => leaseAlerts({ properties: [property], leases: [lease], leaseRents: [] }, today);

  it("date limite pour donner congé : rappelée 60 jours avant, pas au-delà ni après", () => {
    expect(run(vide, "2026-05-14")).toHaveLength(0);
    const [alert] = run(vide, "2026-05-15");
    expect(alert).toMatchObject({ level: "attention", link: "/immobilier/b" });
    expect(alert.title).toContain("14/07/2026");
    expect(alert.detail).toContain("15/01/2027");
    expect(run(vide, "2026-07-15")).toHaveLength(0);
  });

  it("fin d'un bail qui ne se reconduit pas", () => {
    const [alert] = run({ ...meuble, kind: "etudiant", durationMonths: 9 }, "2025-11-01");
    expect(alert.title).toContain("30/11/2025");
    expect(alert.level).toBe("attention");
  });

  it("congé donné : fin de bail annoncée", () => {
    const [alert] = run({ ...meuble, noticeBy: "locataire", noticeDate: "2025-09-05" }, "2025-09-10");
    expect(alert).toMatchObject({ id: "bail-depart-l", level: "info" });
  });

  it("plus de bail en cours", () => {
    expect(run({ ...meuble, actualEnd: "2025-06-01" }, "2026-01-01").map((a) => a.id)).toEqual(["bail-depot-l", "bail-vacant-b"]);
  });

  it("rappels décochés : plus aucun rappel de bail, l'impayé reste signalé", () => {
    const silencieux = { ...vide, reminders: false };
    expect(run(silencieux, "2026-05-15")).toHaveLength(0);
    expect(run({ ...silencieux, actualEnd: "2025-06-01" }, "2026-01-01")).toHaveLength(0);
    const bien2 = { id: "b", kind: "locatif", name: "Studio", archived: false } as Property;
    const impaye: RentException = { id: "x", leaseId: "l", month: "2026-02", kind: "impaye", amount: null, comment: "" };
    expect(leaseAlerts({ properties: [bien2], leases: [silencieux], leaseRents: [], rentExceptions: [impaye] }, "2026-05-15").map((a) => a.id)).toEqual(["loyers-impayes-b"]);
  });

  it("rien pour un bien qui n'est plus en location ou archivé", () => {
    expect(run(vide, "2026-05-20", { ...bien, kind: "autre" })).toHaveLength(0);
    expect(run(vide, "2026-05-20", { ...bien, archived: true })).toHaveLength(0);
  });
});

describe("loyers automatiques", () => {
  const bail: Lease = { ...vide, startDate: "2026-01-16", durationMonths: 36, rent: 620, charges: 62 };
  const exception = (month: string, kind: RentException["kind"], amount: number | null = null): RentException => ({ id: month, leaseId: "l", month, kind, amount, comment: "" });

  it("un mois par mois échu ou en cours, premier mois au prorata des jours", () => {
    const months = rentMonths(bail, [], [], "2026-03-10");
    expect(months.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    // 16 jours sur 31 en janvier.
    expect(months[0].occupied).toBeCloseTo(16 / 31, 6);
    expect(months[0]).toMatchObject({ expectedRent: 320, expectedCharges: 32, receivedRent: 320, status: "paye" });
    expect(months[2]).toMatchObject({ occupied: 1, receivedRent: 620, receivedCharges: 62 });
  });

  it("dernier mois au prorata, rien après la fin du bail", () => {
    const months = rentMonths({ ...bail, actualEnd: "2026-03-15" }, [], [], "2026-06-01");
    expect(months.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(months[2].expectedRent).toBe(300); // 15 jours sur 31 de 620 €
  });

  it("nouveau loyer appliqué à partir de son mois", () => {
    const rents: LeaseRent[] = [{ id: "r", leaseId: "l", fromMonth: "2026-03", rent: 640, charges: 62 }];
    const months = rentMonths(bail, rents, [], "2026-03-10");
    expect(months[1].expectedRent).toBe(620);
    expect(months[2].expectedRent).toBe(640);
  });

  it("impayé : rien de reçu, logement occupé", () => {
    const [, m] = rentMonths(bail, [], [exception("2026-02", "impaye")], "2026-03-10");
    expect(m).toMatchObject({ status: "impaye", occupied: 1, expectedRent: 620, receivedRent: 0, receivedCharges: 0 });
  });

  it("mois vide : rien de prévu ni d'occupé", () => {
    const [, m] = rentMonths(bail, [], [exception("2026-02", "vide")], "2026-03-10");
    expect(m).toMatchObject({ status: "vide", occupied: 0, expectedRent: 0, receivedRent: 0 });
  });

  it("montant différent : le loyer reçu est celui indiqué, les charges restent prévues", () => {
    const [, m] = rentMonths(bail, [], [exception("2026-02", "montant", 500)], "2026-03-10");
    expect(m).toMatchObject({ status: "montant", expectedRent: 620, receivedRent: 500, receivedCharges: 62 });
  });

  it("alerte sur les loyers impayés", () => {
    const bien = { id: "b", kind: "locatif", name: "Studio", archived: false } as Property;
    const alerts = leaseAlerts({ properties: [bien], leases: [bail], leaseRents: [], rentExceptions: [exception("2026-02", "impaye")] }, "2026-03-10");
    expect(alerts.find((a) => a.id === "loyers-impayes-b")).toMatchObject({ level: "attention", title: "Studio : 1 loyer impayé" });
  });
});

describe("dépôt à la sortie et révision du loyer", () => {
  it("retenue : dépôt moins somme rendue, rien tant qu'il n'est pas rendu", () => {
    expect(depositRetained({ deposit: 800, depositReturned: null })).toBe(0);
    expect(depositRetained({ deposit: 800, depositReturned: 650 })).toBe(150);
    expect(depositRetained({ deposit: 800, depositReturned: 900 })).toBe(0);
  });

  it("révision : 30 jours autour de l'anniversaire, jamais pour un bail sans révision", () => {
    expect(leaseRevisionDue(vide, [], "2025-12-15")).toBe(null);
    expect(leaseRevisionDue(vide, [], "2025-12-16")).toBe("2026-01-15");
    expect(leaseRevisionDue(vide, [], "2026-02-14")).toBe("2026-01-15");
    expect(leaseRevisionDue(vide, [], "2026-02-15")).toBe(null);
    expect(leaseRevisionDue(vide, [], "2024-01-20")).toBe(null);
    expect(leaseRevisionDue({ ...vide, kind: "mobilite" }, [], "2026-01-15")).toBe(null);
  });

  it("révision : plus de rappel une fois le nouveau loyer saisi", () => {
    const rents: LeaseRent[] = [{ id: "r", leaseId: "l", fromMonth: "2026-01", rent: 830, charges: 50 }];
    expect(leaseRevisionDue(vide, rents, "2026-01-20")).toBe(null);
    expect(leaseRevisionDue(vide, [{ ...rents[0], fromMonth: "2025-01" }], "2026-01-20")).toBe("2026-01-15");
  });

  const bien = { id: "b", kind: "locatif", name: "Studio", archived: false, dpe: null } as Property;
  it("alerte de révision, sauf note F ou G", () => {
    expect(leaseAlerts({ properties: [bien], leases: [vide], leaseRents: [] }, "2026-01-20").some((a) => a.id === "bail-revision-l")).toBe(true);
    expect(leaseAlerts({ properties: [{ ...bien, dpe: "F" }], leases: [vide], leaseRents: [] }, "2026-01-20").some((a) => a.id === "bail-revision-l")).toBe(false);
  });

  it("alerte de dépôt à restituer jusqu'à ce qu'il soit noté, sauf rappels décochés ou dépôt nul", () => {
    const parti = { ...vide, actualEnd: "2025-06-01" };
    const ids = (l: Lease) => leaseAlerts({ properties: [bien], leases: [l], leaseRents: [] }, "2026-03-01").map((a) => a.id);
    expect(ids(parti)).toContain("bail-depot-l");
    expect(ids({ ...parti, depositReturned: 800, depositReturnedOn: "2025-07-01" })).not.toContain("bail-depot-l");
    expect(ids({ ...parti, reminders: false })).not.toContain("bail-depot-l");
    expect(ids({ ...parti, deposit: 0 })).not.toContain("bail-depot-l");
  });
});

describe("quittances", () => {
  const month = { leaseId: "l", month: "2026-02", occupied: 1, expectedRent: 620, expectedCharges: 62, receivedRent: 620, receivedCharges: 62, status: "paye", exception: null } as const;
  it("loyer payé : quittance avec loyer et charges distingués", () => {
    expect(rentReceipt(month)).toEqual({ kind: "quittance", rent: 620, charges: 62, total: 682 });
  });
  it("paiement partiel : un reçu ; rien reçu : aucun document", () => {
    expect(rentReceipt({ ...month, status: "montant", receivedRent: 500 })).toEqual({ kind: "recu", rent: 500, charges: 62, total: 562 });
    expect(rentReceipt({ ...month, status: "impaye", receivedRent: 0, receivedCharges: 0 })).toBeNull();
  });
});

describe("rappels de documents et d'assurance", () => {
  const bien = { id: "b", kind: "locatif", name: "Studio", archived: false, dpe: null } as Property;
  const doc = { id: "d", propertyId: "b", kind: "diagnostic", label: "Diagnostic gaz", date: null, expiresOn: "2026-06-30", location: "" } as const;
  it("document : prévenu 30 jours avant, signalé une fois expiré, rien sans date ou bien archivé", () => {
    expect(documentAlerts({ properties: [bien], propertyDocuments: [doc] }, "2026-05-30")).toHaveLength(0);
    expect(documentAlerts({ properties: [bien], propertyDocuments: [doc] }, "2026-05-31")[0]).toMatchObject({ level: "info" });
    expect(documentAlerts({ properties: [bien], propertyDocuments: [doc] }, "2026-07-01")[0]).toMatchObject({ level: "attention" });
    expect(documentAlerts({ properties: [bien], propertyDocuments: [{ ...doc, expiresOn: null }] }, "2026-07-01")).toHaveLength(0);
    expect(documentAlerts({ properties: [{ ...bien, archived: true }], propertyDocuments: [doc] }, "2026-07-01")).toHaveLength(0);
  });
  it("assurance du locataire : rappel à l'approche, seulement si les rappels sont actifs", () => {
    const l = { ...vide, tenantInsuranceUntil: "2026-03-01" };
    const ids = (x: Lease, today: string) => leaseAlerts({ properties: [bien], leases: [x], leaseRents: [] }, today).map((a) => a.id);
    expect(ids(l, "2026-01-29")).not.toContain("bail-assurance-l");
    expect(ids(l, "2026-02-10")).toContain("bail-assurance-l");
    expect(ids({ ...l, reminders: false }, "2026-02-10")).not.toContain("bail-assurance-l");
  });
});
