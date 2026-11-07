import { afterEach, describe, expect, it } from "vitest";
import { createBackend, type Backend } from "../index";
import type { Fetcher } from "./http";
import { parseBondTicker, providerFor, searchAssets } from "./index";

/** Faux réseau : répond selon l'URL, enregistre les appels. */
function fakeFetcher(routes: Array<[RegExp, unknown, number?]>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const route = routes.find(([re]) => re.test(url));
    if (!route) return new Response("introuvable", { status: 404 });
    return new Response(JSON.stringify(route[1]), { status: route[2] ?? 200, headers: { "Content-Type": "application/json" } });
  }) as Fetcher & { calls: string[] };
  f.calls = calls;
  return f;
}

let backend: Backend | null = null;
afterEach(() => backend?.close());

async function call<T = unknown>(b: Backend, name: string, input?: unknown): Promise<T> {
  const res = await b.dispatch(name, input);
  if (!res.ok) throw new Error(res.error.message);
  return res.data as T;
}

describe("sources de cours", () => {
  it("lit coupon et échéance dans un code obligataire OpenFIGI", () => {
    expect(parseBondTicker("FRTR 3 05/25/33 OAT")).toEqual({ couponRate: 0.03, maturityDate: "2033-05-25" });
    expect(parseBondTicker("TTEFP 1.491 04/08/27 EMTN")).toEqual({ couponRate: 0.01491, maturityDate: "2027-04-08" });
    expect(parseBondTicker("TTEFP V2 PERP")).toBeNull();
  });

  it("choisit le fournisseur selon le titre", () => {
    const base = { id: "a", name: "x", isin: null, symbol: null, priceSource: "auto" as const, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, issuer: null, archived: false };
    expect(providerFor({ ...base, kind: "etf", isin: "FR0011871128" })).toMatchObject({ provider: "justetf" });
    expect(providerFor({ ...base, kind: "action", symbol: "TTE.PA" })).toMatchObject({ provider: "yahoo" });
    expect(providerFor({ ...base, kind: "crypto", symbol: "bitcoin" })).toMatchObject({ provider: "coingecko" });
    expect(providerFor({ ...base, kind: "obligation", priceSource: "modele" })).toMatchObject({ provider: null });
  });

  it("recherche par ISIN : obligation reconnue et pré-remplie", async () => {
    const f = fakeFetcher([[/openfigi.*mapping/, [{ data: [{ name: "FRANCE (GOVT OF)", ticker: "FRTR 3 05/25/33 OAT", exchCode: "EURONEXT-PARIS", securityType2: "Govt", marketSector: "Govt" }] }]]]);
    const { candidates } = await searchAssets(f, "fr001400h7v7");
    expect(candidates[0]).toMatchObject({ kind: "obligation", isin: "FR001400H7V7", couponRate: 0.03, maturityDate: "2033-05-25" });
  });

  it("recherche par nom : action avec symbole Yahoo, crypto via CoinGecko", async () => {
    const f = fakeFetcher([
      [/openfigi.*search/, { data: [{ name: "TOTALENERGIES SE", ticker: "TTE", exchCode: "FP", securityType2: "Common Stock", marketSector: "Equity" }] }],
      [/coingecko.*search/, { coins: [{ id: "bitcoin", symbol: "btc", name: "Bitcoin" }] }],
    ]);
    const { candidates } = await searchAssets(f, "total");
    expect(candidates.find((c) => c.kind === "action")).toMatchObject({ symbol: "TTE.PA" });
    expect(candidates.find((c) => c.kind === "crypto")).toMatchObject({ symbol: "bitcoin" });
  });

  it("actualisation : enregistre l'historique, ne remplace jamais un cours manuel, signale les erreurs", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const f = fakeFetcher([
      [/justetf/, { latestQuote: { raw: 59.44 }, latestQuoteDate: today, series: [{ date: "2026-10-01", value: { raw: 58 } }, { date: today, value: { raw: 59.44 } }] }],
      [/coingecko.*market_chart/, { prices: [[Date.parse(today), 68000]] }, 429],
    ]);
    backend = createBackend({ databasePath: ":memory:", mode: "desktop", appVersion: "test", backupsDir: null, fetcher: f });
    const etf = await call<{ id: string }>(backend, "assets.upsert", { kind: "etf", name: "S&P 500", isin: "FR0011871128", priceSource: "auto" });
    await call(backend, "assets.upsert", { kind: "crypto", name: "Bitcoin", symbol: "bitcoin", priceSource: "auto" });
    await call(backend, "prices.setManual", { assetId: etf.id, date: today, price: 60 });

    const status = await call<{ updated: number; errors: Array<{ name: string; message: string }> }>(backend, "prices.refresh");
    expect(status.updated).toBe(1);
    expect(status.errors[0]).toMatchObject({ name: "Bitcoin" });
    expect(status.errors[0].message).toMatch(/Trop de requêtes/);

    const ws = await call<{ prices: Array<{ assetId: string; date: string; price: number; source: string }>; priceStatus: unknown }>(backend, "workspace.load");
    const mine = ws.prices.filter((p) => p.assetId === etf.id);
    expect(mine.find((p) => p.date === today)).toMatchObject({ price: 60, source: "manuel" });
    expect(mine.find((p) => p.date === "2026-10-01")).toMatchObject({ price: 58, source: "justetf" });
    expect(ws.priceStatus).not.toBeNull();
  });
});
