import { describe, expect, it } from "vitest";
import { NO_RENT_LEDGER, rentMonths, type Lease, type RentLedger } from "./leases";
import { NO_PROPERTY_DETAILS, type Loan, type Property } from "./realestate";
import { expenseDates, incomeSigned, propertyImprovements, propertyProfitability, propertyYears, type PropertyExpense, type RentalData } from "./rental";

/** Tous les loyers pointés reçus, à l'échéance, sauf les mois « bail:AAAA-MM » de `skip`. */
const allPaid = (leases: readonly Lease[], skip: readonly string[] = [], waivers: RentLedger["waivers"] = []): RentLedger => ({
  payments: leases.flatMap((l) =>
    rentMonths(l, [], NO_RENT_LEDGER, "2030-12-31")
      .filter((m) => !skip.includes(`${l.id}:${m.month}`))
      .map((m) => ({ id: `${l.id}-${m.month}`, leaseId: l.id, month: m.month, date: m.dueDate, amount: m.due, method: "virement" as const, comment: "" })),
  ),
  waivers,
});

describe("dates d'une dépense", () => {
  it("ponctuelle : une fois, si la date est passée", () => {
    expect(expenseDates({ date: "2026-05-10", yearly: false, untilYear: null }, "2026-06-01")).toEqual(["2026-05-10"]);
    expect(expenseDates({ date: "2026-07-10", yearly: false, untilYear: null }, "2026-06-01")).toEqual([]);
  });

  it("annuelle : à la même date chaque année, jusqu'à aujourd'hui", () => {
    expect(expenseDates({ date: "2024-10-15", yearly: true, untilYear: null }, "2026-10-14")).toEqual(["2024-10-15", "2025-10-15"]);
    expect(expenseDates({ date: "2024-10-15", yearly: true, untilYear: null }, "2026-10-15")).toEqual(["2024-10-15", "2025-10-15", "2026-10-15"]);
  });

  it("annuelle : s'arrête après la dernière année indiquée", () => {
    expect(expenseDates({ date: "2024-10-15", yearly: true, untilYear: 2025 }, "2030-01-01")).toEqual(["2024-10-15", "2025-10-15"]);
  });
});

describe("résultats par année", () => {
  const property: Property = { id: "b", kind: "locatif", ownership: "indivision", name: "Studio", value: 120_000, valueDate: null, purchasePrice: 92_000, purchaseDate: "2024-06-01", newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 8_000, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 0.5, inAllocation: null, classId: null, comment: "", archived: false };
  const lease: Lease = { id: "l", propertyId: "b", lotId: "lot", kind: "vide", startDate: "2025-01-01", durationMonths: 36, rent: 500, charges: 50, deposit: 500, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: null, landlordAddress: "", dueDay: 1 };
  const expense: PropertyExpense = { id: "e", propertyId: "b", date: "2025-10-15", category: "taxe_fonciere", amount: 600, label: "", yearly: true, untilYear: null, improvement: false };
  const loan: Loan = { id: "c", kind: "immobilier", name: "Prêt", propertyId: "b", share: 0.5, principal: 50_000, rate: 0, termMonths: 100, firstPayment: "2025-02-05", insuranceMode: "montant", insurance: 10, insuranceRate: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false, closedOn: null, deferredMonths: 0, deferredKind: "partiel", prepayments: [] };
  const data: RentalData = { incomes: [], property, leases: [lease], rents: [], ledger: allPaid([lease]), expenses: [expense], loans: [loan] };

  it("année avant le premier bail : présente, sans rendement ni occupation", () => {
    expect(propertyYears(data, "2026-03-10")[0]).toMatchObject({ year: 2024, rents: 0, remaining: 0, grossYield: null, netYield: null, occupancy: null, partial: false });
  });

  it("année complète : montants à la part détenue, rendement sur le coût complet", () => {
    const y = propertyYears(data, "2026-03-10")[1];
    expect(y).toMatchObject({ year: 2025, partial: false, rents: 3_000, charges: 300, expenses: 300, interest: 0, insurance: 55, capital: 2_750, remaining: 195, occupancy: 1 });
    // 6 000 € de loyers sur 100 000 € de coût complet.
    expect(y.grossYield).toBeCloseTo(0.06, 6);
    // Loyers et charges reçus (6 600 €) moins 600 € de dépenses.
    expect(y.netYield).toBeCloseTo(0.06, 6);
  });

  it("année en cours : arrêtée au mois en cours, rendement ramené à une année entière", () => {
    const y = propertyYears(data, "2026-03-10")[2];
    expect(y).toMatchObject({ year: 2026, partial: true, rents: 750, expenses: 0, insurance: 15, capital: 750, occupancy: 1 });
    // 1 500 € sur 90 jours, ramenés à 365 jours.
    expect(y.grossYield).toBeCloseTo((1_500 / 100_000) * (365 / 90), 6);
  });

  it("vacance entre deux baux et mois remis : l'occupation baisse avec la vacance, le rendement avec les deux", () => {
    const parti: Lease = { ...lease, actualEnd: "2025-06-30" };
    const suivant: Lease = { ...lease, id: "l2", startDate: "2025-10-01" };
    const remis = [{ id: "x", leaseId: "l2", month: "2025-12", comment: "Franchise après travaux" }];
    const y = propertyYears({ ...data, leases: [parti, suivant], ledger: allPaid([parti, suivant], ["l2:2025-12"], remis) }, "2026-03-10")[1];
    // Occupé de janvier à juin (181 j), puis d'octobre à décembre (92 j), sur 365 jours : le mois remis reste occupé.
    expect(y.occupancy).toBeCloseTo((181 + 92) / 365, 6);
    expect(y.rents).toBe(2_000); // 8 mois de loyer à 500 €, à 50 %
    expect(y.grossYield).toBeCloseTo(4_000 / 100_000, 6);
  });

  it("loyer non reçu : le logement reste occupé, le loyer n'est pas perçu", () => {
    const y = propertyYears({ ...data, ledger: allPaid([lease], ["l:2025-03"]) }, "2026-03-10")[1];
    expect(y.rents).toBe(2_750);
    expect(y.occupancy).toBe(1);
  });

  it("bail qui n'a pas encore commencé : ni loyer, ni occupation, même s'il débute ce mois-ci", () => {
    const y = propertyYears({ ...data, leases: [{ ...lease, startDate: "2026-03-20" }], expenses: [], loans: [] }, "2026-03-10").at(-1)!;
    expect(y).toMatchObject({ year: 2026, rents: 0, occupancy: null, grossYield: null });
  });

  it("rentabilité : dernière année complète, cumuls depuis l'achat", () => {
    const r = propertyProfitability(propertyYears(data, "2026-03-10"))!;
    expect(r).toMatchObject({ year: 2025, partial: false, occupancy: 1, totalRents: 3_750, totalCapital: 3_500 });
    expect(r.grossYield).toBeCloseTo(0.06, 6);
    expect(r.monthlyRemaining).toBeCloseTo(195 / 12, 2);
  });

  it("rentabilité : sans année complète, la dernière année louée, ramenée à sa durée", () => {
    const r = propertyProfitability(propertyYears({ ...data, property: { ...property, purchaseDate: "2026-01-01" }, leases: [{ ...lease, startDate: "2026-01-01" }], expenses: [], loans: [] }, "2026-03-10"))!;
    expect(r).toMatchObject({ year: 2026, partial: true });
    // 3 mois à 275 € (loyer et charges, à 50 %), sur 90 jours.
    expect(r.monthlyRemaining).toBeCloseTo(825 / ((90 / 365) * 12), 2);
  });

  it("rentabilité : rien tant que le bien n'a jamais été loué", () => {
    expect(propertyProfitability(propertyYears({ ...data, leases: [] }, "2026-03-10"))).toBeNull();
  });

  it("sans prix d'achat : pas de rendement, le reste est calculé", () => {
    const y = propertyYears({ ...data, property: { ...property, purchasePrice: null } }, "2026-03-10")[1];
    expect(y.grossYield).toBeNull();
    expect(y.netYield).toBeNull();
    expect(y.rents).toBe(3_000);
  });

  it("ignore les baux, dépenses et crédits d'un autre bien ; rien sans données", () => {
    const y = propertyYears({ ...data, leases: [{ ...lease, propertyId: "x" }], expenses: [{ ...expense, propertyId: "x" }], loans: [{ ...loan, propertyId: "x" }] }, "2026-03-10");
    expect(y.every((row) => row.rents === 0 && row.expenses === 0 && row.capital === 0)).toBe(true);
    expect(propertyYears({ ...data, property: { ...property, purchaseDate: null }, leases: [], expenses: [], loans: [] }, "2026-03-10")).toEqual([]);
  });

  it("crédit arrêté à la date du jour, y compris une fois archivé", () => {
    const y = propertyYears({ ...data, loans: [{ ...loan, archived: true }] }, "2025-03-10")[1];
    expect(y).toMatchObject({ year: 2025, capital: 500 }); // échéances de février et mars, à 50 %
  });
});

describe("travaux d'amélioration et vente", () => {
  const property: Property = { id: "b", kind: "locatif", ownership: "nom_propre", name: "Studio", value: 120_000, valueDate: null, purchasePrice: 90_000, purchaseDate: "2025-01-01", newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 10_000, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
  const lease: Lease = { id: "l", propertyId: "b", lotId: "lot", kind: "vide", startDate: "2025-01-01", durationMonths: 36, rent: 500, charges: 0, deposit: 500, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: null, landlordAddress: "", dueDay: 1 };
  const travaux: PropertyExpense = { id: "t", propertyId: "b", date: "2025-06-01", category: "travaux", amount: 20_000, label: "", yearly: false, untilYear: null, improvement: true };
  const data: RentalData = { incomes: [], property, leases: [lease], rents: [], ledger: allPaid([lease]), expenses: [travaux], loans: [] };

  it("total des améliorations jusqu'à une date", () => {
    expect(propertyImprovements([travaux, { ...travaux, id: "x", improvement: false }, { ...travaux, id: "y", propertyId: "autre" }], "b", "2025-12-31")).toBe(20_000);
    expect(propertyImprovements([travaux], "b", "2025-05-31")).toBe(0);
  });

  it("une amélioration augmente le coût du rendement sans peser sur le rendement après charges, mais sort de ce qu'il reste", () => {
    const [y] = propertyYears(data, "2025-12-31");
    expect(y.grossYield).toBeCloseTo(6_000 / 120_000, 6);
    expect(y.netYield).toBeCloseTo(6_000 / 120_000, 6);
    expect(y).toMatchObject({ expenses: 20_000, remaining: -14_000 });
  });

  it("une amélioration ne compte dans le coût qu'à partir de son année", () => {
    const [y] = propertyYears({ ...data, expenses: [{ ...travaux, date: "2026-06-01" }] }, "2026-12-31");
    expect(y.grossYield).toBeCloseTo(6_000 / 100_000, 6);
  });

  it("autres recettes et dépôt gardé : dans ce qu'il reste et le rendement après charges, pas le rendement brut", () => {
    const sansTravaux = { ...data, expenses: [] };
    const [y] = propertyYears({ ...sansTravaux, leases: [{ ...lease, deposit: 500, depositReturned: 300, depositReturnedOn: "2025-09-01" }], incomes: [{ id: "i", propertyId: "b", date: "2025-03-01", category: "regularisation_recue", amount: 100, label: "" }, { id: "j", propertyId: "b", date: "2025-04-01", category: "regularisation_rendue", amount: 40, label: "" }, { id: "k", propertyId: "x", date: "2025-04-01", category: "autre", amount: 9_999, label: "" }] }, "2025-12-31");
    // 100 reçus − 40 rendus + 200 retenus sur le dépôt.
    expect(y).toMatchObject({ otherIncome: 260, remaining: 6_260 });
    expect(y.grossYield).toBeCloseTo(6_000 / 100_000, 6);
    expect(y.netYield).toBeCloseTo(6_260 / 100_000, 6);
  });

  it("le sens d'une recette vient de sa catégorie", () => {
    expect(incomeSigned({ category: "indemnite", amount: 50 })).toBe(50);
    expect(incomeSigned({ category: "regularisation_rendue", amount: 50 })).toBe(-50);
  });

  it("plus de résultats après la vente", () => {
    const years = propertyYears({ ...data, property: { ...property, saleDate: "2026-03-15", salePrice: 150_000, archived: true } }, "2027-06-01");
    expect(years.map((y) => y.year)).toEqual([2025, 2026]);
    expect(years[1].rents).toBe(1_500);
  });
});
