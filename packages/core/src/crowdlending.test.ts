import { describe, expect, it } from "vitest";
import { crowdProjectState, crowdSummary, type CrowdProject } from "./crowdlending";

const p = (o: Partial<CrowdProject> = {}): CrowdProject => ({ id: "p", accountId: "c", name: "Projet", amount: 1_000, rate: 0.1, startDate: "2026-01-15", termMonths: 12, repayment: "in_fine", status: "en_cours", statusDate: null, repaidCapital: null, expectedRecovery: null, inAllocation: null, comment: "", ...o });

describe("crowdlending", () => {
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

  it("résumé : capital en cours, à risque et taux moyen pondéré", () => {
    const s = crowdSummary([crowdProjectState(p({ amount: 1_000, rate: 0.1 }), "2026-06-01"), crowdProjectState(p({ amount: 3_000, rate: 0.06, status: "retard" }), "2026-06-01"), crowdProjectState(p({ amount: 500, status: "defaut" }), "2026-06-01")]);
    expect(s).toMatchObject({ active: 4_000, atRisk: 3_500 });
    expect(s.averageRate).toBeCloseTo(0.07);
  });
});
