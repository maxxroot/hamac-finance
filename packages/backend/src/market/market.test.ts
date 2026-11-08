import { afterEach, describe, expect, it } from "vitest";
import { createBackend, type Backend } from "../index";
import type { Fetcher } from "./http";
import { assertPublicUrl, readPath, toPrice } from "./custom";
import { parseEuronextCsv } from "./euronext";
import { chainFor, defaultProviderSettings, parseBondTicker, searchAssets } from "./index";
import { assertPlausible } from "./refresh";
import { refreshIntervalMinutes, TD_SAFE_LIMIT, TwelveDataBudget, twelveDataSymbol } from "./twelvedata";

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
afterEach(() => {
  backend?.close();
  backend = null;
});

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

  const base = { id: "a", name: "x", isin: null, symbol: null, priceSource: "auto" as const, priceProvider: null, priceUrl: null, pricePath: null, classId: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, issuer: null, bondKind: null, archived: false };
  const order = defaultProviderSettings();

  it("construit la chaîne de sources selon le titre", () => {
    expect(chainFor({ ...base, kind: "etf", isin: "FR0011871128" }, order, false).chain).toEqual(["justetf", "euronext"]);
    expect(chainFor({ ...base, kind: "action", isin: "FR0000120073", symbol: "AI.PA" }, order, true).chain).toEqual(["euronext", "twelvedata", "yahoo"]);
    expect(chainFor({ ...base, kind: "action", symbol: "TTE.PA" }, order, false).chain).toEqual(["yahoo"]);
    expect(chainFor({ ...base, kind: "crypto", symbol: "bitcoin" }, order, false).chain).toEqual(["coingecko"]);
    expect(chainFor({ ...base, kind: "obligation", priceSource: "modele" }, order, false).chain).toEqual([]);
  });

  it("source désactivée, source imposée, adresse personnalisée", () => {
    const sansEuronext = order.map((o) => (o.id === "euronext" ? { ...o, enabled: false } : o));
    expect(chainFor({ ...base, kind: "etf", isin: "FR0011871128" }, sansEuronext, false).chain).toEqual(["justetf"]);
    expect(chainFor({ ...base, kind: "etf", isin: "FR0011871128", priceProvider: "euronext" }, sansEuronext, false).chain).toEqual(["euronext"]);
    expect(chainFor({ ...base, kind: "action", symbol: "X", priceProvider: "twelvedata" }, order, false).reason).toMatch(/Clé Twelve Data/);
    expect(chainFor({ ...base, kind: "action", symbol: "X", priceUrl: "https://a.fr/x", pricePath: "p" }, order, false).chain).toEqual(["url", "yahoo"]);
  });

  it("lit l'historique CSV d'Euronext", () => {
    const csv = '\ufeff"Historical Data"\nLU1681043599\nDate;Open;High;Low;Last;Close;"Number of Shares"\n06/11/2026;683.48;692.33;683.48;692.33;692.40;1047\n05/11/2026;709.47;711.69;686.46;692.87;;621\n';
    expect(parseEuronextCsv(csv)).toEqual([{ date: "2026-11-05", price: 692.87 }, { date: "2026-11-06", price: 692.4 }]);
  });

  it("Twelve Data : l'intervalle garde le pire cas sous le quota journalier", () => {
    expect(refreshIntervalMinutes(0)).toBe(30);
    expect(refreshIntervalMinutes(5)).toBe(30);
    for (const n of [1, 15, 16, 30, 80, 200, 760]) {
      const passages = Math.floor(1440 / refreshIntervalMinutes(n));
      expect(passages * n).toBeLessThanOrEqual(TD_SAFE_LIMIT);
    }
    expect(twelveDataSymbol("AI.PA")).toEqual({ symbol: "AI", mic: "XPAR" });
    expect(twelveDataSymbol("AAPL")).toEqual({ symbol: "AAPL", mic: null });
  });

  it("Twelve Data : compteur journalier et limite par minute", async () => {
    let now = Date.parse("2026-11-08T10:00:00Z");
    const waits: number[] = [];
    const b = new TwelveDataBudget("cle-budget", { day: "2026-11-08", used: TD_SAFE_LIMIT - 9 }, () => now, async (ms) => {
      waits.push(ms);
      now += ms;
    });
    for (let i = 0; i < 8; i++) await b.acquire();
    expect(waits).toEqual([]);
    await b.acquire();
    expect(waits.length).toBe(1);
    expect(b.usage.used).toBe(TD_SAFE_LIMIT);
    await expect(b.acquire()).rejects.toThrow(/Quota/);
    now += 86_400_000;
    await b.acquire();
    expect(b.usage).toMatchObject({ day: "2026-11-09", used: 1 });
  });

  it("écarte un cours incohérent venant d'une autre source", () => {
    const last = { date: "2026-11-05", price: 100, source: "justetf" };
    const q = [{ date: "2026-11-06", price: 140 }];
    expect(() => assertPlausible({ kind: "etf" }, "euronext", q, last)).toThrow(/incohérent/);
    expect(() => assertPlausible({ kind: "etf" }, "justetf", q, last)).not.toThrow();
    expect(() => assertPlausible({ kind: "etf" }, "euronext", [{ date: "2026-11-06", price: 104 }], last)).not.toThrow();
    expect(() => assertPlausible({ kind: "crypto" }, "coingecko", q, last)).not.toThrow();
  });

  it("URL personnalisée : chemin du prix, nombres à la française, réseau interne refusé", async () => {
    expect(readPath({ data: [{ close: 12 }] }, "data.0.close")).toBe(12);
    expect(toPrice("1 234,5")).toBe(1234.5);
    expect(toPrice("n/a")).toBeNull();
    await expect(assertPublicUrl("http://exemple.fr/x")).rejects.toThrow(/https/);
    await expect(assertPublicUrl("https://127.0.0.1/x")).rejects.toThrow(/privé/);
    await expect(assertPublicUrl("https://169.254.169.254/latest")).rejects.toThrow(/privé/);
    await expect(assertPublicUrl("https://[::1]/x")).rejects.toThrow(/privé/);
    await expect(assertPublicUrl("https://1.1.1.1/x")).resolves.toBeUndefined();
  });

  it("repli : si la première source échoue, la suivante répond", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [y, m, d] = today.split("-");
    const f = (async (url: string) => {
      if (/justetf/.test(url)) return new Response("panne", { status: 500 });
      if (/searchJSON/.test(url)) return new Response(JSON.stringify([{ isin: "FR0011871128", mic: "XOSL" }, { isin: "FR0011871128", mic: "XPAR" }]));
      if (/getFullDownloadAjax\/FR0011871128-XPAR/.test(url)) return new Response(`Date;Open;High;Low;Last;Close\n${d}/${m}/${y};1;1;1;42;42.5\n`);
      return new Response("introuvable", { status: 404 });
    }) as Fetcher;
    backend = createBackend({ databasePath: ":memory:", mode: "desktop", appVersion: "test", backupsDir: null, fetcher: f });
    const etf = await call<{ id: string }>(backend, "assets.upsert", { kind: "etf", name: "S&P 500", isin: "FR0011871128", priceSource: "auto" });
    const status = await call<{ updated: number; errors: unknown[]; assets: Array<{ provider: string; tried: Array<{ provider: string }> }> }>(backend, "prices.refresh");
    expect(status.errors).toEqual([]);
    expect(status.assets[0]).toMatchObject({ provider: "euronext", tried: [{ provider: "justetf" }] });
    const ws = await call<{ prices: Array<{ assetId: string; price: number; source: string }> }>(backend, "workspace.load");
    expect(ws.prices.find((p) => p.assetId === etf.id)).toMatchObject({ price: 42.5, source: "euronext" });
  });

  it("la clé Twelve Data ne sort ni vers l'interface ni dans une sauvegarde", async () => {
    backend = createBackend({ databasePath: ":memory:", mode: "desktop", appVersion: "test", backupsDir: null, fetcher: fakeFetcher([]) });
    const s = await call<{ twelveData: { configured: boolean; hint: string } }>(backend, "market.configure", { twelveDataKey: "cle-secrete-abcd" });
    expect(s.twelveData).toMatchObject({ configured: true, hint: "abcd" });
    expect(JSON.stringify(s)).not.toContain("cle-secrete");
    const dump = await call(backend, "data.export");
    expect(JSON.stringify(dump)).not.toContain("cle-secrete");
    await call(backend, "data.import", { dump, confirm: "REMPLACER" });
    expect((await call<{ twelveData: { configured: boolean } }>(backend, "market.settings")).twelveData.configured).toBe(true);
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
