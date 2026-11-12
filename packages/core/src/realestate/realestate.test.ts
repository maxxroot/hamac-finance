import { describe, expect, it } from "vitest";
import { NO_PROPERTY_DETAILS, estimateNotaryFees, loanPayoffAt, propertyHeldValueAt, propertySale, propertySqm, propertySummary, propertyTotalCost, propertyValue, type Property, type PropertyValue } from "./realestate";
import { loanPayment, loanState, loanYears, loanHeldBalanceAt, type Loan } from "../loans";

const loan: Loan = { id: "l", kind: "immobilier", name: "Prêt", propertyId: null, share: 1, principal: 200_000, rate: 0.03, termMonths: 240, firstPayment: "2024-01-05", insuranceMode: "montant", insurance: 30, insuranceRate: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false, closedOn: null, deferredMonths: 0, deferredKind: "partiel", prepayments: [] };

describe("crédits", () => {
  it("échéance constante, taux zéro compris", () => {
    expect(loanPayment(200_000, 0.03, 240)).toBeCloseTo(1109.2, 1);
    expect(loanPayment(12_000, 0, 24)).toBe(500);
  });

  it("capital restant dû calculé selon les échéances passées", () => {
    expect(loanState(loan, "2024-01-04")).toMatchObject({ balance: 200_000, paymentsDone: 0, paymentsLeft: 240, endDate: "2043-12-05" });
    const one = loanState(loan, "2024-01-05");
    expect(one.paymentsDone).toBe(1);
    expect(one.balance).toBeCloseTo(200_000 * 1.0025 - 1109.2, 0);
    expect(loanState(loan, "2024-02-04").paymentsDone).toBe(1);
    expect(loanState(loan, "2024-02-05").paymentsDone).toBe(2);
    expect(one.monthly).toBeCloseTo(1139.2, 1);
  });

  it("une fois remboursé : plus rien dû, plus de mensualité", () => {
    const end = loanState(loan, "2050-01-01");
    expect(end).toMatchObject({ balance: 0, monthly: 0, paymentsLeft: 0, paymentsDone: 240 });
  });

  it("saisie manuelle : le relevé sert de nouveau point de départ, l'échéance saisie remplace la calculée", () => {
    const manual = { ...loan, manualBalance: 150_000, manualBalanceDate: "2026-06-10", manualPayment: 1_200 };
    const atDate = loanState(manual, "2026-06-10");
    expect(atDate).toMatchObject({ balance: 150_000, payment: 1_200, fromManualBalance: true });
    expect(loanState(manual, "2026-07-05").balance).toBeCloseTo(150_000 * 1.0025 - 1_200, 2);
    expect(loanState(manual, "2026-06-01").fromManualBalance).toBe(false);
  });

  describe("assurance", () => {
    const rate = (insuranceMode: Loan["insuranceMode"], extra: Partial<Loan> = {}): Loan => ({ ...loan, insuranceMode, insurance: 0, insuranceRate: 0.003, ...extra });

    it("montant fixe : inchangé, sur toute la durée", () => {
      expect(loanState(loan, "2024-01-04")).toMatchObject({ insurance: 30, totalInsurance: 7200 });
      expect(loanState(loan, "2024-01-04").monthly).toBeCloseTo(1109.2 + 30, 1);
    });

    it("taux sur le capital emprunté : prime constante", () => {
      // 200 000 € × 0,30 % / 12 = 50 € par mois, soit 12 000 € sur 240 mois.
      expect(loanState(rate("capital_initial"), "2024-01-04")).toMatchObject({ insurance: 50, totalInsurance: 12_000 });
      expect(loanState(rate("capital_initial"), "2034-01-05").insurance).toBe(50);
    });

    it("taux sur le capital restant dû : prime dégressive", () => {
      const start = loanState(rate("capital_restant"), "2024-01-04");
      expect(start.insurance).toBe(50);
      const later = loanState(rate("capital_restant"), "2034-01-05");
      expect(later.insurance).toBeCloseTo((later.balance * 0.003) / 12, 2);
      expect(later.insurance).toBeLessThan(30);
      // Assurance et intérêts suivent le même capital : à 0,30 % contre 3 %, l'assurance totale vaut le dixième des intérêts.
      expect(start.totalInsurance).toBeCloseTo(start.totalInterest / 10, 0);
    });

    it("un relevé sert de base au capital restant dû", () => {
      const s = loanState(rate("capital_restant", { manualBalance: 100_000, manualBalanceDate: "2030-01-20" }), "2030-01-25");
      expect(s.insurance).toBe(25);
    });

    it("plus d'assurance une fois le prêt remboursé", () => {
      expect(loanState(rate("capital_initial"), "2050-01-01")).toMatchObject({ insurance: 0, monthly: 0 });
    });
  });

  describe("coût par année", () => {
    const sum = (rows: ReturnType<typeof loanYears>, key: "capital" | "interest" | "insurance") => rows.reduce((s, y) => s + y[key], 0);

    it("répartit les échéances par année civile, sans intérêts à taux zéro", () => {
      const rows = loanYears({ ...loan, principal: 12_000, rate: 0, termMonths: 24, firstPayment: "2024-07-05", insurance: 0 });
      expect(rows).toEqual([
        { year: 2024, capital: 3000, interest: 0, insurance: 0, endBalance: 9000 },
        { year: 2025, capital: 6000, interest: 0, insurance: 0, endBalance: 3000 },
        { year: 2026, capital: 3000, interest: 0, insurance: 0, endBalance: 0 },
      ]);
    });

    it("le capital remboursé et le coût correspondent aux totaux du crédit", () => {
      const rated = { ...loan, insuranceMode: "capital_restant", insurance: 0, insuranceRate: 0.003 } as Loan;
      const rows = loanYears(rated);
      const state = loanState(rated, "2024-01-04");
      expect(rows).toHaveLength(20);
      expect(sum(rows, "capital")).toBeCloseTo(200_000, 0);
      expect(sum(rows, "interest")).toBeCloseTo(state.totalInterest, 0);
      expect(sum(rows, "insurance")).toBeCloseTo(state.totalInsurance, 0);
      expect(rows.at(-1)!.endBalance).toBeCloseTo(0, 0);
    });

    it("les intérêts baissent et le capital monte chaque année", () => {
      const rows = loanYears(loan);
      // Première échéance : 200 000 € × 3 % / 12 = 500 € d'intérêts.
      expect(rows[0]!.interest).toBeLessThan(6000);
      expect(rows[0]!.interest).toBeGreaterThan(5800);
      expect(rows.at(-1)!.interest).toBeLessThan(rows[0]!.interest);
      expect(rows.at(-1)!.capital).toBeGreaterThan(rows[0]!.capital);
    });

    it("un relevé plus bas qu'attendu compte comme du capital remboursé", () => {
      const reference = loanYears(loan).find((y) => y.year === 2026)!;
      const rows = loanYears({ ...loan, manualBalance: 100_000, manualBalanceDate: "2026-06-10" });
      expect(rows.find((y) => y.year === 2026)!.capital).toBeGreaterThan(reference.capital + 50_000);
      expect(sum(rows, "capital")).toBeCloseTo(200_000, -1);
      expect(rows.find((y) => y.year === 2027)!.interest).toBeLessThan(3000);
    });

    it("le coût total suit le relevé", () => {
      const rows = loanYears({ ...loan, manualBalance: 100_000, manualBalanceDate: "2026-06-10" });
      expect(loanState({ ...loan, manualBalance: 100_000, manualBalanceDate: "2026-06-10" }, "2026-06-10").totalInterest).toBeCloseTo(sum(rows, "interest"), 0);
    });
  });

  it("valeur d'un bien : part détenue", () => {
    expect(propertyValue({ value: 300_000, share: 0.5 }, "2026-01-01")).toBe(150_000);
  });

  it("coût par année arrêté à une date : seules les échéances passées comptent", () => {
    const [annee] = loanYears({ ...loan, firstPayment: "2026-01-05", insurance: 0, rate: 0, principal: 24_000, termMonths: 24 }, "2026-03-10");
    expect(annee).toMatchObject({ year: 2026, capital: 3_000 });
  });

  describe("différé et remboursement anticipé", () => {
    const pret: Loan = { ...loan, rate: 0.03, principal: 120_000, termMonths: 120, firstPayment: "2026-01-05", insurance: 0 };
    const zero: Loan = { ...loan, rate: 0, principal: 100_000, termMonths: 100, firstPayment: "2026-01-05", insurance: 0 };

    it("différé partiel : intérêts seuls, capital inchangé, puis amortissement sur le reste", () => {
      const d = { ...pret, deferredMonths: 12 };
      const pendant = loanState(d, "2026-06-10");
      expect(pendant).toMatchObject({ payment: 300, balance: 120_000 });
      const apres = loanState(d, "2027-01-10");
      expect(apres.payment).toBeCloseTo(loanPayment(120_000, 0.03, 108), 2);
      expect(apres.balance).toBeLessThan(120_000);
      expect(apres.endDate).toBe("2035-12-05");
      expect(loanState(d, "2036-01-01").balance).toBe(0);
    });

    it("différé total : rien à payer, intérêts ajoutés au capital", () => {
      const d = { ...pret, deferredMonths: 12, deferredKind: "total" as const };
      expect(loanState(d, "2026-06-10").payment).toBe(0);
      expect(loanState(d, "2026-12-10").balance).toBeCloseTo(120_000 * Math.pow(1.0025, 12), 2);
      const [annee] = loanYears(d);
      // Intérêts dus mais capitalisés : aucune sortie d'argent sur l'année.
      expect(annee.capital).toBeCloseTo(-annee.interest, 2);
      expect(loanState(d, "2027-01-10").payment).toBeCloseTo(loanPayment(120_000 * Math.pow(1.0025, 12), 0.03, 108), 2);
    });

    it("remboursement anticipé : durée réduite, mensualité gardée, compté dès sa date", () => {
      const d: Loan = { ...zero, prepayments: [{ id: "p", loanId: "l", date: "2026-06-10", amount: 20_000, fee: 300, mode: "duree" }] };
      expect(loanState(d, "2026-06-09").balance).toBe(94_000);
      expect(loanState(d, "2026-06-15").balance).toBe(74_000);
      const apres = loanState(d, "2026-07-10");
      expect(apres).toMatchObject({ payment: 1_000, balance: 73_000 });
      expect(apres.endDate).toBe("2032-08-05");
      expect(apres.totalInterest).toBe(300);
      const year = loanYears(d).find((y) => y.year === 2026)!;
      expect(year).toMatchObject({ capital: 32_000, interest: 300 });
    });

    it("remboursement anticipé : durée gardée, mensualité recalculée", () => {
      const d: Loan = { ...zero, prepayments: [{ id: "p", loanId: "l", date: "2026-06-10", amount: 20_000, fee: 0, mode: "mensualite" }] };
      const apres = loanState(d, "2026-07-10");
      expect(apres.payment).toBeCloseTo(74_000 / 94, 2);
      expect(apres.endDate).toBe("2034-04-05");
    });

    it("remboursement total : le crédit s'arrête", () => {
      const d: Loan = { ...zero, prepayments: [{ id: "p", loanId: "l", date: "2026-03-10", amount: 500_000, fee: 0, mode: "duree" }] };
      expect(loanState(d, "2026-04-10")).toMatchObject({ balance: 0, monthly: 0, paymentsLeft: 0 });
    });
  });

  it("part à charge : réduit capital et mensualité sans changer le crédit lui-même", () => {
    const entier = loanState({ ...loan, insurance: 30 }, "2026-06-10");
    const moitie = loanState({ ...loan, insurance: 30, share: 0.5 }, "2026-06-10");
    expect(moitie.balance).toBe(entier.balance);
    expect(moitie.monthly).toBe(entier.monthly);
    expect(entier.heldBalance).toBe(entier.balance);
    expect(moitie.heldBalance).toBeCloseTo(entier.balance / 2, 1);
    expect(moitie.heldMonthly).toBeCloseTo(entier.monthly / 2, 1);
  });

  it("part à charge : plus rien une fois le prêt remboursé", () => {
    const fini = loanState({ ...loan, share: 0.5 }, "2050-01-01");
    expect(fini.heldBalance).toBe(0);
    expect(fini.heldMonthly).toBe(0);
  });
});

describe("biens", () => {
  const bien: Property = { id: "b", kind: "locatif", ownership: "indivision", name: "Studio", value: 300_000, valueDate: null, purchasePrice: 200_000, purchaseDate: "2020-01-01", newBuild: false, ...NO_PROPERTY_DETAILS, notaryFees: 15_000, agencyFees: 5_000, initialWorks: 10_000, otherFees: 0, share: 0.5, inAllocation: null, classId: null, comment: "", archived: false };

  it("frais de notaire estimés pour 200 000 € : droits, émoluments TTC, sécurité immobilière et formalités", () => {
    // Émoluments : 1 995,25 € HT (exemple de service-public), soit 2 394,30 € TTC ; sécurité immobilière 200 € ; formalités 1 000 €.
    expect(estimateNotaryFees(200_000, false, "2026-03-01")).toBe(16_231); // droits 6,3185 % : 12 637 €
    expect(estimateNotaryFees(200_000, false, "2025-03-31")).toBe(15_208); // droits 5,80665 % : 11 613,30 €
    expect(estimateNotaryFees(200_000, false, null)).toBe(16_231);
    expect(estimateNotaryFees(200_000, true, "2026-03-01")).toBe(5_024); // droits 0,715 % : 1 430 €
  });

  it("frais de notaire : petite vente dans la première tranche, rien sans prix", () => {
    // 5 000 × 3,87 % × 1,2 = 232,20 € ; droits 315,93 € ; sécurité immobilière 5 € ; formalités 1 000 €.
    expect(estimateNotaryFees(5_000, false, "2026-03-01")).toBe(1_553);
    expect(estimateNotaryFees(0, false, "2026-03-01")).toBe(0);
  });

  it("la synthèse ajoute les améliorations au coût et réduit le gain", () => {
    expect(propertySummary(bien, [], 10_000, "2026-01-01")).toMatchObject({ heldCost: 120_000, gain: 30_000 });
  });

  it("bilan de la vente à la part détenue", () => {
    const vendu = { ...bien, saleDate: "2030-01-01", salePrice: 400_000, saleFees: 10_000 };
    expect(propertySale(vendu, 10_000, 50_000)).toEqual({ price: 200_000, fees: 5_000, cost: 120_000, gain: 75_000, loanPayoff: 50_000, net: 145_000 });
    expect(propertySale({ ...vendu, purchasePrice: null }, 0, 0)).toMatchObject({ cost: null, gain: null });
    expect(propertySale(bien, 0, 0)).toBeNull();
  });

  it("valeur dans le temps : dernière estimation connue, prix d'achat avant la première, rien hors détention", () => {
    const suivi: Property = { ...bien, value: 300_000, valueDate: "2025-01-01", share: 0.5 };
    const anciennes: PropertyValue[] = [{ id: "1", propertyId: "b", date: "2022-01-01", value: 240_000 }, { id: "2", propertyId: "x", date: "2021-01-01", value: 1 }];
    expect(propertyHeldValueAt(suivi, anciennes, "2019-12-31")).toBe(0);
    expect(propertyHeldValueAt(suivi, anciennes, "2021-06-01")).toBe(100_000);
    expect(propertyHeldValueAt(suivi, anciennes, "2023-01-01")).toBe(120_000);
    expect(propertyHeldValueAt(suivi, anciennes, "2026-01-01")).toBe(150_000);
    expect(propertyHeldValueAt({ ...suivi, saleDate: "2026-06-01" }, anciennes, "2026-06-01")).toBe(0);
    expect(propertyHeldValueAt({ ...suivi, archived: true }, [], "2026-01-01")).toBe(0);
    expect(propertyHeldValueAt({ ...bien, valueDate: null }, [], "2026-01-01")).toBe(150_000);
  });

  it("crédit dans le temps : rien avant la première échéance, part à charge, rien une fois soldé", () => {
    const pret: Loan = { ...loan, rate: 0, principal: 100_000, termMonths: 100, firstPayment: "2026-01-05", insurance: 0, share: 0.5, propertyId: "b" };
    expect(loanHeldBalanceAt(pret, "2026-01-04")).toBe(0);
    expect(loanHeldBalanceAt(pret, "2026-02-10")).toBe(49_000);
    expect(loanHeldBalanceAt({ ...pret, archived: true, closedOn: "2026-02-01" }, "2026-01-10")).toBe(49_500);
    expect(loanHeldBalanceAt({ ...pret, archived: true, closedOn: "2026-02-01" }, "2026-02-01")).toBe(0);
    expect(loanHeldBalanceAt({ ...pret, archived: true }, "2026-01-10")).toBe(0);
  });

  it("crédit à solder à la vente : seuls ceux du bien, encore actifs ou soldés ce jour-là", () => {
    const pret: Loan = { ...loan, rate: 0, principal: 100_000, termMonths: 100, firstPayment: "2026-01-05", insurance: 0, share: 0.5, propertyId: "b" };
    expect(loanPayoffAt([pret, { ...pret, id: "x", propertyId: "autre" }, { ...pret, id: "y", archived: true }, { ...pret, id: "z", archived: true, closedOn: "2026-02-10" }], "b", "2026-02-10")).toBe(98_000);
  });

  it("repères au m² : achat, valeur et loyer, rien sans surface", () => {
    expect(propertySqm({ surface: 25, purchasePrice: 100_000, value: 125_000 }, 500)).toEqual({ purchase: 4_000, value: 5_000, rent: 20 });
    expect(propertySqm({ surface: 25, purchasePrice: null, value: 125_000 }, null)).toEqual({ purchase: null, value: 5_000, rent: null });
    expect(propertySqm({ surface: null, purchasePrice: 100_000, value: 125_000 }, 500)).toBeNull();
  });

  it("coût d'achat complet : prix et tous les frais, inconnu sans prix", () => {
    expect(propertyTotalCost(bien)).toBe(230_000);
    expect(propertyTotalCost({ ...bien, purchasePrice: null })).toBeNull();
  });

  it("synthèse à la part détenue : coût, gain et valeur nette des seuls crédits rattachés", () => {
    const rattache = loanState({ ...loan, id: "r", propertyId: "b", share: 0.5 }, "2026-06-10");
    const autre = loanState({ ...loan, id: "a", propertyId: "x" }, "2026-06-10");
    const s = propertySummary(bien, [rattache, autre], 0, "2026-01-01");
    expect(s.heldValue).toBe(150_000);
    expect(s.heldCost).toBe(115_000);
    expect(s.gain).toBe(35_000);
    expect(s.loans.map((l) => l.loan.id)).toEqual(["r"]);
    expect(s.heldDebt).toBe(rattache.heldBalance);
    expect(s.heldMonthly).toBe(rattache.heldMonthly);
    expect(s.netValue).toBeCloseTo(150_000 - rattache.heldBalance, 2);
  });

  it("synthèse sans prix d'achat : ni coût ni gain, la valeur nette reste calculée", () => {
    const s = propertySummary({ ...bien, purchasePrice: null }, [], 0, "2026-01-01");
    expect(s.heldCost).toBeNull();
    expect(s.gain).toBeNull();
    expect(s.netValue).toBe(150_000);
  });
});
