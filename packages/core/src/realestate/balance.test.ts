import { describe, expect, it } from "vitest";
import type { Loan } from "../loans";
import { propertyBalance } from "./balance";
import type { PropertyExpense } from "./expenses";
import { NO_RENT_LEDGER, rentMonths, type Lease, type RentLedger } from "./leases";
import { NO_PROPERTY_DETAILS, type Property } from "./realestate";
import type { RentalData } from "./rental";

const allPaid = (leases: readonly Lease[]): RentLedger => ({
  payments: leases.flatMap((l) => rentMonths(l, [], NO_RENT_LEDGER, "2030-12-31").map((m) => ({ id: `${l.id}-${m.month}`, leaseId: l.id, month: m.month, date: m.dueDate, amount: m.due, method: "virement" as const, comment: "" }))),
  waivers: [],
});

const property: Property = { id: "b", kind: "locatif", ownership: "nom_propre", name: "T2", value: 150_000, valueDate: null, purchasePrice: 130_000, purchaseDate: "2024-12-01", newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 10_000, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
const lease: Lease = { id: "l", propertyId: "b", lotId: "lot", kind: "vide", startDate: "2025-01-01", durationMonths: 36, rent: 800, charges: 100, deposit: 800, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: null, landlordAddress: "", dueDay: 1 };
const expense = (id: string, category: PropertyExpense["category"], date: string, amount: number, extra: Partial<PropertyExpense> = {}): PropertyExpense => ({ id, propertyId: "b", date, category, amount, label: "", yearly: true, untilYear: null, improvement: false, recoverableRate: 0, ...extra });
const expenses = [expense("tf", "taxe_fonciere", "2025-10-15", 1_200), expense("copro", "copropriete", "2025-01-10", 1_800, { recoverableRate: 2 / 3 }), expense("pno", "assurance", "2025-02-01", 120), expense("chaudiere", "travaux", "2026-03-01", 600, { yearly: false })];
const loan: Loan = { id: "c", kind: "immobilier", name: "Prêt", propertyId: "b", share: 1, principal: 120_000, rate: 0, termMonths: 240, firstPayment: "2025-02-05", insuranceMode: "montant", insurance: 20, insuranceRate: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false, closedOn: null, deferredMonths: 0, deferredKind: "partiel", prepayments: [] };
const data: RentalData = { incomes: [], property, leases: [lease], rents: [], ledger: allPaid([lease]), expenses, loans: [loan] };
const today = "2026-11-13";
// Valeur 150 000 € moins 109 000 € restant dus après 22 échéances de 500 €.
const netValue = 41_000;

describe("bilan d'un bien depuis l'achat", () => {
  it("sorti de la poche, rentré, effort net et enrichissement", () => {
    const b = propertyBalance(data, netValue, today)!;
    // Coût complet 140 000 € moins 120 000 € empruntés.
    expect(b).toMatchObject({ since: "2024-12-01", months: 24, contribution: 20_000, borrowed: 120_000 });
    // 22 échéances de 520 € ; taxe foncière, copropriété et assurance deux fois, et la chaudière.
    expect(b).toMatchObject({ loanPayments: 11_440, expenses: 6_840, out: 38_280 });
    // 23 mois de 900 € reçus, novembre compris.
    expect(b).toMatchObject({ rents: 20_700, in: 20_700, netEffort: 17_580, monthlyEffort: 732.5, enrichment: 23_420 });
  });

  it("amélioration : dans l'apport, pas dans les dépenses ; impôts dans ce qui sort", () => {
    const cuisine = expense("cuisine", "travaux", "2025-06-01", 5_000, { yearly: false, improvement: true });
    const b = propertyBalance({ ...data, expenses: [...expenses, cuisine] }, netValue, today, 900)!;
    expect(b).toMatchObject({ contribution: 25_000, expenses: 6_840, taxes: 900, out: 44_180 });
  });

  it("part détenue, remboursement anticipé et indemnité, prix d'achat inconnu", () => {
    const half = propertyBalance({ ...data, property: { ...property, share: 0.5 }, loans: [{ ...loan, share: 0.5 }] }, netValue / 2, today)!;
    expect(half).toMatchObject({ contribution: 10_000, loanPayments: 5_720, rents: 10_350 });
    const early = propertyBalance({ ...data, loans: [{ ...loan, prepayments: [{ id: "p", loanId: "c", date: "2026-01-20", amount: 10_000, fee: 300, mode: "duree" }] }] }, netValue, today)!;
    expect(early.loanPayments).toBe(11_440 + 10_300);
    expect(propertyBalance({ ...data, property: { ...property, purchasePrice: null } }, netValue, today)).toMatchObject({ contribution: null, out: null, enrichment: null, in: 20_700 });
  });
});
