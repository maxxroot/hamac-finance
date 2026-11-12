import { describe, expect, it } from "vitest";
import type { Account, Asset, PricePoint, Transaction } from "./domain";
import { computePortfolio, type EngineData } from "./engine";
import { buildHistory } from "./history";
import { defaultParams } from "./params";
import { assetPerformance } from "./performance";
import { cryptoTax } from "./taxes";
import { validateTransaction } from "./validation";

const acc = (id: string, kind: Account["kind"], extra: Partial<Account> = {}): Account => ({
  id, kind, livretType: null, name: id, institutionId: null, openedOn: "2020-01-15", depositCeiling: null, rate: null, role: "",
  beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false, ...extra,
});
const asset = (id: string, kind: Asset["kind"], extra: Partial<Asset> = {}): Asset => ({
  id, kind, name: id, isin: null, symbol: null, priceSource: kind === "fonds_euros" ? "modele" : "auto", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null,
  targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false, ...extra,
});
let n = 0;
const tx = (date: string, type: Transaction["type"], accountId: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, date, type, accountId, assetId: null, counterAccountId: null, amount, quantity: null, fee: null, comment: "", ...extra,
});
const price = (assetId: string, date: string, p: number): PricePoint => ({ assetId, date, price: p, source: "marche" });

function data(over: Partial<EngineData>): EngineData {
  const params = defaultParams(new Date(2026, 5, 30));
  params.profile = { ...params.profile, birthYear: 1985, startMonth: "2026-01" };
  return { params, accounts: [], assets: [], transactions: [], plans: [], skips: [], prices: [], ...over };
}
const ASOF = "2026-06-30";

describe("arbitrage dans un contrat", () => {
  const contract = (extra: Transaction[]) =>
    data({
      accounts: [acc("av", "assurance_vie", { defaultAssetId: "fe" })],
      assets: [asset("fe", "fonds_euros"), asset("fe2", "fonds_euros"), asset("etf", "etf")],
      transactions: [tx("2026-01-05", "versement", "av", 10_000), ...extra],
      prices: [price("etf", "2026-02-01", 100), price("etf", "2026-04-01", 120), price("etf", ASOF, 120)],
    });

  it("du fonds euros vers une unité de compte, puis retour : valeurs, prix de revient et gain réalisé", () => {
    const s = computePortfolio(
      contract([
        tx("2026-02-01", "arbitrage", "av", 2_000, { assetId: "fe", counterAssetId: "etf", counterQuantity: 20 }),
        tx("2026-04-01", "arbitrage", "av", 1_200, { assetId: "etf", quantity: 10, counterAssetId: "fe" }),
      ]),
      ASOF,
    );
    const av = s.accountById.get("av")!;
    const fe = av.positions.find((p) => p.asset.id === "fe")!;
    const etf = av.positions.find((p) => p.asset.id === "etf")!;
    expect(fe.value).toBe(9_200);
    expect([etf.quantity, etf.cost, etf.value]).toEqual([10, 1_000, 1_200]);
    expect(av.realizedGain).toBe(200);
    expect(av.cash).toBe(0);
    // Rien ne sort du contrat : le versé net ne bouge pas, et aucune cession n'est imposable.
    expect(av.netContrib).toBe(10_000);
    expect(av.value).toBe(10_400);
    expect(s.disposals).toEqual([]);
  });

  it("d'un fonds euros à un autre : les frais réduisent le montant reçu", () => {
    const av = computePortfolio(contract([tx("2026-03-01", "arbitrage", "av", 1_000, { assetId: "fe", counterAssetId: "fe2", fee: 10 })]), ASOF).accountById.get("av")!;
    expect(av.positions.find((p) => p.asset.id === "fe")!.value).toBe(9_000);
    expect(av.positions.find((p) => p.asset.id === "fe2")!.value).toBe(990);
    expect(av.fees).toBe(10);
    expect(av.value).toBe(9_990);
  });

  it("céder plus que détenu est signalé", () => {
    const s = computePortfolio(contract([tx("2026-03-01", "arbitrage", "av", 500, { assetId: "etf", quantity: 5, counterAssetId: "fe" })]), ASOF);
    expect(s.warnings.some((w) => w.startsWith("Arbitrage du 2026-03-01 : 5 « etf » cédés"))).toBe(true);
  });

  it("classement par titre : l'unité de compte reçue est achetée, puis vendue, à la valeur de l'échange", () => {
    const d = contract([
      tx("2026-02-01", "arbitrage", "av", 2_000, { assetId: "fe", counterAssetId: "etf", counterQuantity: 20 }),
      tx("2026-04-01", "arbitrage", "av", 1_200, { assetId: "etf", quantity: 10, counterAssetId: "fe" }),
    ]);
    const row = (x: EngineData) => assetPerformance(x, computePortfolio(x, ASOF), buildHistory(x, ASOF), ["av"], null).find((r) => r.assetId === "etf")!;
    // 200 € réalisés sur 10 parts, 200 € latents sur les 10 restantes.
    expect(row(d).gain).toBe(400);
    // Mêmes chiffres qu'un achat puis une vente, qui passent par le fonds euros par défaut.
    const trades = contract([
      tx("2026-02-01", "achat", "av", 2_000, { assetId: "etf", quantity: 20 }),
      tx("2026-04-01", "vente", "av", 1_200, { assetId: "etf", quantity: 10 }),
    ]);
    expect(row(d)).toEqual(row(trades));
  });
});

describe("arbitrage entre cryptos", () => {
  const wallet = (extra: Transaction[]) =>
    data({
      accounts: [acc("w", "crypto")],
      assets: [asset("btc", "crypto"), asset("eth", "crypto")],
      transactions: [tx("2026-01-05", "versement", "w", 30_000), tx("2026-01-05", "achat", "w", 30_000, { assetId: "btc", quantity: 1 }), ...extra],
      prices: [price("btc", "2026-03-01", 40_000), price("eth", "2026-03-01", 2_500), price("btc", ASOF, 40_000), price("eth", "2026-05-01", 3_000), price("eth", ASOF, 3_000)],
    });

  it("échanger une crypto contre une autre n'est pas une cession : prix total d'acquisition inchangé", () => {
    const d = wallet([tx("2026-03-01", "arbitrage", "w", 20_000, { assetId: "btc", quantity: 0.5, counterAssetId: "eth", counterQuantity: 8 })]);
    const report = cryptoTax(d, ASOF);
    expect(report.sales).toEqual([]);
    expect(report.remainingAcquisition).toBe(30_000);
    const w = computePortfolio(d, ASOF).accountById.get("w")!;
    expect(w.positions.find((p) => p.asset.id === "btc")).toMatchObject({ quantity: 0.5, cost: 15_000 });
    expect(w.positions.find((p) => p.asset.id === "eth")).toMatchObject({ quantity: 8, cost: 20_000, value: 24_000 });
    expect(computePortfolio(d, ASOF).disposals).toEqual([]);
  });

  it("la vente contre des euros qui suit est imposable, sur le prix total d'acquisition d'origine", () => {
    const d = wallet([
      tx("2026-03-01", "arbitrage", "w", 20_000, { assetId: "btc", quantity: 0.5, counterAssetId: "eth", counterQuantity: 8 }),
      tx("2026-05-01", "vente", "w", 24_000, { assetId: "eth", quantity: 8 }),
    ]);
    const [sale, ...rest] = cryptoTax(d, ASOF).sales;
    expect(rest).toEqual([]);
    // Portefeuille au 01/05 : 8 ETH à 3 000 € + 0,5 BTC à 40 000 € = 44 000 € ; part du PTA = 30 000 × 24 000 / 44 000.
    expect(sale!.portfolioValue).toBe(44_000);
    expect(sale!.acquisitionBefore).toBe(30_000);
    expect(sale!.attributed).toBeCloseTo((30_000 * 24_000) / 44_000, 2);
  });
});

describe("arbitrage : validation", () => {
  const accounts = new Map([acc("av", "assurance_vie"), acc("pea", "pea"), acc("w", "crypto"), acc("pee", "epargne_salariale"), acc("per", "per")].map((a) => [a.id, a]));
  const assets = new Map([asset("fe", "fonds_euros"), asset("etf", "etf"), asset("oat", "obligation"), asset("btc", "crypto"), asset("eth", "crypto"), asset("fcpe", "fonds")].map((a) => [a.id, a]));
  const check = (t: Partial<Transaction>) =>
    validateTransaction({ date: "2026-01-01", type: "arbitrage", accountId: "av", assetId: null, counterAccountId: null, amount: 1_000, quantity: null, fee: null, comment: "", ...t }, accounts, assets).map((e) => e.field);

  it("assurance-vie, PER, épargne salariale et crypto ; pas un PEA", () => {
    expect(check({ assetId: "fe", counterAssetId: "etf", counterQuantity: 10 })).toEqual([]);
    expect(check({ accountId: "per", assetId: "etf", quantity: 10, counterAssetId: "fe" })).toEqual([]);
    expect(check({ accountId: "w", assetId: "btc", quantity: 0.1, counterAssetId: "eth", counterQuantity: 2 })).toEqual([]);
    expect(check({ accountId: "pee", assetId: "fcpe", quantity: 3, counterAssetId: "etf", counterQuantity: 4 })).toEqual([]);
    expect(check({ accountId: "pea", assetId: "etf", quantity: 1, counterAssetId: "etf", counterQuantity: 1 })).toContain("type");
  });

  it("les deux supports, différents ; une quantité pour un titre, aucune pour un fonds euros", () => {
    expect(check({ counterAssetId: "etf", counterQuantity: 1 })).toEqual(["assetId"]);
    expect(check({ assetId: "fe" })).toEqual(["counterAssetId"]);
    expect(check({ accountId: "w", assetId: "btc", quantity: 1, counterAssetId: "btc", counterQuantity: 1 })).toEqual(["counterAssetId"]);
    expect(check({ assetId: "fe", quantity: 1_000, counterAssetId: "etf", counterQuantity: 1 })).toEqual(["quantity"]);
    expect(check({ assetId: "fe", counterAssetId: "etf" })).toEqual(["counterQuantity"]);
    expect(check({ assetId: "oat", quantity: 1_000, counterAssetId: "fe" })).toEqual(["assetId"]);
    expect(check({ accountId: "w", assetId: "btc", quantity: 1, counterAssetId: "fe" })).toEqual(["counterAssetId"]);
  });

  it("seul un arbitrage a une quantité reçue", () => {
    expect(check({ type: "versement", counterQuantity: 3 })).toEqual(["counterQuantity"]);
  });
});
