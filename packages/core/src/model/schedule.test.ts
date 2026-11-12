import { describe, expect, it } from "vitest";
import { Schedule, addMonth, dayOfMonth, isScheduled, monthsBetweenInclusive } from "./schedule";

const plan = (accountId: string, fromMonth: string, amount: number) => ({ id: `${accountId}${fromMonth}`, accountId, fromMonth, amount, comment: "" });

describe("Schedule", () => {
  it("arithmétique des mois", () => {
    expect(addMonth("2026-12", 1)).toBe("2027-01");
    expect(addMonth("2026-01", -1)).toBe("2025-12");
    expect(monthsBetweenInclusive("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("le dernier plan démarré s'applique, 0 arrête", () => {
    const s = new Schedule([plan("pea", "2026-11", 100), plan("pea", "2027-03", 150), plan("pea", "2028-01", 0)], [], "2026-11");
    expect(s.amount("pea", "2026-11")).toBe(100);
    expect(s.amount("pea", "2027-02")).toBe(100);
    expect(s.amount("pea", "2027-03")).toBe(150);
    expect(s.amount("pea", "2028-06")).toBe(0);
  });

  it("corrige le bug du sheet : un plan de novembre compte dès novembre", () => {
    const s = new Schedule([plan("lep", "2026-11", 100)], [], "2026-11");
    expect(s.current("lep", "2026-11-07")).toBe(100);
    expect(s.paidTotal("lep", "2026-11-07")).toBe(100);
    expect(s.paidTotal("lep", "2027-01-15")).toBe(300);
  });

  it("déduit les mois manqués sans passer sous zéro", () => {
    const s = new Schedule([plan("lep", "2026-11", 100)], [{ id: "x", accountId: "lep", month: "2026-12", amount: 150, comment: "" }], "2026-11");
    expect(s.amount("lep", "2026-12")).toBe(0);
    expect(s.paidTotal("lep", "2027-01-01")).toBe(200);
  });

  it("ne compte rien avant le premier mois du calendrier", () => {
    const s = new Schedule([plan("lep", "2026-01", 100)], [], "2026-11");
    expect(s.amount("lep", "2026-10")).toBe(0);
    expect(s.paidTotal("lep", "2026-10-31")).toBe(0);
    expect(s.inYear("lep", 2026)).toBe(200);
  });

  it("jour du prélèvement : ramené au dernier jour des mois courts", () => {
    expect(dayOfMonth("2026-04", 31)).toBe("2026-04-30");
    expect(dayOfMonth("2027-02", 30)).toBe("2027-02-28");
    expect(dayOfMonth("2028-02", 30)).toBe("2028-02-29");
    expect(dayOfMonth("2026-11", 5)).toBe("2026-11-05");
  });

  it("le versement du mois ne compte qu'une fois son jour passé", () => {
    const s = new Schedule([plan("lep", "2026-11", 100)], [], "2026-11", 10);
    expect(s.paidTotal("lep", "2026-11-09")).toBe(0);
    expect(s.paidTotal("lep", "2026-11-10")).toBe(100);
    expect(s.paidTotal("lep", "2026-12-09")).toBe(100);
    expect(s.paidFlows("lep", "2026-12-31")).toEqual([
      { date: "2026-11-10", amount: 100 },
      { date: "2026-12-10", amount: 100 },
    ]);
  });

  it("par défaut le 1er : le mois en cours compte dès son premier jour", () => {
    const s = new Schedule([plan("lep", "2026-11", 100)], [], "2026-11");
    expect(s.paidTotal("lep", "2026-11-01")).toBe(100);
  });

  it("opérations du journal : montant réellement versé, mois manqué en entier absent", () => {
    const skips = [
      { id: "a", accountId: "pea", month: "2026-12", amount: 40, comment: "" },
      { id: "b", accountId: "pea", month: "2027-01", amount: 100, comment: "" },
    ];
    const s = new Schedule([plan("pea", "2026-11", 100)], skips, "2026-11", 31);
    const txs = s.paidTransactions("2027-02-27");
    expect(txs.map((t) => [t.date, t.amount])).toEqual([
      ["2026-11-30", 100],
      ["2026-12-31", 60],
    ]);
    expect(txs[1].comment).toContain("40 € manqués");
    expect(txs.every(isScheduled)).toBe(true);
    expect(txs[0].type).toBe("versement");
  });
});
