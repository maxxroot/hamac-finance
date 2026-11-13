import { describe, expect, it } from "vitest";
import { defaultParams } from "../../model";
import type { Loan } from "../../loans";
import type { PropertyExpense } from "../expenses";
import { NO_RENT_LEDGER, rentMonths, type Lease, type RentLedger } from "../leases";
import type { Lot } from "../lots";
import { NO_PROPERTY_DETAILS, type Property } from "../realestate";
import type { RentalData } from "../rental";
import { cashflowTone, propertyCashflow } from "./index";

const allPaid = (leases: readonly Lease[]): RentLedger => ({
  payments: leases.flatMap((l) => rentMonths(l, [], NO_RENT_LEDGER, "2030-12-31").map((m) => ({ id: `${l.id}-${m.month}`, leaseId: l.id, month: m.month, date: m.dueDate, amount: m.due, method: "virement" as const, comment: "" }))),
  waivers: [],
});

const rental = defaultParams().rental;
const property: Property = { id: "b", kind: "locatif", ownership: "nom_propre", name: "T2", value: 150_000, valueDate: null, purchasePrice: 130_000, purchaseDate: "2024-12-01", newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 10_000, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
const lot: Lot = { id: "lot", propertyId: "b", name: "Logement", kind: "logement", surface: null, targetRent: null, comment: "", archived: false, sortOrder: 0 };
const lease: Lease = { id: "l", propertyId: "b", lotId: "lot", kind: "vide", startDate: "2025-01-01", durationMonths: 36, rent: 800, charges: 100, deposit: 800, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: null, landlordAddress: "", dueDay: 1 };
const expense = (id: string, category: PropertyExpense["category"], date: string, amount: number, extra: Partial<PropertyExpense> = {}): PropertyExpense => ({ id, propertyId: "b", date, category, amount, label: "", yearly: true, untilYear: null, improvement: false, recoverableRate: 0, ...extra });
const expenses = [
  // Taxe foncière de 1 200 €, dont 180 € d'ordures ménagères.
  expense("tf", "taxe_fonciere", "2025-10-15", 1_200, { recoverableRate: 0.15 }),
  expense("copro", "copropriete", "2025-01-10", 1_800, { recoverableRate: 2 / 3 }),
  expense("pno", "assurance", "2025-02-01", 120),
  expense("chaudiere", "travaux", "2026-03-01", 600, { yearly: false }),
];
// 500 € de capital par mois à taux zéro, plus 20 € d'assurance.
const loan: Loan = { id: "c", kind: "immobilier", name: "Prêt", propertyId: "b", share: 1, principal: 120_000, rate: 0, termMonths: 240, firstPayment: "2025-02-05", insuranceMode: "montant", insurance: 20, insuranceRate: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false, closedOn: null, deferredMonths: 0, deferredKind: "partiel", prepayments: [] };
const data: RentalData = { incomes: [], property, leases: [lease], rents: [], ledger: allPaid([lease]), expenses, loans: [loan], lots: [lot] };
const today = "2026-11-13";

describe("cashflow d'un bien en location", () => {
  it("réel : moyenne des 12 derniers mois complets, poste par poste", () => {
    const c = propertyCashflow(data, rental, today);
    expect(c.real).toMatchObject({ from: "2025-11", to: "2026-10", months: 12 });
    expect(c.real!.monthly).toMatchObject({ rents: 800, recovered: 100, taxe_fonciere: -100, copropriete: -150, assurance: -10, travaux: -50, loans: -520 });
    // 800 + 100 − 100 − 150 − 10 − 50 − 520.
    expect(c.real).toMatchObject({ total: 70, tone: "positif" });
  });

  it("prévu : loyer en cours, provisions des réglages, charges récupérables régularisées", () => {
    const c = propertyCashflow(data, rental, today);
    // Vacance 4 % et travaux 5 % de 800 € ; récupérable : 15 € de TEOM et 100 € de copropriété par mois.
    expect(c.planned.monthly).toMatchObject({ rents: 800, vacancy: -32, recovered: 115, taxe_fonciere: -100, copropriete: -150, assurance: -10, travaux: -40, loans: -520 });
    expect(c.planned).toMatchObject({ total: 63, tone: "positif", rent: 800, chargeProvisions: 100, recoverable: 115, propertyTaxEstimated: false });
    expect(c.neutralBand).toBe(16);
    // Pas de vacance du côté réel : elle est déjà dans les loyers reçus.
    expect(c.lines.find((l) => l.key === "vacancy")).toEqual({ key: "vacancy", real: null, planned: -32 });
  });

  it("taxe foncière pas encore saisie : estimée à 1,3 mois de loyer hors charges", () => {
    const c = propertyCashflow({ ...data, expenses: expenses.filter((e) => e.id !== "tf") }, rental, today);
    expect(c.planned.monthly.taxe_fonciere).toBeCloseTo(-86.67, 2);
    expect(c.planned.propertyTaxEstimated).toBe(true);
  });

  it("provisions propres au bien : montant par an ou pourcentage", () => {
    const own = { ...property, vacancyProvision: { kind: "montant" as const, value: 600 }, worksProvision: { kind: "taux" as const, value: 0.1 } };
    expect(propertyCashflow({ ...data, property: own }, rental, today).planned.monthly).toMatchObject({ vacancy: -50, travaux: -80 });
  });

  it("dépense ponctuelle : comptée dans le prévu si elle a eu lieu dans les 12 derniers mois", () => {
    const gestion = expense("agence", "gestion", "2026-06-01", 480, { yearly: false });
    expect(propertyCashflow({ ...data, expenses: [...expenses, gestion] }, rental, today).planned.monthly.gestion).toBe(-40);
    expect(propertyCashflow({ ...data, expenses: [...expenses, { ...gestion, date: "2025-06-01" }] }, rental, today).planned.monthly.gestion).toBe(0);
  });

  it("part détenue et part du crédit à charge", () => {
    const c = propertyCashflow({ ...data, property: { ...property, share: 0.5 }, loans: [{ ...loan, share: 0.5 }] }, rental, today);
    expect(c.real!.total).toBe(35);
    expect(c.planned.total).toBe(31.5);
    expect(c.neutralBand).toBe(8);
  });

  it("location commencée il y a peu : le réel part du premier mois loué", () => {
    const recent = { ...lease, startDate: "2026-08-01" };
    const c = propertyCashflow({ ...data, leases: [recent], ledger: allPaid([recent]), expenses: [], loans: [] }, rental, today);
    expect(c.real).toMatchObject({ from: "2026-08", to: "2026-10", months: 3, total: 900 });
  });

  it("lot vide : loyer espéré ; jamais loué, pas de réel", () => {
    const c = propertyCashflow({ ...data, leases: [], ledger: allPaid([]), lots: [{ ...lot, targetRent: 700 }] }, rental, today);
    expect(c.real).toBeNull();
    expect(c.planned).toMatchObject({ rent: 700, chargeProvisions: 0 });
  });

  it("neutre tant que l'écart à zéro ne dépasse pas la marge", () => {
    expect(cashflowTone(16, 16)).toBe("neutre");
    expect(cashflowTone(-16, 16)).toBe("neutre");
    expect(cashflowTone(16.01, 16)).toBe("positif");
    expect(cashflowTone(-16.01, 16)).toBe("negatif");
  });
});
