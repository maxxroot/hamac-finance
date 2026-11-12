import { describe, expect, it } from "vitest";
import { yieldToMaturity } from "../investments";
import { defaultParams } from "../model";
import { reinvestToHorizon, type SimTax } from "./simulation";
import { bestRegime, bondResalePrice, simulateBond, simulateEquity, simulateEuroFund, simulateLending, simulateSavings } from "./simulators";

const params = defaultParams(new Date(2026, 10, 11));
const pfu: SimTax = { regime: "pfu", tmi: 0.11, couple: false, params };
const bareme: SimTax = { ...pfu, regime: "bareme" };
// Taux des revenus de 2027 et après : ceux des paramètres (prélèvements sociaux 18,6 %).
const PS = params.tax.socialGeneral;

describe("obligation achetée sous le pair, gardée jusqu'à l'échéance", () => {
  // 9 000 € investis à 90 % : 10 000 € de nominal, coupon annuel de 3 %, achat le jour d'un coupon (aucun coupon couru).
  const input = { pricePct: 90, couponPct: 3, frequency: 1, maturityDate: "2031-06-30", buyDate: "2026-06-30", feePct: 0, feeFixed: 0, holdYears: 0, salePricePct: 0 };

  it("coupons et prime de remboursement imposés comme des intérêts, au prélèvement forfaitaire", () => {
    const r = simulateBond(input, 9_000, pfu);
    const coupons = r.lines.filter((l) => l.label === "Coupon");
    expect(coupons).toHaveLength(5);
    expect(coupons[0]!.gross).toBeCloseTo(300, 2);
    expect(coupons[0]!.incomeTax).toBeCloseTo(300 * 0.128, 2);
    expect(coupons[0]!.social).toBeCloseTo(300 * PS, 2);
    // À l'échéance : le dernier coupon, puis le remboursement ; la prime de 1 000 € est imposée au remboursement.
    const redemption = r.lines.find((l) => l.label === "Remboursement au pair")!;
    expect(redemption.gross).toBeCloseTo(10_000, 2);
    expect(redemption.taxable).toBeCloseTo(1_000, 2);
    expect(redemption.incomeTax).toBeCloseTo(128, 2);
    expect(r.grossGain).toBeCloseTo(2_500, 2);
    expect(r.netGain).toBeCloseTo(2_500 - 2_500 * (0.128 + PS), 2);
    // Rendement brut : le rendement actuariel de l'obligation.
    expect(r.grossRate!).toBeCloseTo(yieldToMaturity({ couponRate: 0.03, maturityDate: "2031-06-30", frequency: 1 }, "2026-06-30", 0.9)!, 5);
    expect(r.netRate!).toBeLessThan(r.grossRate!);
  });

  it("au barème : tranche marginale, CSG déductible, pas d'abattement sur les intérêts", () => {
    const r = simulateBond(input, 9_000, bareme);
    const coupon = r.lines.find((l) => l.label === "Coupon")!;
    expect(coupon.incomeTax).toBeCloseTo(300 * (1 - 0.068) * 0.11, 2);
    const best = bestRegime((t) => simulateBond(input, 9_000, t), { tmi: 0.11, couple: false, params });
    expect(best.bestRegime).toBe("bareme");
    const high = bestRegime((t) => simulateBond(input, 9_000, t), { tmi: 0.3, couple: false, params });
    expect(high.bestRegime).toBe("pfu");
  });

  it("achetée au-dessus du pair : pas de prime, la perte n'est pas déductible", () => {
    const r = simulateBond({ ...input, pricePct: 105 }, 10_500, pfu);
    const redemption = r.lines.find((l) => l.label === "Remboursement au pair")!;
    expect(redemption.incomeTax).toBe(0);
    expect(redemption.note).toContain("non déductible");
  });

  it("frais d'achat fixes : déduits avant d'acheter le nominal", () => {
    const r = simulateBond({ ...input, feeFixed: 9 }, 9_009, pfu);
    expect(r.lines.find((l) => l.label === "Remboursement au pair")!.gross).toBeCloseTo(10_000, 2);
    expect(r.lines[0]!.note).toContain("9,00 € de frais");
  });

  it("coupon couru payé à l'achat et frais : compris dans le montant investi", () => {
    // Achat 6 mois après le coupon : environ la moitié d'un coupon de 3 % de couru.
    const r = simulateBond({ ...input, buyDate: "2026-12-30", feePct: 0.5 }, 9_000, pfu);
    expect(r.lines[0]!.note).toContain("coupon couru");
    expect(r.lines[0]!.note).toContain("frais");
    const nominal = r.lines.find((l) => l.label === "Remboursement au pair")!.gross;
    expect(nominal).toBeLessThan(10_000);
    // Le premier coupon reste imposé en entier : le coupon couru payé n'en est pas déduit (aucun texte pour un particulier).
    const first = r.lines.find((l) => l.label === "Premier coupon")!;
    expect(first.taxable).toBeCloseTo(first.gross, 2);
    expect(first.incomeTax).toBeCloseTo(first.gross * 0.128, 2);
  });
});

describe("obligation revendue avant l'échéance", () => {
  const input = { pricePct: 90, couponPct: 3, frequency: 1, maturityDate: "2031-06-30", buyDate: "2026-06-30", feePct: 0, feeFixed: 0, holdYears: 2, salePricePct: 0 };

  it("prix de revente estimé à rendement inchangé : il remonte vers le pair avec le temps", () => {
    const p2 = bondResalePrice(input, "2028-06-30")!;
    expect(p2).toBeGreaterThan(0.9);
    expect(p2).toBeLessThan(1);
    // Achetée au pair avec un coupon égal au rendement : elle reste au pair.
    expect(bondResalePrice({ ...input, pricePct: 100 }, "2028-06-30")!).toBeCloseTo(1, 4);
  });

  it("le gain est une plus-value (prélèvements sociaux du patrimoine), plus une prime de remboursement", () => {
    const r = simulateBond({ ...input, salePricePct: 95 }, 9_000, pfu);
    expect(r.lines.some((l) => l.label === "Remboursement au pair")).toBe(false);
    expect(r.lines.filter((l) => l.label === "Coupon")).toHaveLength(2);
    const sale = r.lines.at(-1)!;
    // 10 000 € de nominal revendus à 95 %, achetés 9 000 € : 500 € de plus-value.
    expect(sale.gross).toBeCloseTo(9_500, 2);
    expect(sale.taxable).toBeCloseTo(500, 2);
    expect(sale.incomeTax).toBeCloseTo(500 * 0.128, 2);
    expect(sale.social).toBeCloseTo(500 * PS, 2);
    expect(r.endDate).toBe("2028-06-30");
  });

  it("revendue à perte : moins-value, pas d'impôt", () => {
    const r = simulateBond({ ...input, salePricePct: 85 }, 9_000, pfu);
    expect(r.lines.at(-1)!.incomeTax).toBe(0);
    expect(r.notes.join(" ")).toContain("Moins-value");
  });

  it("une durée au-delà de l'échéance : gardée jusqu'au remboursement", () => {
    const r = simulateBond({ ...input, holdYears: 8 }, 9_000, pfu);
    expect(r.lines.some((l) => l.label === "Remboursement au pair")).toBe(true);
    expect(r.notes.join(" ")).toContain("dépasse l'échéance");
  });
});

describe("même durée pour toutes les simulations", () => {
  const bond = { pricePct: 90, couponPct: 3, frequency: 1, maturityDate: "2031-06-30", buyDate: "2026-06-30", feePct: 0, feeFixed: 0, holdYears: 0, salePricePct: 0 };

  it("sans rendement de réinvestissement : on retrouve le même gain, étalé sur la durée plus longue", () => {
    const r = simulateBond(bond, 9_000, pfu);
    const h = reinvestToHorizon(r, "2034-06-30", 0);
    expect(h.netGain).toBeCloseTo(r.netGain, 2);
    expect(h.endDate).toBe("2034-06-30");
    expect(h.netRate!).toBeLessThan(r.netRate!);
  });

  it("les sommes reçues avant la fin rapportent le taux de réinvestissement", () => {
    const r = simulateBond(bond, 9_000, pfu);
    const h = reinvestToHorizon(r, "2034-06-30", 2);
    expect(h.netGain).toBeGreaterThan(r.netGain);
    // Le remboursement de 2031 placé 3 ans à 2 % rapporte à lui seul un peu plus de 600 €.
    expect(h.netGain - r.netGain).toBeGreaterThan(600);
    expect(h.lines.at(-1)!.label).toBe("Sommes replacées jusqu'à la fin");
  });

  it("crowdlending plus long que la durée : arrêt, capital restant dû compté au pair", () => {
    const r = simulateLending({ ratePct: 12, months: 36, repayment: "in_fine", defaultPct: 0, startDate: "2026-01-15" }, 1_200, pfu, 12);
    expect(r.lines).toHaveLength(13);
    expect(r.lines.at(-1)!.gross).toBeCloseTo(1_212, 2);
    expect(r.notes.join(" ")).toContain("dure plus que la durée de comparaison");
  });
});

describe("ETF et actions", () => {
  const base = { returnPct: 7, dividendPct: 0, feesPct: 0.2, entryFeePct: 0, entryFixed: 0, annualFixed: 0, salePct: 0, saleFixed: 0, years: 10, envelopeAgeYears: 0, startDate: "2026-11-11" };

  it("PEA de plus de 5 ans : prélèvements sociaux seuls sur le gain", () => {
    const r = simulateEquity({ ...base, envelope: "pea" }, 10_000, pfu);
    const value = 10_000 * Math.pow(1.068, 10);
    const exit = r.lines.at(-1)!;
    expect(exit.gross).toBeCloseTo(value, 1);
    expect(exit.incomeTax).toBe(0);
    // Gains du PEA : produits de placement, 18,6 % à partir de 2026 (LFSS 2026, art. 12).
    expect(exit.social).toBeCloseTo(exit.taxable * 0.186, 2);
    expect(r.grossRate!).toBeCloseTo(0.068, 3);
    expect(r.baremeEligible).toBe(false);
  });

  it("PEA retiré avant 5 ans : impôt et prélèvements sociaux", () => {
    const r = simulateEquity({ ...base, envelope: "pea", years: 3 }, 10_000, pfu);
    const exit = r.lines.at(-1)!;
    expect(exit.incomeTax).toBeCloseTo(exit.taxable * 0.128, 2);
    expect(r.baremeEligible).toBe(true);
  });

  it("compte-titres : dividendes imposés chaque année (abattement de 40 % au barème), plus-value à la vente", () => {
    const r = simulateEquity({ ...base, envelope: "cto", dividendPct: 2 }, 10_000, bareme);
    const first = r.lines.find((l) => l.label === "Dividendes")!;
    expect(first.gross).toBeCloseTo(200, 2);
    expect(first.incomeTax).toBeCloseTo((200 * 0.6 - 200 * 0.068) * 0.11, 2);
    const sale = r.lines.at(-1)!;
    expect(sale.label).toBe("Vente");
    expect(sale.taxable).toBeCloseTo(sale.gross - 10_000, 2);
  });

  it("frais fixes : à l'achat, chaque année (payés à côté en compte-titres), à la vente avant la plus-value", () => {
    const r = simulateEquity({ ...base, envelope: "cto", returnPct: 0, feesPct: 0, years: 2, entryFixed: 10, annualFixed: 30, saleFixed: 5 }, 10_000, pfu);
    // Valeur placée : 9 990 € ; rendement nul ; vente nette de 5 € de frais : 9 985 €, soit 15 € de moins-value.
    const sale = r.lines.at(-1)!;
    expect(sale.gross).toBeCloseTo(9_985, 2);
    expect(sale.incomeTax).toBe(0);
    expect(r.lines.filter((l) => l.label === "Frais fixes de l'année")).toHaveLength(2);
    expect(r.grossGain).toBeCloseTo(-15 - 60, 2);
    const pea = simulateEquity({ ...base, envelope: "pea", returnPct: 0, feesPct: 0, years: 2, annualFixed: 30 }, 10_000, pfu);
    // PEA : prélevés sur le plan.
    expect(pea.lines.at(-1)!.gross).toBeCloseTo(9_940, 2);
  });

  it("assurance-vie après 8 ans : abattement, puis taux réduit", () => {
    const r = simulateEquity({ ...base, envelope: "av" }, 10_000, pfu);
    const exit = r.lines.at(-1)!;
    expect(exit.incomeTax).toBeCloseTo(Math.max(0, exit.taxable - 4_600) * 0.075, 2);
    expect(exit.social).toBeCloseTo(exit.taxable * params.tax.socialAv, 2);
  });
});

describe("fonds euros", () => {
  it("prélèvements sociaux chaque année dans le contrat, impôt au rachat après l'abattement", () => {
    const r = simulateEuroFund({ ratePct: 2.5, entryFeePct: 0, years: 8, contractAgeYears: 0, startDate: "2026-11-11" }, 10_000, pfu);
    const credited = r.lines.filter((l) => l.kept);
    expect(credited).toHaveLength(8);
    expect(credited[0]!.social).toBeCloseTo(250 * params.tax.socialAv, 2);
    const exit = r.lines.at(-1)!;
    // Gains sous l'abattement de 4 600 € : pas d'impôt sur le revenu.
    expect(exit.incomeTax).toBe(0);
    expect(r.grossGain).toBeCloseTo(10_000 * (Math.pow(1.025, 8) - 1), 2);
    expect(r.netRate!).toBeCloseTo(0.025 * (1 - params.tax.socialAv), 4);
  });

  it("avant 8 ans : gains imposés à 12,8 %", () => {
    const r = simulateEuroFund({ ratePct: 2.5, entryFeePct: 0, years: 4, contractAgeYears: 0, startDate: "2026-11-11" }, 10_000, pfu);
    const exit = r.lines.at(-1)!;
    expect(exit.incomeTax).toBeCloseTo(exit.taxable * 0.128, 2);
  });
});

describe("crowdlending", () => {
  it("in fine : intérêts mensuels imposés, capital à la fin", () => {
    const r = simulateLending({ ratePct: 12, months: 12, repayment: "in_fine", defaultPct: 0, startDate: "2026-01-15" }, 1_200, pfu);
    expect(r.lines).toHaveLength(13);
    expect(r.lines[1]!.gross).toBeCloseTo(12, 2);
    expect(r.lines.at(-1)!.gross).toBeCloseTo(1_212, 2);
    expect(r.grossGain).toBeCloseTo(144, 2);
  });

  it("projets en défaut : la perte s'impute sur les intérêts de l'année, pour l'impôt sur le revenu", () => {
    // Prêt sur une seule année civile : la perte, constatée à la fin, absorbe les intérêts de l'année.
    const r = simulateLending({ ratePct: 12, months: 12, repayment: "in_fine", defaultPct: 10, startDate: "2025-12-31" }, 1_000, pfu);
    const loss = r.lines.find((l) => l.label === "Perte des projets en défaut")!;
    // 900 € sains : 108 € d'intérêts sur l'année ; 100 € perdus imputés dessus.
    expect(r.grossGain).toBeCloseTo(108 - 100, 2);
    expect(loss.incomeTax).toBeCloseTo(-100 * 0.128, 2);
  });

  it("imputation des pertes plafonnée à 8 000 € par an", () => {
    const r = simulateLending({ ratePct: 12, months: 12, repayment: "in_fine", defaultPct: 50, startDate: "2025-12-31" }, 40_000, pfu);
    const loss = r.lines.find((l) => l.label === "Perte des projets en défaut")!;
    // 20 000 € perdus, 2 400 € d'intérêts : l'imputation est limitée par les intérêts, sous le plafond.
    expect(loss.taxable).toBeCloseTo(-2_400, 2);
    const big = simulateLending({ ratePct: 12, months: 12, repayment: "in_fine", defaultPct: 20, startDate: "2025-12-31" }, 200_000, pfu);
    expect(big.lines.find((l) => l.label === "Perte des projets en défaut")!.taxable).toBeCloseTo(-8_000, 2);
  });
});

describe("livrets et comptes à terme", () => {
  it("livret réglementé : net égal au brut", () => {
    const r = simulateSavings({ kind: "reglemente", ratePct: 2, years: 5, startDate: "2026-11-11" }, 10_000, pfu);
    expect(r.netGain).toBeCloseTo(r.grossGain, 2);
    expect(r.grossRate!).toBeCloseTo(0.02, 3);
  });

  it("livret fiscalisé : impôt et prélèvements retenus chaque année", () => {
    const r = simulateSavings({ kind: "fiscalise", ratePct: 3, years: 1, startDate: "2026-11-11" }, 10_000, pfu);
    expect(r.netGain).toBeCloseTo(300 * (1 - 0.128 - PS), 2);
  });
});
