import { describe, expect, it } from "vitest";
import type { Loan } from "../../loans";
import { defaultParams, type PlanParams } from "../../model";
import { NO_PROPERTY_DETAILS, NO_RENT_LEDGER, propertyBalance, propertyCashflow, rentMonths, type Lease, type Property, type PropertyExpense, type RentalData, type RentLedger } from "../../realestate";
import { propertyTaxCarry, rentalTaxes } from "../../tax";
import { defaultHorizon, internalRate, projectionYears, rentalSale } from "./index";

const allPaid = (leases: readonly Lease[]): RentLedger => ({
  payments: leases.flatMap((l) => rentMonths(l, [], NO_RENT_LEDGER, "2030-12-31").map((m) => ({ id: `${l.id}-${m.month}`, leaseId: l.id, month: m.month, date: m.dueDate, amount: m.due, method: "virement" as const, comment: "" }))),
  waivers: [],
});
const base = defaultParams();
const params: PlanParams = { ...base, tax: { ...base.tax, tmi: 0.3 } };
const property: Property = { id: "b", kind: "locatif", ownership: "nom_propre", name: "T2", value: 150_000, valueDate: null, purchasePrice: 130_000, purchaseDate: "2024-12-01", newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 10_000, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
const lease: Lease = { id: "l", propertyId: "b", lotId: "lot", kind: "vide", startDate: "2025-01-01", durationMonths: 36, rent: 800, charges: 100, deposit: 800, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: null, landlordAddress: "", dueDay: 1 };
const expense = (id: string, category: PropertyExpense["category"], date: string, amount: number, extra: Partial<PropertyExpense> = {}): PropertyExpense => ({ id, propertyId: "b", date, category, amount, label: "", yearly: true, untilYear: null, improvement: false, recoverableRate: 0, ...extra });
const expenses = [expense("tf", "taxe_fonciere", "2025-10-15", 1_200), expense("copro", "copropriete", "2025-01-10", 1_800, { recoverableRate: 2 / 3 }), expense("pno", "assurance", "2025-02-01", 120)];
const loan: Loan = { id: "c", kind: "immobilier", name: "Prêt", propertyId: "b", share: 1, principal: 120_000, rate: 0.03, termMonths: 240, firstPayment: "2025-02-05", insuranceMode: "montant", insurance: 20, insuranceRate: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false, closedOn: null, deferredMonths: 0, deferredKind: "partiel", prepayments: [] };
const data: RentalData = { incomes: [], property, leases: [lease], rents: [], ledger: allPaid([lease]), expenses, loans: [loan] };
const today = "2026-11-13";
const taxes = rentalTaxes([data], params, today);
const cashflow = propertyCashflow(data, params.rental, today);
const ctx = { data, cashflow, params, kind: "foncier" as const, regime: "micro" as const, carry: propertyTaxCarry(taxes, "b", "foncier"), heldValue: 150_000, accountingFees: 0, today };

describe("projection d'un bien en location", () => {
  it("horizon : fin du crédit, au moins dix ans, au plus trente", () => {
    expect(defaultHorizon(data, today)).toBe(2045);
    expect(defaultHorizon({ ...data, loans: [] }, today)).toBe(2036);
  });

  it("loyers et charges augmentés chaque année, vrai échéancier du crédit, valeur nette", () => {
    const years = projectionYears(ctx, 2046);
    const [first] = years;
    expect(first.year).toBe(2027);
    // Loyer moins 4 % de vacance, augmenté de 1,5 %.
    expect(first.rents).toBeCloseTo(768 * 12 * 1.015, 6);
    expect(first.loans).toBeLessThan(0);
    expect(first.debt).toBeLessThan(120_000);
    expect(first.value).toBeCloseTo(150_000 * 1.01, 6);
    expect(first.netValue).toBeCloseTo(first.value - first.debt, 6);
    // Micro-foncier : 70 % des loyers à 30 % + 17,2 %.
    expect(first.tax).toBeCloseTo(-first.rents * 0.7 * 0.472, 6);
    expect(first.cashflow).toBeCloseTo(first.rents + first.charges + first.loans + first.tax, 6);
    // Crédit remboursé début 2045 : plus d'échéance ensuite.
    const last = years.at(-1)!;
    expect(last).toMatchObject({ year: 2046, loans: -0, debt: 0 });
    expect(last.cashflow).toBeGreaterThan(first.cashflow);
  });

  it("taux de rendement interne", () => {
    expect(internalRate(new Map([[2020, -100], [2021, 110]]))).toBeCloseTo(0.1, 6);
    expect(internalRate(new Map([[2020, -100], [2022, 121]]))).toBeCloseTo(0.1, 6);
    expect(internalRate(new Map([[2020, 100], [2021, 110]]))).toBeNull();
  });

  it("revente : plus-value, crédit remboursé, gain total et rendement de l'opération", () => {
    const years = projectionYears(ctx, 2045);
    const contribution = propertyBalance(data, 150_000 - 110_000, today)!.contribution;
    const sale = rentalSale({ data, kind: "foncier", pastTaxes: taxes.properties.get("b")!, contribution, today }, years, 2036)!;
    const y2036 = years.find((y) => y.year === 2036)!;
    expect(sale.price).toBeCloseTo(y2036.value, 2);
    expect(sale.gain.years).toBe(12);
    expect(sale.net).toBeCloseTo(y2036.value - sale.gain.total - y2036.debt, 2);
    expect(sale.irr).not.toBeNull();
    expect(sale.totalGain).not.toBeNull();
    // Sans prix d'achat, pas de revente simulée.
    expect(rentalSale({ data: { ...data, property: { ...property, purchasePrice: null } }, kind: "foncier", pastTaxes: [], contribution: null, today }, years, 2036)).toBeNull();
  });
});
