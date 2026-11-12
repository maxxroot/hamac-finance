import { describe, expect, it } from "vitest";
import { addMonths, isIsoDate, monthsBetween, yearsBetween } from "./dates";

describe("dates", () => {
  it("valide les dates ISO réelles", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-02-01")).toBe(false);
  });
  it("décale les mois comme MOIS.DECALER", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-06", 2)).toBe("2027-01-06");
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
  });
  it("compte les mois et années révolus", () => {
    expect(monthsBetween("2021-05-10", "2026-05-09")).toBe(59);
    expect(yearsBetween("2021-05-10", "2026-05-09")).toBe(4);
    expect(yearsBetween("2021-05-10", "2026-05-10")).toBe(5);
  });
});
