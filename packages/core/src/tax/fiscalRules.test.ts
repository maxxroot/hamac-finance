import { describe, expect, it } from "vitest";
import { fiscalRulesFor, LAST_VERIFIED_INCOME_YEAR, socialRateFor } from "./fiscalRules";
import { defaultParams } from "../model";

describe("règles fiscales par année", () => {
  it("revenus 2025 : déclaration 2026, cases vérifiées et datées", () => {
    const r = fiscalRulesFor(2025);
    expect(r.covered).toBe(true);
    expect(r.declarationYear).toBe(2026);
    expect(r.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.source).toContain("Brochure pratique IR 2026");
    expect(r.boxes.dividendes.box).toBe("2DC");
    expect(r.boxes.plusValue.box).toBe("3VG");
    expect(r.boxes.cryptoPlusValue.box).toBe("3AN");
  });

  it("année sans table : cases indicatives, jamais présentées comme vérifiées", () => {
    const r = fiscalRulesFor(LAST_VERIFIED_INCOME_YEAR + 1);
    expect(r.covered).toBe(false);
    expect(r.verifiedOn).toBeNull();
    expect(r.source).toBeNull();
    expect(r.incomeYear).toBe(LAST_VERIFIED_INCOME_YEAR + 1);
    expect(r.declarationYear).toBe(LAST_VERIFIED_INCOME_YEAR + 2);
  });

  // Hausse de la CSG (LFSS 2026, art. 12) : revenus du patrimoine dès 2025, produits de placement au 1.1.2026.
  it("prélèvements sociaux : la hausse ne touche pas les deux natures la même année", () => {
    const p = defaultParams();
    expect(socialRateFor(2024, "patrimoine", p)).toBeCloseTo(0.172, 5);
    expect(socialRateFor(2025, "patrimoine", p)).toBeCloseTo(0.186, 5);
    expect(socialRateFor(2025, "placement", p)).toBeCloseTo(0.172, 5);
    expect(socialRateFor(2026, "placement", p)).toBeCloseTo(0.186, 5);
  });
});
