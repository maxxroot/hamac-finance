import { describe, expect, it } from "vitest";
import { defaultFetcher } from "./http";
import { fetchFrom, searchAssets } from "./index";

/** Tests sur les vraies sources : HAMAC_LIVE=1 pnpm test */
const live = process.env.HAMAC_LIVE === "1";
const base = { id: "x", name: "x", isin: null, symbol: null, priceSource: "auto" as const, priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false };
const today = new Date().toISOString().slice(0, 10);
const env = { twelveDataKey: null, budget: null, web: false };

describe.skipIf(!live)("sources réelles", () => {
  it("justETF : cours d'un ETF PEA par ISIN", async () => {
    const q = await fetchFrom(defaultFetcher, "justetf", { ...base, kind: "etf", isin: "FR0011871128" }, null, today, env);
    expect(q.length).toBeGreaterThan(100);
    expect(q.at(-1)!.price).toBeGreaterThan(1);
  }, 30_000);
  it("Euronext : action de Paris par ISIN", async () => {
    const q = await fetchFrom(defaultFetcher, "euronext", { ...base, kind: "action", isin: "FR0000120073" }, null, today, env);
    expect(q.length).toBeGreaterThan(100);
    expect(q.at(-1)!.price).toBeGreaterThan(1);
  }, 30_000);
  it("URL personnalisée en mode web : une vraie adresse https répond", async () => {
    const q = await fetchFrom(defaultFetcher, "url", { ...base, kind: "action", priceUrl: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur", pricePath: "bitcoin.eur" }, null, today, { ...env, web: true });
    expect(q[0]!.price).toBeGreaterThan(1000);
  }, 30_000);
  it("CoinGecko : cours du bitcoin", async () => {
    const q = await fetchFrom(defaultFetcher, "coingecko", { ...base, kind: "crypto", symbol: "bitcoin" }, null, today, env);
    expect(q.at(-1)!.price).toBeGreaterThan(1000);
  }, 30_000);
  it("OpenFIGI : obligation par ISIN, action par nom", async () => {
    const bond = await searchAssets(defaultFetcher, "FR001400H7V7");
    expect(bond.candidates[0]).toMatchObject({ kind: "obligation", couponRate: 0.03 });
    const stock = await searchAssets(defaultFetcher, "totalenergies");
    expect(stock.candidates.some((c) => c.kind === "action" && c.symbol === "TTE.PA")).toBe(true);
  }, 30_000);
  it("Yahoo : au mieux (peut être refusé selon le réseau)", async () => {
    try {
      const q = await fetchFrom(defaultFetcher, "yahoo", { ...base, kind: "action", symbol: "TTE.PA" }, null, today, env);
      expect(q.length).toBeGreaterThan(0);
    } catch (e) {
      console.warn("Yahoo indisponible :", (e as Error).message);
    }
  }, 30_000);
});
