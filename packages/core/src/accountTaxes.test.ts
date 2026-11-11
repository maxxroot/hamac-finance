import { describe, expect, it } from "vitest";
import { accountTaxDetails, declarationSettled, nextDeclarationYear } from "./accountTaxes";
import { crowdInterestEntries } from "./crowdlending";
import type { Account, Asset, Transaction } from "./domain";
import { computePortfolio, type EngineData } from "./engine";
import { crowdWithholding, type Institution } from "./institutions";
import { socialRateFor } from "./fiscalRules";
import { defaultParams } from "./params";
import { cryptoTax, yearlyTaxes } from "./taxes";

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: kind === "livret" ? "LEP" : null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "",
  beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
const asset = (id: string, kind: Asset["kind"]): Asset => ({
  id, kind, name: id, isin: null, symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null,
  targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false,
});
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra,
});
const etab = (id: string, crowdlending: { taxWithheld: boolean; taxRate: number | null }) => ({ id, name: id, kind: "crowdlending", website: "", score: null, comment: "", offers: { crowdlending } }) as Institution;

function data(over: Partial<EngineData>): EngineData {
  const params = defaultParams(new Date(2025, 0, 1));
  params.profile = { ...params.profile, startMonth: "2025-01" };
  // Tranche à 30 % : l'impôt sur le revenu suit le prélèvement forfaitaire (12,8 %).
  params.tax = { ...params.tax, tmi: 0.3 };
  return { params, accounts: [], assets: [], transactions: [], plans: [], skips: [], prices: [], ...over };
}

const details = (d: EngineData, asOf: string) => {
  const state = computePortfolio(d, asOf);
  const crypto = cryptoTax(d, asOf);
  return { rows: accountTaxDetails(d, state, crypto), years: yearlyTaxes(d, crypto, asOf, state.disposals) };
};

describe("impôts compte par compte", () => {
  it("impôt des revenus N payé dès la sortie de l'avis, début août N+1", () => {
    expect(declarationSettled(2025, "2026-07-31")).toBe(false);
    expect(declarationSettled(2025, "2026-08-01")).toBe(true);
    expect(nextDeclarationYear("2026-06-01")).toBe(2025);
    expect(nextDeclarationYear("2026-11-11")).toBe(2026);
  });

  it("crowdlending : impôts retenus par la plateforme payés, ceux d'une plateforme qui ne prélève pas restent à payer", () => {
    const p = defaultParams(new Date(2025, 0, 1));
    const lines = crowdInterestEntries({ accountId: "preleve", month: "2026-03", monthLabel: "mars 2026", gross: 100, withheld: crowdWithholding(100, 0.314, p), today: "2026-06-01" });
    const d = data({
      accounts: [acc("preleve", "crowdlending", { institutionId: "e" }), acc("adeclarer", "crowdlending")],
      institutions: [etab("e", { taxWithheld: true, taxRate: 0.314 })],
      transactions: [
        tx("2026-01-02", "versement", "preleve", 1000),
        tx("2026-01-02", "versement", "adeclarer", 1000),
        ...lines.map((l) => tx(l.date, l.type, l.accountId, l.amount, { gross: l.gross, withheldIncomeTax: l.withheldIncomeTax, withheldSocial: l.withheldSocial })),
        tx("2025-06-30", "interets", "adeclarer", 50),
        tx("2026-03-31", "interets", "adeclarer", 100),
      ],
    });
    const { rows } = details(d, "2026-06-01");
    const preleve = rows.find((r) => r.accountId === "preleve")!;
    // 100 € bruts à 31,4 % : 31,40 € retenus, rien à la déclaration. L'opération « Impôts » n'est pas comptée deux fois.
    expect(preleve.paid).toBeCloseTo(31.4, 2);
    expect(preleve.toPay).toBe(0);
    expect(preleve.years[0]).toMatchObject({ year: 2026, income: 100, atSource: 31.4, atDeclaration: 0 });
    expect(preleve.notes.some((x) => x.includes("ne correspondent pas"))).toBe(false);

    const adeclarer = rows.find((r) => r.accountId === "adeclarer")!;
    // Impôt à 12,8 % plus les prélèvements sociaux de chaque année. Au 1er juin 2026, l'avis des revenus 2025 n'est pas encore sorti.
    const due = (year: number, gross: number) => gross * (0.128 + socialRateFor(year, "patrimoine", d.params));
    expect(adeclarer.years.map((y) => y.year)).toEqual([2026, 2025]);
    expect(adeclarer.years[1]!.atDeclaration).toBeCloseTo(due(2025, 50), 2);
    expect(adeclarer.years[0]!.atDeclaration).toBeCloseTo(due(2026, 100), 2);
    expect(adeclarer.paid).toBe(0);
    expect(adeclarer.toPay).toBeCloseTo(due(2025, 50) + due(2026, 100), 2);
    // Prochaine déclaration : les revenus 2025 seulement ; 2026 viendra l'année suivante.
    expect(adeclarer.nextDeclaration).toBeCloseTo(due(2025, 50), 2);
    // En août 2026, l'avis des revenus 2025 est sorti.
    const later = details(d, "2026-08-15").rows.find((r) => r.accountId === "adeclarer")!;
    expect(later.paid).toBeCloseTo(due(2025, 50), 2);
    expect(later.nextDeclaration).toBeCloseTo(due(2026, 100), 2);
  });

  it("crowdlending : signale des opérations « Impôts » sans retenue notée sur les intérêts", () => {
    const d = data({ accounts: [acc("c", "crowdlending")], transactions: [tx("2026-01-02", "versement", "c", 1000), tx("2026-03-31", "interets", "c", 100), tx("2026-03-31", "impots", "c", 30)] });
    const c = details(d, "2026-06-01").rows[0]!;
    expect(c.notes.some((x) => x.includes("ne correspondent pas"))).toBe(true);
  });

  it("compte-titres : acompte et prélèvements retenus à la source, régularisation à la déclaration", () => {
    const d = data({
      accounts: [acc("cto", "cto")],
      transactions: [tx("2026-01-02", "versement", "cto", 1000), tx("2026-04-01", "dividende", "cto", 68.6, { gross: 100, withheldIncomeTax: 12.8, withheldSocial: 18.6 })],
    });
    const cto = details(d, "2026-06-01").rows[0]!;
    // Impôt définitif 12,8 € = acompte : rien à régulariser.
    expect(cto.years[0]).toMatchObject({ income: 100, atSource: 31.4, atDeclaration: 0, total: 31.4 });
  });

  it("assurance-vie : prélèvements sociaux du fonds euros retrouvés à partir des intérêts nets, et échéance des 8 ans", () => {
    const d = data({ accounts: [acc("av", "assurance_vie", { openedOn: "2020-03-01" })], transactions: [tx("2025-01-02", "versement", "av", 10_000), tx("2025-12-31", "interets", "av", 82.8)] });
    const av = details(d, "2026-06-01").rows[0]!;
    // 82,80 € nets à 17,2 % : 100 € bruts, 17,20 € retenus par l'assureur.
    expect(av.paid).toBeCloseTo(17.2, 2);
    expect(av.years[0]!.income).toBeCloseTo(100, 2);
    expect(av.facts.find((f) => f.label === "8 ans du contrat")).toMatchObject({ date: "2028-03-01", milestone: true });
    expect(av.facts.find((f) => f.label === "Ouvert le")?.milestone).toBeUndefined();
  });

  it("crypto : l'impôt de l'année est réparti entre plateformes au prorata de leur plus-value", () => {
    const btc = asset("btc", "crypto");
    const d = data({
      accounts: [acc("a", "crypto"), acc("b", "crypto")],
      assets: [btc],
      prices: [{ assetId: "btc", date: "2026-01-01", price: 1000, source: "manuel" }],
      transactions: [
        tx("2026-01-01", "apport_initial", "a", 1000),
        tx("2026-01-01", "achat", "a", 1000, { assetId: "btc", quantity: 1 }),
        tx("2026-01-01", "apport_initial", "b", 1000),
        tx("2026-01-01", "achat", "b", 1000, { assetId: "btc", quantity: 1 }),
        tx("2026-03-01", "vente", "a", 3000, { assetId: "btc", quantity: 1 }),
        tx("2026-03-02", "vente", "b", 3000, { assetId: "btc", quantity: 1 }),
      ],
    });
    const { rows, years } = details(d, "2026-06-01");
    const total = years.find((y) => y.year === 2026)!;
    const sum = rows.reduce((t, r) => t + (r.years.find((y) => y.year === 2026)?.atDeclaration ?? 0), 0);
    expect(sum).toBeCloseTo(total.cryptoIncomeTax + total.cryptoSocial, 1);
    expect(rows.every((r) => r.years[0]!.atDeclaration > 0)).toBe(true);
  });

  it("la somme des comptes retombe sur le total de chaque année", () => {
    const d = data({
      accounts: [acc("lep", "livret"), acc("av", "assurance_vie"), acc("cto", "cto"), acc("c", "crowdlending")],
      assets: [asset("etf", "etf")],
      prices: [{ assetId: "etf", date: "2026-05-01", price: 150, source: "manuel" }],
      transactions: [
        tx("2025-01-02", "versement", "lep", 1000),
        tx("2025-12-31", "interets", "lep", 30),
        tx("2025-01-02", "versement", "av", 5000),
        tx("2025-12-31", "interets", "av", 120),
        tx("2025-01-02", "versement", "cto", 5000),
        tx("2025-01-03", "achat", "cto", 2000, { assetId: "etf", quantity: 20 }),
        tx("2025-06-01", "dividende", "cto", 40),
        tx("2026-04-01", "vente", "cto", 1500, { assetId: "etf", quantity: 10 }),
        tx("2025-01-02", "versement", "c", 2000),
        tx("2025-09-30", "interets", "c", 25),
      ],
    });
    const { rows, years } = details(d, "2026-06-01");
    for (const y of years) {
      const sum = rows.reduce((t, r) => t + (r.years.find((x) => x.year === y.year)?.total ?? 0), 0);
      expect(sum).toBeCloseTo(y.total, 1);
    }
    expect(rows.find((r) => r.accountId === "lep")!.paid).toBe(0);
  });
});
