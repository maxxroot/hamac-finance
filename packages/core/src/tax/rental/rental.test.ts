import { describe, expect, it } from "vitest";
import type { Loan } from "../../loans";
import { defaultParams, type PlanParams } from "../../model";
import { NO_PROPERTY_DETAILS, NO_RENT_LEDGER, rentMonths, type Lease, type Property, type PropertyExpense, type RentalData, type RentLedger } from "../../realestate";
import { foncierYear, lmnpYear, type Carry } from "./_foyer";
import { yearAmortization } from "./_amortization";
import { propertyTaxReference, propertyTaxTotal, rentalTaxes, rentalTaxKind } from "./index";

const allPaid = (leases: readonly Lease[]): RentLedger => ({
  payments: leases.flatMap((l) => rentMonths(l, [], NO_RENT_LEDGER, "2030-12-31").map((m) => ({ id: `${l.id}-${m.month}`, leaseId: l.id, month: m.month, date: m.dueDate, amount: m.due, method: "virement" as const, comment: "" }))),
  waivers: [],
});
const base = defaultParams();
const params = (rental: Partial<PlanParams["rental"]> = {}): PlanParams => ({ ...base, tax: { ...base.tax, tmi: 0.3 }, rental: { ...base.rental, ...rental } });

const property: Property = { id: "b", kind: "locatif", ownership: "nom_propre", name: "T2", value: 150_000, valueDate: null, purchasePrice: 130_000, purchaseDate: "2024-12-01", newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 10_000, agencyFees: 0, initialWorks: 0, otherFees: 0, share: 1, inAllocation: null, classId: null, comment: "", archived: false };
const lease: Lease = { id: "l", propertyId: "b", lotId: "lot", kind: "vide", startDate: "2025-01-01", durationMonths: 36, rent: 800, charges: 100, deposit: 800, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: null, landlordAddress: "", dueDay: 1 };
const expense = (id: string, category: PropertyExpense["category"], date: string, amount: number, extra: Partial<PropertyExpense> = {}): PropertyExpense => ({ id, propertyId: "b", date, category, amount, label: "", yearly: true, untilYear: null, improvement: false, recoverableRate: 0, ...extra });
// 2025 : taxe foncière 1 200 €, copropriété 1 800 € dont 1 200 € récupérables, assurance 120 €.
const expenses = [expense("tf", "taxe_fonciere", "2025-10-15", 1_200), expense("copro", "copropriete", "2025-01-10", 1_800, { recoverableRate: 2 / 3 }), expense("pno", "assurance", "2025-02-01", 120)];
// Taux zéro : seule l'assurance de l'emprunt (20 € par mois, 11 échéances en 2025) compte comme frais d'emprunt.
const loan: Loan = { id: "c", kind: "immobilier", name: "Prêt", propertyId: "b", share: 1, principal: 120_000, rate: 0, termMonths: 240, firstPayment: "2025-02-05", insuranceMode: "montant", insurance: 20, insuranceRate: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false, closedOn: null, deferredMonths: 0, deferredKind: "partiel", prepayments: [] };
const vide: RentalData = { incomes: [], property, leases: [lease], rents: [], ledger: allPaid([lease]), expenses, loans: [loan] };
const meubleLease = { ...lease, kind: "meuble" as const };
const meuble: RentalData = { ...vide, property: { ...property, rentalMode: "meuble" }, leases: [meubleLease], ledger: allPaid([meubleLease]) };
const today = "2026-11-13";
const year2025 = (data: RentalData, p: PlanParams) => rentalTaxes([data], p, today).years.find((y) => y.year === 2025)!;

describe("impôt sur les loyers : location vide", () => {
  it("micro-foncier : 30 % d'abattement sur les loyers hors charges, IR et 17,2 % de prélèvements sociaux", () => {
    // 9 600 € × 70 % = 6 720 € imposables, à 30 % + 17,2 %.
    expect(year2025(vide, params())).toMatchObject({ kind: "foncier", regime: "micro", receipts: 9_600, taxable: 6_720, incomeTax: 2_016, social: 1_155.84, total: 3_171.84 });
  });

  it("réel : charges déductibles, part récupérable exclue, 20 € de frais de gestion forfaitaires", () => {
    // 9 600 − 220 d'assurance d'emprunt − (3 120 − 1 200 récupérables + 20) = 7 440 €.
    expect(year2025(vide, params({ unfurnishedRegime: "reel" }))).toMatchObject({ regime: "reel", taxable: 7_440, total: 3_511.68 });
  });

  it("réel : un déficit hors intérêts baisse l'impôt sur le revenu, jusqu'à 10 700 € ; le reste est reporté", () => {
    const travaux = expense("toit", "travaux", "2025-05-01", 15_000, { yearly: false });
    // 9 600 − 220 − 16 940 = −7 560 € imputés sur le revenu global, à 30 %.
    expect(year2025({ ...vide, expenses: [...expenses, travaux] }, params({ unfurnishedRegime: "reel" }))).toMatchObject({ taxable: 0, globalDeduction: 7_560, total: -2_268, carriedDeficit: 0 });
    const gros = { ...travaux, amount: 25_000 };
    const taxes = rentalTaxes([{ ...vide, expenses: [...expenses, gros] }], params({ unfurnishedRegime: "reel" }), today);
    expect(taxes.years.find((y) => y.year === 2025)).toMatchObject({ globalDeduction: 10_700, total: -3_210, carriedDeficit: 6_860 });
    // 2026 : le déficit reporté s'impute sur le résultat de l'année.
    const y2026 = taxes.years.find((y) => y.year === 2026)!;
    expect(y2026.carriedDeficit).toBeLessThan(6_860);
  });

  it("plafond du micro-foncier dépassé : réel", () => {
    const cher = { ...lease, rent: 1_400 };
    const g = year2025({ ...vide, leases: [cher], ledger: allPaid([cher]) }, params());
    expect(g).toMatchObject({ regime: "reel", ceilingExceeded: true, receipts: 16_800 });
  });

  it("déficit dû aux intérêts : reporté sur les revenus fonciers, pas imputé sur le revenu global", () => {
    const carry: Carry = [];
    const g = foncierYear([{ propertyId: "b", receipts: 1_000, interest: 3_000, other: 500, amortization: 0 }], "reel", 2025, 0.3, 0.172, carry);
    expect(g).toMatchObject({ globalDeduction: 500, taxable: 0 });
    expect(carry).toEqual([{ year: 2025, amount: 2_000 }]);
    // Imputé l'année suivante, sur 10 ans au plus.
    expect(foncierYear([{ propertyId: "b", receipts: 5_000, interest: 0, other: 0, amortization: 0 }], "reel", 2026, 0.3, 0.172, carry).taxable).toBe(3_000);
    const old: Carry = [{ year: 2014, amount: 1_000 }];
    expect(foncierYear([{ propertyId: "b", receipts: 5_000, interest: 0, other: 0, amortization: 0 }], "reel", 2025, 0.3, 0.172, old).taxable).toBe(5_000);
  });

  it("impôt réparti entre les biens selon leur résultat", () => {
    const rows = [
      { propertyId: "a", receipts: 10_000, interest: 0, other: 2_000, amortization: 0 },
      { propertyId: "b", receipts: 2_000, interest: 0, other: 4_000, amortization: 0 },
    ];
    const g = foncierYear(rows, "reel", 2025, 0.3, 0.172, []);
    // Résultat 6 000 € : 8 000 € pour a, −2 000 € pour b.
    expect(g.byProperty.get("a")).toBeCloseTo(8_000 * 0.472, 2);
    expect(g.byProperty.get("b")).toBeCloseTo(-2_000 * 0.472, 2);
  });
});

describe("impôt sur les loyers : location meublée", () => {
  it("vide ou meublé selon le mode de location et le dernier bail", () => {
    expect(rentalTaxKind(property, [lease])).toBe("foncier");
    expect(rentalTaxKind({ ...property, rentalMode: "meuble" }, [lease])).toBe("lmnp");
    expect(rentalTaxKind({ ...property, rentalMode: "chambres" }, [{ ...lease, kind: "etudiant" }])).toBe("lmnp");
    expect(rentalTaxKind({ ...property, rentalMode: "colocation" }, [lease])).toBe("foncier");
  });

  it("micro-BIC : 50 % d'abattement sur loyers et charges, 18,6 % de prélèvements sociaux dès 2025", () => {
    expect(year2025(meuble, params())).toMatchObject({ kind: "lmnp", regime: "micro", receipts: 10_800, taxable: 5_400, total: 2_624.4 });
  });

  it("réel : amortissement par composant du bâti hors terrain, limité au résultat", () => {
    // Bâti : 140 000 € × 85 % ; 1/50 de 50 %, 1/25 de 15 %, 1/20 de 20 %, 1/12 de 15 % : 3,85 % par an.
    expect(yearAmortization(meuble.property, meuble.leases, [], 0.15, 2025, today)).toBeCloseTo(4_581.5, 2);
    // 10 800 − 3 120 de charges − 220 d'assurance d'emprunt = 7 460 € ; moins 4 581,50 € d'amortissement.
    expect(year2025(meuble, params({ furnishedRegime: "reel" }))).toMatchObject({ regime: "reel", amortizationUsed: 4_581.5, taxable: 2_878.5, total: 1_398.95 });
  });

  it("réel : l'amortissement ne crée pas de déficit, l'excédent se reporte ; frais comptables déductibles", () => {
    const state = { carry: [] as Carry, amortization: 0 };
    const g = lmnpYear([{ propertyId: "b", receipts: 5_000, interest: 0, other: 2_000, amortization: 4_500 }], "reel", 2025, 0.3, 0.186, state);
    expect(g).toMatchObject({ amortizationUsed: 3_000, taxable: 0 });
    expect(state.amortization).toBe(1_500);
    const avecComptable = year2025(meuble, params({ furnishedRegime: "reel", accountingFees: 600 }));
    expect(avecComptable.taxable).toBeCloseTo(2_278.5, 2);
  });

  it("impôt de référence d'un bien et total depuis le début", () => {
    const taxes = rentalTaxes([vide], params(), today);
    expect(propertyTaxReference(taxes, "b", today)).toEqual({ year: 2025, yearly: 3_171.84, partial: false });
    expect(propertyTaxTotal(taxes, "b")).toBeGreaterThan(3_171.84);
    expect(propertyTaxReference(taxes, "inconnu", today)).toBeNull();
  });
});
