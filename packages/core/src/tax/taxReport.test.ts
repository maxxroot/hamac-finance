import { describe, expect, it } from "vitest";
import { defaultParams, type Account, type Asset, type Institution, type InstitutionTax, type Transaction } from "../model";
import { computePortfolio, type EngineData } from "../portfolio";
import { buildTaxReport, compareWithStatement, reportTotalsMismatches, resolveIncome, rulesValidityLabel, taxReportAlerts, taxReportCsvRows, taxReportYears, worstStatus } from "./taxReport";
import { cryptoTax, yearlyTaxes } from "./taxes";

const acc = (id: string, kind: Account["kind"], institutionId: string | null = null): Account => ({
  id, kind, livretType: null, name: id, institutionId, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false,
});
const asset = (id: string, kind: Asset["kind"]): Asset => ({
  id, kind, name: id, isin: null, symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false,
});
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra });
const etab = (id: string, tax: Partial<InstitutionTax> = {}, offers: Institution["offers"] = {}): Institution => ({ id, name: id, kind: "courtier", website: "", score: null, comment: "", offers, tax: { report: false, withholds: null, withheldIncomeTax: null, withheldSocial: null, ...tax }, protection: { guarantor: "", country: "france" } });

function data(over: Partial<EngineData>): EngineData {
  const params = defaultParams(new Date(2026, 10, 7));
  params.tax = { ...params.tax, tmi: 0.3 };
  return { params, accounts: [], assets: [], transactions: [], plans: [], skips: [], prices: [], ...over };
}
function report(d: EngineData, year = 2025) {
  const asOf = "2026-11-09";
  return buildTaxReport(d, computePortfolio(d, asOf).disposals, cryptoTax(d, asOf), year);
}
const box = (r: ReturnType<typeof report>, b: string) => r.lines.find((l) => l.rule.box === b);

describe("brut et retenues d'un revenu", () => {
  const cto = acc("c", "cto", "e");
  it("le brut saisi prime, et un écart est signalé", () => {
    const d = data({ institutions: [etab("e", { report: true })] });
    expect(resolveIncome(tx("2025-03-01", "dividende", "c", 87.2, { gross: 100, withheldIncomeTax: 12.8 }), cto, d)).toMatchObject({ gross: 100, incomeTax: 12.8, status: "calcule" });
    expect(resolveIncome(tx("2025-03-01", "dividende", "c", 80, { gross: 100, withheldIncomeTax: 12.8 }), cto, d).status).toBe("a_verifier");
    // Retenues débitées par une opération à part : le montant reçu est le brut.
    expect(resolveIncome(tx("2025-03-01", "interets", "c", 100, { gross: 100, withheldIncomeTax: 12.8, withheldSocial: 17.2 }), cto, d)).toMatchObject({ gross: 100, incomeTax: 12.8, social: 17.2, status: "calcule" });
  });
  it("sans brut : le taux de l'établissement s'il en a un, sinon celui des paramètres, champ par champ", () => {
    expect(resolveIncome(tx("2025-03-01", "interets", "c", 87.2), cto, data({ institutions: [etab("e", { report: true, withheldIncomeTax: 0.128, withheldSocial: 0 })] }))).toMatchObject({ gross: 100, incomeTax: 12.8, social: 0, status: "calcule" });
    // Vide : 12,8 % et, pour un revenu versé en 2025, 17,2 % de prélèvements sociaux.
    expect(resolveIncome(tx("2025-03-01", "interets", "c", 70), cto, data({ institutions: [etab("e", { report: true })] }))).toMatchObject({ gross: 100, incomeTax: 12.8, social: 17.2, status: "calcule" });
    // Seuls les prélèvements sociaux diffèrent : l'acompte reste celui par défaut.
    expect(resolveIncome(tx("2025-03-01", "interets", "c", 87.2), cto, data({ institutions: [etab("e", { report: true, withheldSocial: 0 })] }))).toMatchObject({ gross: 100, incomeTax: 12.8, social: 0, status: "calcule" });
    // Un revenu 2026 suit le taux réglé dans les paramètres.
    expect(resolveIncome(tx("2026-03-01", "interets", "c", 68.6), cto, data({ institutions: [etab("e", { report: true })] }))).toMatchObject({ gross: 100, social: 18.6 });
  });
  it("revenus 2025 d'un établissement sans fiche : retenue française à 17,2 % de prélèvements sociaux (LFSS 2026, art. 12)", () => {
    const r = resolveIncome(tx("2025-03-01", "interets", "c", 70), cto, data({ institutions: [etab("e")] }));
    expect(r.gross).toBeCloseTo(100, 2);
    expect(r.social).toBeCloseTo(17.2, 2);
    expect(r.status).toBe("a_verifier");
  });
});

describe("récapitulatif fiscal", () => {
  const scenario = () =>
    data({
      accounts: [acc("tr", "cto", "courtier"), acc("banque-cto", "cto", "banque"), acc("sans", "cto"), acc("pret", "crowdlending", "plateforme"), acc("x1", "crypto", "cx1"), acc("x2", "crypto", "cx2"), acc("pea", "pea", "banque")],
      assets: [asset("act", "action"), asset("etf", "etf"), asset("btc", "crypto"), asset("eth", "crypto")],
      institutions: [
        etab("courtier", { report: true, withheldIncomeTax: 0.128, withheldSocial: 0 }),
        etab("banque"),
        etab("plateforme", {}, { crowdlending: { taxWithheld: false, taxRate: null } }),
        etab("cx1", { report: true }),
        etab("cx2", { report: true }),
      ],
      prices: [{ assetId: "eth", date: "2025-05-01", price: 2000, source: "marche" }],
      transactions: [
        tx("2025-02-01", "dividende", "tr", 87.2, { assetId: "act" }),
        tx("2025-03-01", "interets", "tr", 87.2),
        tx("2025-04-01", "dividende", "tr", 85, { assetId: "act", gross: 100, withheldForeign: 15 }),
        tx("2024-01-10", "achat", "tr", 1000, { assetId: "act", quantity: 10 }),
        tx("2025-05-10", "vente", "tr", 800, { assetId: "act", quantity: 5 }),
        tx("2025-06-01", "dividende", "banque-cto", 70, { assetId: "etf" }),
        tx("2024-01-10", "achat", "banque-cto", 1000, { assetId: "etf", quantity: 10 }),
        tx("2025-07-10", "vente", "banque-cto", 400, { assetId: "etf", quantity: 5 }),
        tx("2025-08-01", "interets", "sans", 70),
        tx("2025-09-01", "interets", "pret", 50),
        tx("2024-06-01", "achat", "x1", 1000, { assetId: "btc", quantity: 1 }),
        tx("2024-06-01", "achat", "x2", 1000, { assetId: "eth", quantity: 1 }),
        tx("2025-05-02", "vente", "x1", 3000, { assetId: "btc", quantity: 0.5, fee: 0 }),
      ],
    });

  it("une fiche par établissement concerné, celles à saisir d'abord", () => {
    const r = report(scenario());
    expect(r.sheets.map((s) => [s.key, s.mode])).toEqual([
      ["courtier", "a_saisir"],
      ["cx1", "a_saisir"],
      ["cx2", "a_saisir"],
      ["banque", "a_controler"],
      ["sans-etablissement", "a_controler"],
      ["plateforme", "a_controler"],
    ]);
  });

  it("chaque case du récapitulatif est la somme exacte des fiches", () => {
    const r = report(scenario());
    for (const l of r.lines.filter((x) => x.toEnter !== null)) {
      const sum = r.sheets.reduce((s, sh) => s + (sh.lines.find((x) => x.key === l.key)?.amount ?? 0), 0);
      expect(l.total).toBeCloseTo(sum, 2);
      expect(l.total).toBeCloseTo(l.toEnter! + l.toCheck!, 2);
    }
    expect(r.securities!.net).toBeCloseTo(r.sheets.reduce((s, sh) => s + sh.securities.net, 0), 2);
    expect(r.crypto!.netGain).toBeCloseTo(r.sheets.reduce((s, sh) => s + sh.crypto.gain, 0), 2);
  });

  it("sépare ce qui est à saisir de ce qui est à contrôler, pour ne rien déclarer deux fois", () => {
    const r = report(scenario());
    const div = box(r, "2DC")!;
    expect(div.toEnter).toBeCloseTo(200, 2); // 100 déduits des taux + 100 saisis
    expect(div.toCheck).toBeCloseTo(70 / (1 - 0.172 - 0.128), 2);
    expect(box(r, "2TT")).toMatchObject({ total: 50, toEnter: 0, toCheck: 50 });
    expect(box(r, "2CK")!.toEnter).toBeCloseTo(25.6, 2);
    expect(box(r, "2AB")).toMatchObject({ total: 15, status: "a_verifier" });
  });

  it("compense les plus et moins-values entre établissements", () => {
    const r = report(scenario());
    // Courtier : 800 − 500 = +300. Banque : 400 − 500 = −100.
    expect(r.sheets.find((s) => s.key === "courtier")!.securities.net).toBe(300);
    expect(r.sheets.find((s) => s.key === "banque")!.securities.net).toBe(-100);
    expect(box(r, "3VG")).toMatchObject({ total: 200, toEnter: null });
    expect(box(r, "3VH")).toBeUndefined();
    expect(r.reminders.join(" ")).toContain("2074");
  });

  it("calcule la plus-value crypto sur le portefeuille global, toutes plateformes", () => {
    const r = report(scenario());
    // Valeur globale : 1 BTC au prix de la cession (6 000) + 1 ETH à 2 000 = 8 000 ; prix d'acquisition 2 000 ; cession 3 000.
    const sale = r.sheets.find((s) => s.key === "cx1")!.cryptoSales[0].sale;
    expect(sale.portfolioValue).toBe(8000);
    expect(sale.attributed).toBe(750);
    expect(box(r, "3AN")!.total).toBe(2250);
    expect(r.sheets.find((s) => s.key === "cx2")!.cryptoSales).toEqual([]);
  });

  it("exonère la crypto sous 305 € de cessions, en rappelant la 2086", () => {
    const d = data({ accounts: [acc("x", "crypto", "cx")], assets: [asset("btc", "crypto")], institutions: [etab("cx", { report: true })], transactions: [tx("2024-06-01", "achat", "x", 100, { assetId: "btc", quantity: 1 }), tx("2025-05-02", "vente", "x", 300, { assetId: "btc", quantity: 0.5, fee: 0 })] });
    const r = report(d);
    expect(box(r, "3AN")).toBeUndefined();
    expect(r.reminders.join(" ")).toContain("2086 reste à joindre");
  });

  it("marque une vente sans achat connu, et laisse les SCPI hors des valeurs mobilières", () => {
    const d = data({
      accounts: [acc("c", "cto", "e")],
      assets: [asset("a", "action"), asset("s", "scpi")],
      institutions: [etab("e", { report: true })],
      transactions: [tx("2025-02-01", "vente", "c", 100, { assetId: "a", quantity: 1 }), tx("2024-02-01", "achat", "c", 500, { assetId: "s", quantity: 1 }), tx("2025-03-01", "vente", "c", 900, { assetId: "s", quantity: 1 })],
    });
    const r = report(d);
    expect(r.sheets[0].disposals).toHaveLength(1);
    expect(r.sheets[0].disposals[0].status).toBe("manquant");
    expect(box(r, "3VG")).toMatchObject({ total: 100, status: "manquant" });
  });

  it("garde une fiche cochée sans revenu, et affiche l'année de validité", () => {
    const d = data({ accounts: [acc("c", "cto", "e")], institutions: [etab("e", { report: true })] });
    const r = report(d);
    expect(r.sheets).toHaveLength(1);
    expect(r.sheets[0].lines).toEqual([]);
    expect(r.rules).toMatchObject({ incomeYear: 2025, declarationYear: 2026, covered: true });
    expect(report(d, 2026).rules.covered).toBe(false);
  });

  it("indique l'année de validité, et prévient quand les cases ne sont pas vérifiées", () => {
    const d = data({ accounts: [acc("c", "cto", "e")], institutions: [etab("e", { report: true })] });
    expect(rulesValidityLabel(report(d).rules)).toBe("Règles vérifiées le 09/11/2026 d'après : Brochure pratique IR 2026 (impots.gouv.fr).");
    expect(rulesValidityLabel(report(d, 2026).rules)).toContain("à titre indicatif");
  });

  it("exporte le détail de chaque opération", () => {
    const rows = taxReportCsvRows(report(scenario()));
    expect(rows[0][0]).toBe("Établissement");
    expect(rows.some((r) => r[4] === "Vente" && r[12] === 300)).toBe(true);
    expect(rows.some((r) => r[4] === "Cession crypto" && r[12] === 2250)).toBe(true);
  });

  it("liste les autres comptes sans les chiffrer", () => {
    expect(report(scenario()).others.map((o) => o.account.id)).toEqual(["pea"]);
  });

  it("les années proposées vont de la première opération à l'année en cours", () => {
    expect(taxReportYears(scenario(), "2026-11-09")).toEqual([2026, 2025, 2024]);
  });

  it("le statut le plus défavorable l'emporte", () => {
    expect(worstStatus(["calcule", "a_verifier"])).toBe("a_verifier");
    expect(worstStatus(["a_verifier", "manquant"])).toBe("manquant");
    expect(worstStatus([])).toBe("calcule");
  });
});

describe("impôts de chaque année, mêmes calculs que le récapitulatif", () => {
  it("n'invente pas de retenue française chez un courtier qui ne retient rien, et ajoute les plus-values", () => {
    const d = data({
      accounts: [acc("c", "cto", "e")],
      assets: [asset("a", "action")],
      institutions: [etab("e", { report: true, withheldIncomeTax: 0, withheldSocial: 0 })],
      transactions: [tx("2025-03-01", "dividende", "c", 100, { assetId: "a" }), tx("2024-01-10", "achat", "c", 500, { assetId: "a", quantity: 1 }), tx("2025-05-10", "vente", "c", 800, { assetId: "a", quantity: 1 })],
    });
    const asOf = "2025-12-31";
    const row = yearlyTaxes(d, cryptoTax(d, asOf), asOf, computePortfolio(d, asOf).disposals).find((y) => y.year === 2025)!;
    expect(row.couponsGross).toBe(100);
    expect(row.withholding).toBe(0);
    expect(row.couponsSocial).toBeCloseTo(18.6, 2); // pas retenus à la source : à payer sur la déclaration
    expect(row.securitiesGain).toBe(300);
    expect(row.securitiesIncomeTax).toBeCloseTo(300 * 0.128, 2);
    expect(row.securitiesSocial).toBeCloseTo(300 * 0.186, 2);
  });
});

describe("contrôles de cohérence", () => {
  const alerts = (d: EngineData, year = 2025, statements: Parameters<typeof taxReportAlerts>[3] = []) => {
    const asOf = "2026-11-09";
    const disposals = computePortfolio(d, asOf).disposals;
    return taxReportAlerts(buildTaxReport(d, disposals, cryptoTax(d, asOf), year), d, disposals, statements).map((a) => a.message).join("\n");
  };

  it("signale une vente sans achat et un compte sans établissement", () => {
    const d = data({
      accounts: [acc("c", "cto", "e"), acc("s", "cto")],
      assets: [asset("a", "action")],
      institutions: [etab("e", { report: true })],
      transactions: [tx("2025-03-01", "dividende", "c", 50, { assetId: "a" }), tx("2025-04-01", "vente", "c", 100, { assetId: "a", quantity: 1 }), tx("2025-05-01", "interets", "s", 10)],
    });
    const m = alerts(d);
    expect(m).toContain("il manque un achat");
    expect(m).toContain("n'ont pas d'établissement");
  });

  it("signale les retraits hors périmètre, les SCPI, un titre sur plusieurs comptes et une année non vérifiée", () => {
    const d = data({
      accounts: [acc("pea", "pea", "e"), acc("c1", "cto", "e"), acc("c2", "cto", "e")],
      assets: [asset("a", "action"), asset("s", "scpi")],
      institutions: [etab("e", { report: true })],
      transactions: [
        tx("2025-03-01", "retrait", "pea", 100),
        tx("2024-01-01", "achat", "c1", 100, { assetId: "a", quantity: 1 }),
        tx("2024-01-01", "achat", "c2", 200, { assetId: "a", quantity: 1 }),
        tx("2025-05-01", "vente", "c1", 150, { assetId: "a", quantity: 1 }),
        tx("2024-01-01", "achat", "c1", 500, { assetId: "s", quantity: 1 }),
        tx("2025-06-01", "vente", "c1", 600, { assetId: "s", quantity: 1 }),
      ],
    });
    const m = alerts(d);
    expect(m).toContain("Retrait en 2025 sur pea");
    expect(m).toContain("parts de SCPI");
    expect(m).toContain("plusieurs comptes-titres");
    expect(alerts(d, 2026)).toContain("ne sont pas encore vérifiées");
  });

  it("repère un relevé qui s'écarte de la valeur calculée", () => {
    const d = data({ accounts: [acc("c", "cto", "e")], institutions: [etab("e", { report: true })], transactions: [tx("2025-01-05", "versement", "c", 1000)], statements: [{ id: "r", accountId: "c", date: "2025-12-31", value: 1500, comment: "" }] });
    expect(alerts(d)).toContain("s'écarte de la valeur calculée");
  });

  it("compare une fiche au document de l'établissement, case par case", () => {
    const d = data({ accounts: [acc("c", "cto", "e")], institutions: [etab("e", { report: true, withheldIncomeTax: 0.128, withheldSocial: 0 })], transactions: [tx("2025-03-01", "interets", "c", 87.2)] });
    const r = report(d);
    const rows = compareWithStatement(r.sheets[0], r.rules, new Map([["2TR", 95]]));
    expect(rows.find((x) => x.rule.box === "2TR")).toMatchObject({ hamac: 100, official: 95, gap: 5 });
    expect(rows.find((x) => x.rule.box === "2DC")).toMatchObject({ hamac: 0, official: null, gap: null });
    expect(alerts(d, 2025, [{ institutionId: "e", year: 2025, box: "2TR", amount: 95 }])).toContain("écart sur la case 2TR");
    expect(alerts(d, 2025, [{ institutionId: "e", year: 2025, box: "2TR", amount: 100 }])).not.toContain("écart");
  });

  it("le récapitulatif ne présente aucun écart avec les fiches", () => {
    const d = data({ accounts: [acc("c", "cto", "e")], institutions: [etab("e", { report: true, withheldIncomeTax: 0, withheldSocial: 0 })], transactions: [tx("2025-03-01", "interets", "c", 33.33)] });
    expect(reportTotalsMismatches(report(d))).toEqual([]);
  });
});

