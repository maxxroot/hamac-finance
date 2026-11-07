import { describe, expect, it } from "vitest";
import { formatEur, roundCents, sum } from "./money";

describe("roundCents", () => {
  it("neutralise les erreurs binaires", () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(-1.005)).toBe(-1.01);
  });
  it("somme au centime", () => {
    expect(sum([0.1, 0.2, 0.3])).toBe(0.6);
  });
});

describe("formatEur", () => {
  it("formate à la française", () => {
    expect(formatEur(1234.5).replace(/\s/g, " ")).toBe("1 234,50 €");
    expect(formatEur(1234.5, { compact: true }).replace(/\s/g, " ")).toBe("1 235 €");
  });
});
