import { describe, expect, it } from "vitest";
import { guessType, parseAmount, parseCsv, parseDate } from "./csv";

describe("CSV", () => {
  it("détecte le point-virgule et gère les guillemets", () => {
    const rows = parseCsv('﻿Date;Libellé;Montant\r\n07/11/2026;"Achat ETF ""S&P 500""";-904,50\r\n\r\n08/11/2026;Coupon OAT;68,60\r\n');
    expect(rows).toEqual([
      ["Date", "Libellé", "Montant"],
      ["07/11/2026", 'Achat ETF "S&P 500"', "-904,50"],
      ["08/11/2026", "Coupon OAT", "68,60"],
    ]);
  });
  it("détecte la virgule", () => {
    expect(parseCsv("date,amount\n2026-11-07,12.5")[1]).toEqual(["2026-11-07", "12.5"]);
  });
  it("lit les montants à la française et à l'anglaise", () => {
    expect(parseAmount("1 234,56 €")).toBe(1234.56);
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("-1,234.56")).toBe(-1234.56);
    expect(parseAmount("(12,50)")).toBe(-12.5);
    expect(parseAmount("")).toBeNull();
  });
  it("lit les dates", () => {
    expect(parseDate("07/11/2026")).toBe("2026-11-07");
    expect(parseDate("7-1-26")).toBe("2026-01-07");
    expect(parseDate("2026-11-07T10:00")).toBe("2026-11-07");
    expect(parseDate("31/02/2026")).toBeNull();
  });
  it("devine le type d'opération", () => {
    expect(guessType("ACHAT 19 AMUNDI PEA S&P", -827)).toBe("achat");
    expect(guessType("Coupon OAT", 68)).toBe("interets");
    expect(guessType("Virement reçu", 100)).toBe("versement");
    expect(guessType("Prélèvement", -50)).toBe("retrait");
  });
});
