import { describe, expect, it } from "vitest";
import { computeAlerts } from "../alerts";
import { defaultParams, type Account, type Asset, type Institution, type Transaction } from "../model";
import { computePortfolio, type EngineData } from "../portfolio";
import { yearEndChecklist, yearEndSeason } from "./yearEnd";

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: kind === "livret" ? "LIVRET_A" : null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1,
  entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
const titre = (id: string, price: number): Asset => ({
  id, kind: "action", name: id, isin: null, symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: price, manualPriceDate: "2026-11-01",
  targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, issuerCountry: null, archived: false,
});
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra });

function data(): EngineData {
  const params = defaultParams(new Date(2026, 0, 1));
  params.profile.startMonth = "2015-01";
  params.tax.tmi = 0.3;
  params.tax.perDeductionCeiling = 4_000;
  return {
    params,
    accounts: [acc("cto", "cto"), acc("av", "assurance_vie", { openedOn: "2015-01-05" }), acc("per", "per")],
    assets: [titre("Gagnant", 300), titre("Perdant", 50)],
    transactions: [
      tx("2025-01-10", "apport_initial", "cto", 5_000),
      tx("2025-02-01", "achat", "cto", 1_000, { assetId: "Gagnant", quantity: 10 }),
      tx("2026-03-01", "vente", "cto", 3_000, { assetId: "Gagnant", quantity: 10 }),
      tx("2025-02-01", "achat", "cto", 1_000, { assetId: "Perdant", quantity: 10 }),
      tx("2015-01-05", "apport_initial", "av", 10_000),
      tx("2025-12-31", "interets", "av", 2_500),
      tx("2026-02-01", "versement", "per", 1_000),
    ],
    plans: [],
    skips: [],
    prices: [],
  };
}

describe("liste de fin d'année", () => {
  it("chiffre les moins-values à réaliser, l'abattement de l'assurance-vie et le PER", () => {
    const d = data();
    const items = yearEndChecklist(d, computePortfolio(d, "2026-11-20"));
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    // 2 000 € de plus-value imposable, 500 € de moins-value latente : 500 × (12,8 % + 18,6 %).
    expect(byKey.moins_values.saving).toBe(157);
    expect(byKey.moins_values.lines).toEqual([{ label: "Perdant (cto)", amount: -500, hint: "moins-value latente" }]);
    // 4 600 € d'abattement × 7,5 % ; le contrat est à 20 % de gains : 23 000 € à retirer, plafonné à sa valeur (12 500 €).
    expect(byKey.assurance_vie.saving).toBe(345);
    expect(byKey.assurance_vie.lines[0].amount).toBe(12_500);
    // 3 000 € de plafond PER restant × 30 %.
    expect(byKey.per.saving).toBe(900);
    expect(items.at(-1)?.key).toBe("declaration");
  });

  it("ne propose pas de moins-values sans plus-value imposable", () => {
    const d = data();
    d.transactions = d.transactions.filter((t) => t.type !== "vente");
    expect(yearEndChecklist(d, computePortfolio(d, "2026-11-20")).some((i) => i.key === "moins_values")).toBe(false);
  });

  it("n'alerte qu'en novembre et en décembre", () => {
    const d = data();
    expect(yearEndSeason("2026-10-31")).toBe(false);
    expect(computeAlerts(d, computePortfolio(d, "2026-10-15")).some((a) => a.id === "fin-annee")).toBe(false);
    expect(computeAlerts(d, computePortfolio(d, "2026-11-20")).find((a) => a.id === "fin-annee")?.title).toBe("Liste de fin d'année : 3 gestes avant le 31 décembre");
  });
});

describe("rappel : dispense de l'acompte avant le 30 novembre", () => {
  // Plateforme de crowdlending qui prélève : 400 € d'intérêts bruts sur les 12 derniers mois.
  const plateforme: Institution = { id: "pl", name: "Plateforme Fictive", kind: "crowdlending", website: "", score: null, comment: "", offers: { crowdlending: { taxWithheld: true, taxRate: null } }, tax: { report: false, withholds: true, withheldIncomeTax: null, withheldSocial: null }, protection: { guarantor: "", country: "france" } } as Institution;
  function withCrowd(): EngineData {
    const d = data();
    d.accounts = [...d.accounts, acc("crowd", "crowdlending", { institutionId: "pl" })];
    d.institutions = [plateforme];
    d.transactions = [...d.transactions, tx("2026-01-05", "versement", "crowd", 10_000), tx("2026-03-31", "interets", "crowd", 200, { gross: 200 }), tx("2026-09-30", "interets", "crowd", 200, { gross: 200 }), tx("2025-06-30", "interets", "crowd", 999, { gross: 999 })];
    return d;
  }

  it("liste les établissements pas encore cochés pour l'année suivante, avec l'acompte évité", () => {
    const d = withCrowd();
    const item = yearEndChecklist(d, computePortfolio(d, "2026-11-20")).find((i) => i.key === "dispense_acompte")!;
    expect(item.title).toBe("Demander la dispense de l'acompte pour 2027 avant le 30/11/2026");
    // 12,8 % de 400 € (l'intérêt de 2025 a plus de 12 mois).
    expect(item.lines).toEqual([{ label: "Plateforme Fictive", amount: 51.2, hint: "acompte évité sur un an (12,8 % de 400 € d'intérêts)" }]);
    expect(computeAlerts(d, computePortfolio(d, "2026-11-20")).find((a) => a.id === "dispense-2027")?.title).toBe("Dispense de l'acompte de 12,8 % pour 2027 : à demander avant le 30 novembre");
  });

  it("disparaît une fois l'établissement coché, et après le 30 novembre", () => {
    const d = withCrowd();
    expect(yearEndChecklist(d, computePortfolio(d, "2026-12-01")).some((i) => i.key === "dispense_acompte")).toBe(false);
    expect(computeAlerts(d, computePortfolio(d, "2026-12-01")).some((a) => a.id === "dispense-2027")).toBe(false);
    d.params.tax.withholdingDispenses = [{ year: 2027, institutionIds: ["pl"] }];
    expect(yearEndChecklist(d, computePortfolio(d, "2026-11-20")).some((i) => i.key === "dispense_acompte")).toBe(false);
    expect(computeAlerts(d, computePortfolio(d, "2026-11-20")).some((a) => a.id === "dispense-2027")).toBe(false);
  });
});
