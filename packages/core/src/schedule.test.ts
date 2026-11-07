import { describe, expect, it } from "vitest";
import { Schedule, addMonth, monthsBetweenInclusive } from "./schedule";

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
});
