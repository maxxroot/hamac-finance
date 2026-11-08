import { describe, expect, it } from "vitest";
import { crowdProjectState, crowdSummary, type CrowdProject } from "./crowdlending";

const p = (o: Partial<CrowdProject> = {}): CrowdProject => ({ id: "p", accountId: "c", name: "Projet", amount: 1_000, rate: 0.1, startDate: "2026-01-15", termMonths: 12, repayment: "in_fine", status: "en_cours", statusDate: null, repaidCapital: null, expectedRecovery: null, inAllocation: null, comment: "", interestPauses: [], missedInterests: [], ...o });

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

  it("intérêts calculés : mensuels, in fine à la confirmation du remboursement", () => {
    const c = crowdProjectState(p({ repayment: "coupons" }), "2026-04-20");
    expect(c.lines).toHaveLength(12);
    expect(c.lines[0]).toMatchObject({ date: "2026-02-15", interest: 8.33, principal: 0, status: "verse" });
    expect(c.interestPaid).toBeCloseTo(24.99, 2);
    expect(crowdProjectState(p(), "2027-03-01")).toMatchObject({ interestPaid: 0 });
    expect(crowdProjectState(p({ status: "rembourse", statusDate: "2027-01-15" }), "2027-03-01").interestPaid).toBe(100);
    // Remboursé en avance : intérêts au prorata.
    expect(crowdProjectState(p({ status: "rembourse", statusDate: "2026-07-15" }), "2026-08-01").interestPaid).toBeCloseTo(50, 1);
  });

  it("échéance non versée, pause et reprise : ni intérêt ni capital comptés", () => {
    const m = crowdProjectState(p({ repayment: "coupons", missedInterests: ["2026-03-15"] }), "2026-04-20");
    expect(m.lines[1]!.status).toBe("non_verse");
    expect(m.interestPaid).toBeCloseTo(16.66, 2);
    const paused = p({ repayment: "amortissable", interestPauses: [{ from: "2026-03-01", to: null }] });
    const s = crowdProjectState(paused, "2026-06-20");
    expect(s.paused).toBe(true);
    expect(s.lines.filter((l) => l.status === "verse")).toHaveLength(1);
    expect(s.repaid).toBeCloseTo(s.lines[0]!.principal, 2);
    expect(s.nextDate).toBeNull();
    const resumed = crowdProjectState({ ...paused, interestPauses: [{ from: "2026-03-01", to: "2026-04-30" }] }, "2026-06-20");
    expect(resumed.paused).toBe(false);
    expect(resumed.lines.filter((l) => l.status === "verse")).toHaveLength(3);
  });

  it("après un défaut, plus d'échéance", () => {
    const d = crowdProjectState(p({ repayment: "coupons", status: "defaut", statusDate: "2026-04-01" }), "2026-08-01");
    expect(d.lines.map((l) => l.date)).toEqual(["2026-02-15", "2026-03-15"]);
  });

  it("résumé : capital en cours, à risque et taux moyen pondéré", () => {
    const s = crowdSummary([crowdProjectState(p({ amount: 1_000, rate: 0.1 }), "2026-06-01"), crowdProjectState(p({ amount: 3_000, rate: 0.06, status: "retard" }), "2026-06-01"), crowdProjectState(p({ amount: 500, status: "defaut" }), "2026-06-01")]);
    expect(s).toMatchObject({ active: 4_000, atRisk: 3_500 });
    expect(s.averageRate).toBeCloseTo(0.07);
  });
});
