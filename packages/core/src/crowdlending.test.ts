import { describe, expect, it } from "vitest";
import { crowdCountsLabel, crowdExtensionError, crowdInterestEntries, crowdProjectState, crowdSummary, type CrowdProject } from "./crowdlending";
import { crowdWithholding } from "./institutions";
import { defaultParams } from "./params";

const p = (o: Partial<CrowdProject> = {}): CrowdProject => ({ id: "p", accountId: "c", name: "Projet", amount: 1_000, rate: 0.1, startDate: "2026-01-15", termMonths: 12, repayment: "in_fine", status: "en_cours", statusDate: null, repaidCapital: null, expectedRecovery: null, inAllocation: null, comment: "", ...o });

describe("crowdlending", () => {
  it("compte les projets par situation et omet celles qui sont vides", () => {
    const asOf = "2026-06-01";
    const enCours = crowdProjectState(p(), asOf);
    const depassee = crowdProjectState(p({ startDate: "2025-01-15" }), asOf);
    const retard = crowdProjectState(p({ status: "retard" }), asOf);
    const defaut = crowdProjectState(p({ status: "defaut" }), asOf);
    const rembourse = crowdProjectState(p({ status: "rembourse" }), asOf);
    expect(crowdCountsLabel([])).toBe("0 projet investi");
    expect(crowdCountsLabel([enCours])).toBe("1 projet investi · 1 en cours");
    expect(crowdCountsLabel([enCours, enCours, rembourse, rembourse])).toBe("4 projets investis · 2 en cours · 2 remboursés");
    expect(crowdCountsLabel([enCours, depassee, depassee, retard, defaut, rembourse])).toBe("6 projets investis · 1 en cours · 2 échéances dépassées · 1 en retard · 1 en défaut · 1 remboursé");
  });

  it("in fine : tout le capital reste dû jusqu'au remboursement", () => {
    expect(crowdProjectState(p(), "2026-06-01")).toMatchObject({ repaid: 0, outstanding: 1_000, value: 1_000, nextDate: "2027-01-15", overdue: false, endDate: "2027-01-15" });
  });

  it("échéance dépassée sans remboursement : signalé, capital toujours dû", () => {
    expect(crowdProjectState(p(), "2027-03-01")).toMatchObject({ overdue: true, value: 1_000, nextDate: null });
  });

  it("remboursé : le capital est revenu, le projet ne vaut plus rien", () => {
    expect(crowdProjectState(p({ status: "rembourse" }), "2027-02-01")).toMatchObject({ repaid: 1_000, outstanding: 0, value: 0 });
  });

  it("défaut : 0 € tant qu'on ne sait pas, puis le montant espéré, jamais plus que le capital dû", () => {
    expect(crowdProjectState(p({ status: "defaut" }), "2026-06-01")).toMatchObject({ outstanding: 1_000, value: 0 });
    expect(crowdProjectState(p({ status: "defaut", expectedRecovery: 300 }), "2026-06-01").value).toBe(300);
    expect(crowdProjectState(p({ status: "defaut", expectedRecovery: 5_000 }), "2026-06-01").value).toBe(1_000);
  });

  it("le défaut ne réécrit pas le passé", () => {
    const d = p({ status: "defaut", statusDate: "2026-09-01" });
    expect(crowdProjectState(d, "2026-08-31")).toMatchObject({ status: "en_cours", value: 1_000 });
    expect(crowdProjectState(d, "2026-09-01")).toMatchObject({ status: "defaut", value: 0 });
  });

  it("mensualités : capital amorti au fil des échéances, sauf saisie de la plateforme", () => {
    const a = p({ repayment: "amortissable" });
    const early = crowdProjectState(a, "2026-03-20");
    expect(early.repaid).toBeGreaterThan(0);
    expect(early.outstanding + early.repaid).toBeCloseTo(1_000, 2);
    expect(early.nextDate).toBe("2026-04-15");
    expect(crowdProjectState({ ...a, repaidCapital: 700 }, "2026-03-20").outstanding).toBe(300);
    expect(crowdProjectState(a, "2027-03-01").outstanding).toBe(0);
  });

  it("échéance prolongée : plus d'alerte, nouvelle date, y compris sans durée renseignée", () => {
    expect(crowdProjectState(p({ extendedTo: "2027-07-15" }), "2027-03-01")).toMatchObject({ overdue: false, endDate: "2027-07-15", nextDate: "2027-07-15", value: 1_000 });
    expect(crowdProjectState(p({ extendedTo: "2027-02-15" }), "2027-03-01").overdue).toBe(true);
    expect(crowdProjectState(p({ termMonths: null, extendedTo: "2027-07-15" }), "2027-03-01")).toMatchObject({ endDate: "2027-07-15", nextDate: "2027-07-15" });
    expect(crowdProjectState(p({ repayment: "coupons", extendedTo: "2027-07-15" }), "2027-03-20").nextDate).toBe("2027-04-15");
  });

  it("une prolongation doit reculer l'échéance", () => {
    expect(crowdExtensionError(p({ extendedTo: "2027-07-15" }))).toBeNull();
    expect(crowdExtensionError(p({ extendedTo: "2027-01-31" }))).toMatch(/après l'échéance/);
    expect(crowdExtensionError(p({ extendedTo: "2027-02-28" }))).toBeNull();
    expect(crowdExtensionError(p({ termMonths: null, extendedTo: "2025-01-01" }))).toMatch(/investissement/);
  });

  it("en retard : les mensualités cessent d'être comptées comme remboursées", () => {
    const a = p({ repayment: "amortissable", status: "retard", statusDate: "2026-04-01" });
    const late = crowdProjectState(a, "2026-10-01");
    const frozen = crowdProjectState(p({ repayment: "amortissable" }), "2026-04-01");
    expect(late.repaid).toBeCloseTo(frozen.repaid, 2);
    expect(late.repaid).toBeGreaterThan(0);
  });

  it("résumé : capital en cours, à risque et taux moyen pondéré", () => {
    const s = crowdSummary([crowdProjectState(p({ amount: 1_000, rate: 0.1 }), "2026-06-01"), crowdProjectState(p({ amount: 3_000, rate: 0.06, status: "retard" }), "2026-06-01"), crowdProjectState(p({ amount: 500, status: "defaut" }), "2026-06-01")]);
    expect(s).toMatchObject({ active: 4_000, atRisk: 3_500 });
    expect(s.averageRate).toBeCloseTo(0.07);
  });

  it("impôts prélevés sur des intérêts bruts : acompte d'abord, prélèvements sociaux pour le reste du taux", () => {
    const params = defaultParams(new Date(2026, 0, 1));
    expect(crowdWithholding(100, 0.314, params)).toEqual({ incomeTax: 12.8, social: 18.6, total: 31.4 });
    // Taux sous le PFU : tout est compté en acompte, comme pour des intérêts saisis nets.
    expect(crowdWithholding(100, 0.1, params)).toEqual({ incomeTax: 10, social: 0, total: 10 });
    // Total lu sur le relevé : réparti dans les mêmes proportions.
    expect(crowdWithholding(33.33, 0.314, params, 10.47)).toEqual({ incomeTax: 4.27, social: 6.2, total: 10.47 });
    expect(crowdWithholding(50, 0, params)).toEqual({ incomeTax: 0, social: 0, total: 0 });
  });

  it("intérêts du mois : une ligne sans prélèvement, deux lignes avec, datées du dernier jour du mois", () => {
    const base = { accountId: "c", month: "2026-02", monthLabel: "février 2026", gross: 100 };
    expect(crowdInterestEntries({ ...base, withheld: null })).toEqual([{ date: "2026-02-28", type: "interets", accountId: "c", amount: 100, comment: "Intérêts de février 2026", gross: null, withheldIncomeTax: null, withheldSocial: null }]);
    expect(crowdInterestEntries({ ...base, withheld: { incomeTax: 12.8, social: 18.6 } })).toEqual([
      { date: "2026-02-28", type: "interets", accountId: "c", amount: 100, comment: "Intérêts bruts de février 2026", gross: 100, withheldIncomeTax: 12.8, withheldSocial: 18.6 },
      { date: "2026-02-28", type: "frais", accountId: "c", amount: 31.4, comment: "Impôts prélevés sur les intérêts de février 2026", gross: null, withheldIncomeTax: null, withheldSocial: null },
    ]);
    expect(crowdInterestEntries({ ...base, withheld: { incomeTax: 0, social: 0 } })).toHaveLength(1);
  });
});
