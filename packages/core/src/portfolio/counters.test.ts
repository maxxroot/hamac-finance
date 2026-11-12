import { describe, expect, it } from "vitest";
import { ceilingCounters, giftCounters, lifeInsuranceCounters, seniorityCounters, type Gift } from "./counters";
import { defaultParams, type Account, type Transaction } from "../model";
import { computePortfolio, type EngineData } from "./engine";

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: kind === "livret" ? "LIVRET_A" : null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1,
  entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra });

function data(over: Partial<EngineData>): EngineData {
  const params = defaultParams(new Date(2026, 0, 1));
  params.profile.startMonth = "2015-01";
  params.profile.birthYear = 1960;
  return { params, accounts: [], assets: [], transactions: [], plans: [], skips: [], prices: [], ...over };
}

describe("compteurs d'ancienneté", () => {
  it("donne la date des 5 ans du PEA et des 8 ans de l'assurance-vie", () => {
    const d = data({ accounts: [acc("pea", "pea", { openedOn: "2022-03-10" }), acc("av", "assurance_vie", { openedOn: "2015-06-01" }), acc("av2", "assurance_vie")] });
    const s = seniorityCounters(computePortfolio(d, "2026-06-01"));
    expect(s.map((x) => [x.account.id, x.date, x.reached, x.monthsLeft])).toEqual([
      ["pea", "2027-03-10", false, 9],
      ["av", "2023-06-01", true, null],
      ["av2", null, false, null],
    ]);
  });
});

describe("plafonds de versement", () => {
  it("compte les versements bruts du PEA, retraits compris, et le plafond commun avec le PEA-PME", () => {
    const d = data({
      accounts: [acc("pea", "pea"), acc("pme", "pea_pme")],
      transactions: [tx("2020-01-10", "apport_initial", "pea", 100_000), tx("2025-02-01", "retrait", "pea", 10_000), tx("2024-01-10", "versement", "pme", 30_000)],
    });
    const c = ceilingCounters(d, computePortfolio(d, "2026-06-01"));
    expect(c.find((x) => x.key === "pea")).toMatchObject({ used: 100_000, ceiling: 150_000, remaining: 50_000 });
    expect(c.find((x) => x.key === "pea_pme")).toMatchObject({ used: 130_000, ceiling: 225_000, remaining: 95_000 });
  });

  it("suit les versements de l'année sur un PER quand le plafond est renseigné", () => {
    const d = data({ accounts: [acc("per", "per")], transactions: [tx("2025-05-01", "versement", "per", 3_000), tx("2026-02-01", "versement", "per", 2_000)] });
    expect(ceilingCounters(d, computePortfolio(d, "2026-06-01")).find((x) => x.key === "per")).toBeUndefined();
    d.params.tax.perDeductionCeiling = 4_500;
    expect(ceilingCounters(d, computePortfolio(d, "2026-06-01")).find((x) => x.key === "per")).toMatchObject({ used: 2_000, remaining: 2_500 });
  });
});

describe("assurance-vie", () => {
  it("impute la part de gain des retraits de l'année sur l'abattement, après 8 ans seulement", () => {
    // 10 000 € versés, 2 000 € d'intérêts : un retrait de 6 000 € contient 1 000 € de gain.
    const d = data({
      accounts: [acc("av", "assurance_vie", { openedOn: "2015-01-05" })],
      transactions: [tx("2015-01-05", "apport_initial", "av", 10_000), tx("2025-12-31", "interets", "av", 2_000), tx("2026-03-01", "retrait", "av", 6_000)],
    });
    const c = lifeInsuranceCounters(d, computePortfolio(d, "2026-06-01"))!;
    expect(c).toMatchObject({ allowance: 4_600, gainsWithdrawn: 1_000, allowanceLeft: 3_600 });
  });

  it("sépare les versements avant et après 70 ans", () => {
    const d = data({
      accounts: [acc("av", "assurance_vie", { openedOn: "2015-01-05" })],
      transactions: [tx("2015-01-05", "apport_initial", "av", 10_000), tx("2031-03-01", "versement", "av", 4_000)],
    });
    expect(lifeInsuranceCounters(d, computePortfolio(d, "2032-01-01"))).toMatchObject({ before70: 10_000, after70: 4_000, seventyOn: "2030-01-01" });
  });
});

describe("donations", () => {
  const gift = (over: Partial<Gift>): Gift => ({ id: `g${n++}`, date: "2020-01-01", direction: "faite", kind: "donation", person: "Camille", relation: "enfant", amount: 10_000, comment: "", ...over });

  it("cumule les donations des 15 dernières années par personne", () => {
    const c = giftCounters([gift({ date: "2008-01-01", amount: 50_000 }), gift({ date: "2015-05-01", amount: 60_000 }), gift({ date: "2020-01-01", amount: 30_000 })], "2026-01-01");
    expect(c).toEqual([
      { direction: "faite", person: "Camille", relation: "enfant", allowance: 100_000, used: 90_000, remaining: 10_000, cashGiftUsed: 0, cashGiftRemaining: 31_865, taxable: 0, renewsOn: "2030-05-01" },
    ]);
  });

  it("impute le don familial d'argent d'abord sur son exonération, le reste sur l'abattement", () => {
    const [c] = giftCounters([gift({ kind: "don_argent", amount: 40_000, relation: "petit_enfant" })], "2026-01-01");
    expect(c).toMatchObject({ cashGiftUsed: 31_865, cashGiftRemaining: 0, used: 8_135, remaining: 23_730, taxable: 0 });
  });

  it("ne compte pas les présents d'usage et signale ce qui dépasse", () => {
    const c = giftCounters([gift({ kind: "present_usage", amount: 2_000 }), gift({ relation: "autre", person: "Ami", amount: 5_000 })], "2026-01-01");
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ person: "Ami", allowance: 0, taxable: 5_000, cashGiftUsed: null });
  });
});
