import { fetchIrl } from "./sources/irl";
import { describe, expect, it } from "vitest";
import { defaultFetcher } from "./http";
import { fetchFrom, fetchLongHistory, searchAssets } from "./index";
import { fetchComposition, findComposition } from "./compositions/composition";

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
  it("recherche d'un ETF par nom : l'ISIN revient, et ses cours avec", async () => {
    const { candidates } = await searchAssets(defaultFetcher, "CW8");
    const etf = candidates.find((c) => c.kind === "etf" && c.isin);
    expect(etf?.isin).toBe("LU1681043599");
    const { quotes, dividends } = await fetchLongHistory(defaultFetcher, "justetf", { ...base, kind: "etf", isin: etf!.isin }, today);
    expect(dividends).toBe(true);
    expect(quotes[0]!.date < "2019-01-01").toBe(true);
    expect(quotes.every((q, i) => i === 0 || quotes[i - 1]!.date < q.date)).toBe(true);
    // La valeur dividendes réinvestis ne doit pas finir sur un cours brut d'une autre échelle.
    expect(Math.abs(quotes.at(-1)!.price / quotes.at(-2)!.price - 1)).toBeLessThan(0.1);
  }, 30_000);
  it("historique long : Euronext et CoinGecko", async () => {
    const stock = await fetchLongHistory(defaultFetcher, "euronext", { ...base, kind: "action", isin: "FR0000120073" }, today);
    expect(stock.quotes.length).toBeGreaterThan(300);
    const btc = await fetchLongHistory(defaultFetcher, "coingecko", { ...base, kind: "crypto", symbol: "bitcoin" }, today);
    expect(btc.quotes.length).toBeGreaterThan(300);
  }, 30_000);
  it("historique long Yahoo : au mieux (peut être refusé selon le réseau)", async () => {
    try {
      const { quotes } = await fetchLongHistory(defaultFetcher, "yahoo", { ...base, kind: "action", symbol: "TTE.PA" }, today);
      expect(quotes.length).toBeGreaterThan(1000);
    } catch (e) {
      console.warn("Yahoo indisponible :", (e as Error).message);
    }
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

describe.runIf(process.env.HAMAC_LIVE)("indice des loyers de l'INSEE, en réel", () => {
  it("trois zones, chacune avec un indice récent et sa date de publication", async () => {
    const data = await fetchIrl(defaultFetcher, null, new Date().toISOString());
    for (const zone of ["metropole", "corse", "outremer"] as const) {
      const last = [...data.series[zone]].sort((a, b) => a.quarter.localeCompare(b.quarter)).at(-1)!;
      expect(last.value).toBeGreaterThan(100);
      expect(last.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  }, 40_000);
});

describe.skipIf(!live)("compositions réelles des ETF", () => {
  const total = (c: { lines: Array<{ weight: number }> }) => c.lines.reduce((s, l) => s + l.weight, 0);
  it("Amundi : ETF physique complet, ETF à swap reconnu", async () => {
    const world = await findComposition(defaultFetcher, "IE000BI8OT95");
    expect(world).toMatchObject({ issuer: "amundi", replication: "physique" });
    expect(world!.lines.length).toBeGreaterThan(1000);
    expect(total(world!)).toBeGreaterThan(0.95);
    expect(world!.lines.filter((l) => l.kind === "action").every((l) => l.country)).toBe(true);
    const cw8 = await findComposition(defaultFetcher, "LU1681043599");
    expect(cw8).toMatchObject({ issuer: "amundi", replication: "synthetique" });
  }, 60_000);
  it("iShares : ISIN → numéro de produit → CSV, physique et à swap", async () => {
    const swda = await findComposition(defaultFetcher, "IE00B4L5Y983");
    expect(swda).toMatchObject({ issuer: "ishares", issuerId: "251882", replication: "physique" });
    expect(swda!.lines.length).toBeGreaterThan(1000);
    expect(total(swda!)).toBeGreaterThan(0.95);
    const swap = await fetchComposition(defaultFetcher, { issuer: "ishares", issuerId: "335184" });
    expect(swap.replication).toBe("synthetique");
    const bonds = await findComposition(defaultFetcher, "IE00B3F81R35");
    expect(bonds!.lines.filter((l) => l.kind === "obligation").length).toBeGreaterThan(1000);
  }, 90_000);
});
