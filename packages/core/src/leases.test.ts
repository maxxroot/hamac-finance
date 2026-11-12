import { describe, expect, it } from "vitest";
import { documentAlerts, leaseAlerts } from "./alerts";
import { currentLease, defaultLeaseMonths, leaseDurationNote, leaseEnd, leaseRentAt, leaseRevisionDue, leaseState, rentReceipt, depositRetained, maxDeposit, rentMonths, rentDueDate, leaseBalance, settlingPayment, NO_RENT_LEDGER, validateLease, type Lease, type LeaseRent, type RentLedger, type RentPayment, type RentWaiver } from "./leases";
import { NO_PROPERTY_DETAILS, type Property } from "./realestate";

const vide: Lease = { id: "l", propertyId: "b", lotId: "lot", kind: "vide", startDate: "2024-01-15", durationMonths: 36, rent: 800, charges: 50, deposit: 800, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: null, landlordAddress: "", dueDay: 1 };
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
  it("date de début vide ou incomplète, durée nulle : un message, jamais d'erreur ni de calcul sans fin", () => {
    expect(validateLease({ ...vide, startDate: "" }, [])).toContain("date de début");
    expect(validateLease({ ...vide, startDate: "0002-01-15" }, [])).toContain("date de début");
    expect(validateLease({ ...vide, durationMonths: 0 }, [])).toContain("durée");
    expect(validateLease({ ...vide, durationMonths: 0, noticeBy: "proprietaire", noticeDate: "2026-01-01" }, [])).toContain("durée");
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
  // Échéances du bail seules : les loyers non pointés ont leurs propres tests.
  const run = (lease: Lease, today: string, property = bien) => leaseAlerts({ properties: [property], leases: [lease], leaseRents: [] }, today).filter((a) => !a.id.startsWith("loyers-non-recus"));

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

  it("rappels décochés : plus aucun rappel de bail, les loyers non reçus restent signalés", () => {
    const silencieux = { ...vide, reminders: false };
    expect(run(silencieux, "2026-05-15")).toHaveLength(0);
    expect(run({ ...silencieux, actualEnd: "2025-06-01" }, "2026-01-01")).toHaveLength(0);
    const bien2 = { id: "b", kind: "locatif", name: "Studio", archived: false } as Property;
    expect(leaseAlerts({ properties: [bien2], leases: [silencieux], leaseRents: [] }, "2026-05-15").map((a) => a.id)).toEqual(["loyers-non-recus-l"]);
  });

  it("rien pour un bien qui n'est plus en location ou archivé", () => {
    expect(run(vide, "2026-05-20", { ...bien, kind: "autre" })).toHaveLength(0);
    expect(run(vide, "2026-05-20", { ...bien, archived: true })).toHaveLength(0);
  });
});

describe("loyers pointés", () => {
  const bail: Lease = { ...vide, startDate: "2026-01-16", durationMonths: 36, rent: 620, charges: 62, dueDay: 5 };
  const pay = (month: string, amount: number, date = `${month}-05`): RentPayment => ({ id: `${month}-${amount}`, leaseId: "l", month, date, amount, method: "virement", comment: "" });
  const ledger = (payments: RentPayment[] = [], waivers: RentWaiver[] = []): RentLedger => ({ payments, waivers });

  it("un mois par mois échu ou en cours, premier mois au prorata des jours ; rien n'est reçu sans pointage", () => {
    const months = rentMonths(bail, [], NO_RENT_LEDGER, "2026-03-10");
    expect(months.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    // 16 jours sur 31 en janvier.
    expect(months[0].occupied).toBeCloseTo(16 / 31, 6);
    expect(months[0]).toMatchObject({ expectedRent: 320, expectedCharges: 32, due: 352, paid: 0, receivedRent: 0, outstanding: 352, dueDate: "2026-01-05", status: "non_recu" });
    // Échéance le 5 mars, tolérance de 10 jours : encore attendu le 10.
    expect(months[2]).toMatchObject({ occupied: 1, due: 682, status: "attendu" });
    expect(rentMonths(bail, [], NO_RENT_LEDGER, "2026-03-04")[2].status).toBe("a_venir");
    expect(rentMonths(bail, [], NO_RENT_LEDGER, "2026-03-16")[2].status).toBe("non_recu");
  });

  it("échéance au-delà de la fin du mois : le dernier jour", () => {
    expect(rentDueDate("2026-02", 31)).toBe("2026-02-28");
    expect(rentDueDate("2026-03", 0)).toBe("2026-03-01");
  });

  it("dernier mois au prorata, rien après la fin du bail", () => {
    const months = rentMonths({ ...bail, actualEnd: "2026-03-15" }, [], NO_RENT_LEDGER, "2026-06-01");
    expect(months.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(months[2].expectedRent).toBe(300); // 15 jours sur 31 de 620 €
  });

  it("nouveau loyer appliqué à partir de son mois", () => {
    const rents: LeaseRent[] = [{ id: "r", leaseId: "l", fromMonth: "2026-03", rent: 640, charges: 62 }];
    const months = rentMonths(bail, rents, NO_RENT_LEDGER, "2026-03-10");
    expect(months[1].expectedRent).toBe(620);
    expect(months[2].expectedRent).toBe(640);
  });

  it("reçu en entier, en deux fois, ou en partie : loyer et charges au prorata", () => {
    const [, entier] = rentMonths(bail, [], ledger([pay("2026-02", 682)]), "2026-03-10");
    expect(entier).toMatchObject({ status: "recu", paid: 682, receivedRent: 620, receivedCharges: 62, outstanding: 0 });
    const [, deuxFois] = rentMonths(bail, [], ledger([pay("2026-02", 400, "2026-02-20"), pay("2026-02", 282, "2026-02-04")]), "2026-03-10");
    expect(deuxFois).toMatchObject({ status: "recu", paid: 682 });
    expect(deuxFois.payments.map((p) => p.date)).toEqual(["2026-02-04", "2026-02-20"]);
    const [, partiel] = rentMonths(bail, [], ledger([pay("2026-02", 341)]), "2026-03-10");
    expect(partiel).toMatchObject({ status: "partiel", receivedRent: 310, receivedCharges: 31, outstanding: 341 });
    // Trop-perçu : tout est reçu, le surplus reste dans le total pointé.
    const [, trop] = rentMonths(bail, [], ledger([pay("2026-02", 700)]), "2026-03-10");
    expect(trop).toMatchObject({ status: "recu", paid: 700, receivedRent: 620, receivedCharges: 62 });
  });

  it("mois remis : rien n'est dû, le logement reste occupé", () => {
    const [, m] = rentMonths(bail, [], ledger([], [{ id: "w", leaseId: "l", month: "2026-02", comment: "Travaux" }]), "2026-03-10");
    expect(m).toMatchObject({ status: "remis", occupied: 1, expectedRent: 620, due: 0, outstanding: 0, receivedRent: 0 });
  });

  it("paiement qui solde un mois : le reste dû, à l'échéance passée ou aujourd'hui", () => {
    const [jan, fev, mars] = rentMonths(bail, [], ledger([pay("2026-02", 82)]), "2026-03-03");
    expect(settlingPayment(jan, "2026-03-03")).toEqual({ leaseId: "l", month: "2026-01", date: "2026-01-05", amount: 352, method: "virement", comment: "" });
    expect(settlingPayment(fev, "2026-03-03", "caf")).toMatchObject({ amount: 600, method: "caf" });
    expect(settlingPayment(mars, "2026-03-03")).toMatchObject({ date: "2026-03-03", amount: 682 });
    expect(settlingPayment({ ...jan, outstanding: 0 }, "2026-03-03")).toBeNull();
  });

  it("solde du locataire : dû sur les échéances passées, moins tout ce qui est reçu", () => {
    expect(leaseBalance(bail, [], ledger([pay("2026-01", 352), pay("2026-02", 682)]), "2026-03-10")).toBe(682);
    expect(leaseBalance(bail, [], ledger([pay("2026-01", 352), pay("2026-02", 682), pay("2026-03", 700, "2026-03-01")]), "2026-03-10")).toBe(-18);
  });

  it("alerte par bail sur les loyers non reçus passé le délai de tolérance", () => {
    const bien = { id: "b", kind: "locatif", name: "Studio", archived: false } as Property;
    const alerts = leaseAlerts({ properties: [bien], leases: [bail], leaseRents: [], rentPayments: [pay("2026-01", 352), pay("2026-02", 300)] }, "2026-03-10");
    expect(alerts.find((a) => a.id === "loyers-non-recus-l")).toMatchObject({ level: "attention", title: "Studio : 1 loyer non reçu", detail: expect.stringMatching(/^382\s€ attendus, depuis 02\/2026\. Pointez ce qui est arrivé/) });
    expect(leaseAlerts({ properties: [bien], leases: [bail], leaseRents: [], rentPayments: [pay("2026-01", 352), pay("2026-02", 682)] }, "2026-03-10").some((a) => a.id.startsWith("loyers-non-recus"))).toBe(false);
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
  const bail: Lease = { ...vide, startDate: "2026-01-01", rent: 620, charges: 62 };
  const month = (amount: number) => rentMonths(bail, [], { payments: amount ? [{ id: "p", leaseId: "l", month: "2026-02", date: "2026-02-03", amount, method: "virement", comment: "" }] : [], waivers: [] }, "2026-03-10")[1];
  it("loyer payé : quittance avec loyer et charges distingués", () => {
    expect(rentReceipt(month(682))).toEqual({ kind: "quittance", rent: 620, charges: 62, total: 682 });
  });
  it("paiement partiel : un reçu ; rien reçu : aucun document", () => {
    expect(rentReceipt(month(341))).toEqual({ kind: "recu", rent: 310, charges: 31, total: 341 });
    expect(rentReceipt(month(0))).toBeNull();
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
