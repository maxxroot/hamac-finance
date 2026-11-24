import { describe, expect, it } from "vitest";
import { FxBook } from "@hamac/core";
import { ecbRateOn, fxDraftOf, NO_FX, rateInUse, rateToStore } from "./fxEntry";

const book = new FxBook([{ currency: "USD", date: "2026-11-20", rate: 1.08 }]);

describe("saisie d'une opération en devise", () => {
  it("pré-remplit le taux BCE du jour, ou celui de la veille ouvrée", () => {
    expect(ecbRateOn(book, "USD", "2026-11-22")).toEqual({ rate: 1.08, date: "2026-11-20" });
    expect(rateInUse(NO_FX, ecbRateOn(book, "USD", "2026-11-22"))).toBe(1.08);
    expect(rateInUse(NO_FX, null)).toBeNull();
  });

  it("un taux saisi l'emporte sur la BCE et s'enregistre ; sinon rien n'est enregistré", () => {
    const manual = { ...NO_FX, fxRate: 1.07, fxManual: true };
    expect(rateInUse(manual, { rate: 1.08, date: "2026-11-20" })).toBe(1.07);
    expect(rateToStore(manual, 1000, 1.07)).toBe(1.07);
    expect(rateToStore(NO_FX, 1000, 1.08)).toBeNull();
  });

  it("total tapé en devise : le taux effectif retrouve le montant de l'avis au centime", () => {
    const typed = { ...NO_FX, amountFx: 9845.2, fxBasis: "fx" as const };
    const eur = 9089.0; // 9 845,20 / 1,0832, arrondi au centime
    const stored = rateToStore(typed, eur, 1.0832)!;
    expect(Math.round(eur * stored * 100) / 100).toBe(9845.2);
  });

  it("une opération enregistrée avec un taux le garde comme saisie", () => {
    expect(fxDraftOf(1.1)).toMatchObject({ fxRate: 1.1, fxManual: true });
    expect(fxDraftOf(null)).toMatchObject({ fxRate: null, fxManual: false });
  });
});
