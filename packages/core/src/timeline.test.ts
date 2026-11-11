import { describe, expect, it } from "vitest";
import type { Account, Asset, PricePoint, Transaction } from "./domain";
import type { EngineData } from "./engine";
import { buildHistory, type HistoryPoint } from "./history";
import { formatEur } from "./money";
import { defaultParams } from "./params";
import { compareSnapshots, expectedRates, milestones, monthByMonth, periodChange, planComparison, positionMove, thresholds } from "./timeline";

const acc = (id: string, kind: Account["kind"], over: Partial<Account> = {}): Account => ({ id, kind, livretType: null, name: id.toUpperCase(), institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...over });
const asset = (id: string): Asset => ({ id, kind: "etf", name: `ETF ${id}`, isin: null, symbol: null, priceSource: "auto", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false });
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({ id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra });
const price = (assetId: string, date: string, p: number): PricePoint => ({ assetId, date, price: p, source: "marche" });

const ASOF = "2025-08-31";

/** Montants fictifs : un livret vidé vers le PEA puis clôturé, un PEA avec versement programmé, un compte-titres soldé. */
function scenario(): EngineData {
  const params = defaultParams(new Date(2026, 10, 11));
  params.profile = { ...params.profile, birthYear: 1990, retirementAge: 65, securisationAge: 65, startMonth: "2025-01", contributionDay: 5 };
  return {
    params,
    accounts: [acc("livret", "livret", { archived: true }), acc("pea", "pea", { openedOn: "2024-12-15" }), acc("cto", "cto")],
    assets: [asset("a"), asset("b")],
    plans: [{ id: "p1", accountId: "pea", fromMonth: "2025-02", amount: 200, comment: "" }],
    skips: [],
    prices: [price("a", "2025-01-20", 100), price("a", "2025-03-31", 80), price("a", "2025-05-15", 88), price("a", "2025-06-30", 110), price("b", "2025-02-05", 50), price("b", "2025-06-10", 60)],
    transactions: [
      tx("2025-01-05", "apport_initial", "livret", 3_000),
      tx("2025-01-10", "versement", "pea", 20_000),
      tx("2025-01-20", "achat", "pea", 10_000, { assetId: "a", quantity: 100 }),
      tx("2025-02-01", "versement", "cto", 1_000),
      tx("2025-02-05", "achat", "cto", 500, { assetId: "b", quantity: 10 }),
      tx("2025-04-30", "dividende", "pea", 120, { assetId: "a" }),
      tx("2025-05-01", "transfert", "livret", 3_000, { counterAccountId: "pea" }),
      tx("2025-05-15", "achat", "pea", 2_200, { assetId: "a", quantity: 25 }),
      tx("2025-06-10", "vente", "cto", 600, { assetId: "b", quantity: 10 }),
      tx("2025-07-01", "frais", "pea", 15),
      tx("2025-07-20", "retrait", "cto", 1_100),
    ],
  };
}

const at = (history: readonly HistoryPoint[], month: string) => history.find((h) => h.month === month)!;

describe("ce qui s'est passé entre deux dates", () => {
  const data = scenario();
  const history = buildHistory(data, ASOF);
  const all = data.accounts.map((a) => a.id);
  const balance = (c: ReturnType<typeof periodChange>) => c.startValue + c.flows.deposits - c.flows.withdrawals + c.flows.transfersIn - c.flows.transfersOut + c.sources.total;

  it("sur tout le patrimoine : départ + versements − retraits + gain = arrivée, les transferts internes s'annulent", () => {
    const c = periodChange(data, at(history, "2025-02"), at(history, "2025-08"), all);
    // Versements programmés de mars à août (6 × 200) ; seul retrait : 1 100 du compte-titres.
    expect(c.flows.deposits).toBe(1_200);
    expect(c.flows.withdrawals).toBe(1_100);
    expect(c.flows.transfersIn).toBe(0);
    expect(c.flows.transfersOut).toBe(0);
    expect(c.sources.dividends).toBe(120);
    expect(c.sources.billedFees).toBe(15);
    expect(c.endValue).toBe(at(history, "2025-08").value);
    expect(balance(c)).toBeCloseTo(c.endValue, 6);
  });

  it("depuis le tout début, sur un seul compte, le transfert reçu compte comme argent apporté", () => {
    const c = periodChange(data, null, at(history, "2025-08"), ["pea"]);
    expect(c.startValue).toBe(0);
    // 20 000 versés + 7 × 200 programmés (février à août).
    expect(c.flows.deposits).toBe(21_400);
    expect(c.flows.transfersIn).toBe(3_000);
    expect(balance(c)).toBeCloseTo(c.endValue, 6);
    const livret = periodChange(data, at(history, "2025-01"), at(history, "2025-08"), ["livret"]);
    expect(livret.flows.transfersOut).toBe(3_000);
    expect(livret.endValue).toBe(0);
    expect(balance(livret)).toBeCloseTo(0, 6);
  });
});

describe("la situation à deux dates", () => {
  const data = scenario();
  const history = buildHistory(data, ASOF);

  it("classe chaque ligne de titres d'après son prix de revient", () => {
    expect(positionMove(null, { cost: 10 })).toBe("nouveau");
    expect(positionMove({ cost: 10 }, null)).toBe("vendu");
    expect(positionMove({ cost: 1_000 }, { cost: 1_000.4 })).toBe("inchange");
    expect(positionMove({ cost: 1_000 }, { cost: 1_200 })).toBe("renforce");
    expect(positionMove({ cost: 1_000 }, { cost: 600 })).toBe("allege");

    const cmp = compareSnapshots(at(history, "2025-03"), at(history, "2025-08"));
    const move = (key: string) => cmp.positions.find((p) => `${p.accountId}:${p.assetId}` === key)?.move;
    expect(move("pea:a")).toBe("renforce");
    expect(move("cto:b")).toBe("vendu");
    expect(compareSnapshots(null, at(history, "2025-03")).positions.every((p) => p.move === "nouveau")).toBe(true);
  });

  it("garde un compte clôturé dans les totaux et les écarts par compte", () => {
    const cmp = compareSnapshots(at(history, "2025-01"), at(history, "2025-08"));
    const livret = cmp.accounts.find((a) => a.accountId === "livret")!;
    expect(livret.startValue).toBe(3_000);
    expect(livret.endValue).toBe(0);
    expect(livret.contribChange).toBe(-3_000);
    expect(livret.gainChange).toBe(0);
    // Gain total = valeur − argent versé net, comptes clôturés compris.
    expect(cmp.end.gain).toBeCloseTo(cmp.end.value - cmp.end.netContrib, 6);
    const shares = cmp.buckets.reduce((t, b) => t + b.endShare, 0);
    expect(shares).toBeCloseTo(1, 10);
  });
});

describe("grandes étapes", () => {
  const data = scenario();
  const history = buildHistory(data, ASOF);
  const list = milestones(data, history, ASOF);
  const ids = list.map((m) => m.id);

  it("paliers de 1, 2 et 5", () => {
    expect(thresholds(60_000)).toEqual([1_000, 2_000, 5_000, 10_000, 20_000, 50_000]);
    expect(thresholds(999)).toEqual([]);
  });

  it("ouvertures (date saisie en priorité), clôture d'un compte archivé, titres achetés et vendus", () => {
    expect(list.find((m) => m.id === "ouverture:pea")!.date).toBe("2024-12-15");
    expect(list.find((m) => m.id === "ouverture:livret")!.date).toBe("2025-01-05");
    expect(list.find((m) => m.id === "cloture:livret")!.date).toBe("2025-05-01");
    expect(ids).not.toContain("cloture:pea");
    expect(list.filter((m) => m.id.startsWith("achat:")).map((m) => m.id)).toEqual(["achat:a", "achat:b"]);
    expect(list.filter((m) => m.id.startsWith("vente:")).map((m) => m.date)).toEqual(["2025-06-10"]);
  });

  it("un seul palier par mois, le plus haut ; gros versements seulement au-delà du seuil", () => {
    // Janvier : 3 000 + 20 000 → paliers 1 000 à 20 000 franchis le même mois, seul 20 000 apparaît.
    const paliers = list.filter((m) => m.category === "paliers");
    expect(paliers.map((m) => m.id)).toEqual(["palier:20000"]);
    const moves = list.filter((m) => m.category === "mouvements");
    expect(moves.map((m) => m.title)).toEqual([`Versement de ${formatEur(20_000, { compact: true })}`]);
  });

  it("plus forte baisse des placements : point bas puis rattrapage", () => {
    const low = list.find((m) => m.id === "baisse")!;
    expect(low.month).toBe("2025-03");
    expect(list.find((m) => m.id === "rattrapage")?.month).toBe("2025-06");
  });

  it("triées par date, rien après la date du jour", () => {
    expect([...list].sort((a, b) => a.date.localeCompare(b.date)).map((m) => m.id)).toEqual(ids);
    expect(milestones(data, history, "2025-01-31").every((m) => m.date <= "2025-01-31")).toBe(true);
  });
});

describe("mois par mois", () => {
  const data = scenario();
  const history = buildHistory(data, ASOF);

  it("chaque mois de la période : argent apporté net et gain, qui redonnent la cascade", () => {
    const months = monthByMonth(data, history, "2025-02", "2025-08");
    expect(months.map((m) => m.month)).toEqual(["2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08"]);
    // Mars : seulement le versement programmé ; juillet : 200 programmés, 1 100 retirés.
    expect(months[0]!.money).toBe(200);
    expect(months[4]!.money).toBe(-900);
    expect(months[4]!.deposits).toBe(200);
    const whole = periodChange(data, at(history, "2025-02"), at(history, "2025-08"), data.accounts.map((a) => a.id));
    expect(months.reduce((t, m) => t + m.money, 0)).toBeCloseTo(whole.flows.deposits - whole.flows.withdrawals, 6);
    expect(months.reduce((t, m) => t + m.gain, 0)).toBeCloseTo(whole.sources.total, 6);
  });

  it("depuis le tout début : le premier mois part de zéro", () => {
    const months = monthByMonth(data, history, null, "2025-01");
    expect(months).toHaveLength(1);
    expect(months[0]!.money).toBe(23_000);
  });
});

describe("par rapport au plan", () => {
  it("sans rendement attendu : le plan, c'est la valeur de départ plus le calendrier des versements", () => {
    const data = scenario();
    data.params.returns = { ...data.params.returns, livrets: 0, fondsEuros: 0, obligations: 0, actions: 0 };
    const history = buildHistory(data, ASOF);
    const p = planComparison(data, history, "2025-02", "2025-08")!;
    expect(p.plannedMoney).toBe(1_200);
    expect(p.expectedEnd).toBeCloseTo(at(history, "2025-02").value + 1_200, 6);
    expect(p.expectedGain).toBeCloseTo(0, 6);
    // 1 200 programmés, 1 100 retirés : 1 100 de moins que prévu.
    expect(p.actualMoney).toBe(100);
    expect(p.moneyGap).toBe(-1_100);
    expect(p.gainGap).toBeCloseTo(p.actualGain, 6);
    expect(p.moneyGap + p.gainGap).toBeCloseTo(p.gap, 6);
    expect(p.path[0]).toEqual({ month: "2025-02", expected: at(history, "2025-02").value, actual: at(history, "2025-02").value });
    expect(p.path.at(-1)!.actual).toBe(p.actualEnd);
  });

  it("avec un rendement attendu : chaque classe grandit à son taux, mois après mois", () => {
    const data = scenario();
    data.params.returns = { ...data.params.returns, livrets: 0, fondsEuros: 0, obligations: 0, actions: 0.12 };
    const history = buildHistory(data, ASOF);
    const p = planComparison(data, history, "2025-07", "2025-08")!;
    const start = at(history, "2025-07");
    // Un mois : la valeur des actions grandit de (1,12)^(1/12) − 1, puis les 200 € du mois s'ajoutent.
    const growth = start.buckets.croissance * (Math.pow(1.12, 1 / 12) - 1);
    expect(p.expectedEnd).toBeCloseTo(start.value + growth + 200, 1);
    expect(p.moneyGap + p.gainGap).toBeCloseTo(p.gap, 6);
  });

  it("depuis le tout début : les apports initiaux font partie du plan, pas de l'épargne en plus", () => {
    const data = scenario();
    data.params.returns = { ...data.params.returns, livrets: 0, fondsEuros: 0, obligations: 0, actions: 0 };
    const history = buildHistory(data, ASOF);
    const p = planComparison(data, history, null, "2025-01")!;
    // Janvier : 3 000 d'apport initial sur le livret (prévu), 20 000 versés en plus.
    expect(p.plannedMoney).toBe(3_000);
    expect(p.moneyGap).toBe(20_000);
  });

  it("rendements des classes : réglages de la projection, puis ceux de la répartition cible", () => {
    const data = scenario();
    data.params.targets = data.params.targets.map((l) => (l.key === "crowdlending" ? { ...l, expectedReturn: 0.07 } : l));
    const r = expectedRates(data.params);
    expect(r.croissance).toBe(data.params.returns.actions);
    expect(r.crowdlending).toBe(0.07);
    expect(r.speculatif).toBeNull();
  });
});
