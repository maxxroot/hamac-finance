import { describe, expect, it } from "vitest";
import { expenseDates } from "./rental";

describe("dates d'une dépense", () => {
  it("ponctuelle : une fois, si la date est passée", () => {
    expect(expenseDates({ date: "2026-05-10", yearly: false, untilYear: null }, "2026-06-01")).toEqual(["2026-05-10"]);
    expect(expenseDates({ date: "2026-07-10", yearly: false, untilYear: null }, "2026-06-01")).toEqual([]);
  });

  it("annuelle : à la même date chaque année, jusqu'à aujourd'hui", () => {
    expect(expenseDates({ date: "2024-10-15", yearly: true, untilYear: null }, "2026-10-14")).toEqual(["2024-10-15", "2025-10-15"]);
    expect(expenseDates({ date: "2024-10-15", yearly: true, untilYear: null }, "2026-10-15")).toEqual(["2024-10-15", "2025-10-15", "2026-10-15"]);
  });

  it("annuelle : s'arrête après la dernière année indiquée", () => {
    expect(expenseDates({ date: "2024-10-15", yearly: true, untilYear: 2025 }, "2030-01-01")).toEqual(["2024-10-15", "2025-10-15"]);
  });
});
