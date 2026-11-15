import { afterEach, describe, expect, it } from "vitest";
import type { Backend } from "../index";
import { rawFor } from "../db/postgres";
import { testBackend, testMarket, testProvider } from "../testkit";
import { SharedMarket } from "./shared";
import type { Fetcher } from "./http";
import { assertPublicUrl, customQuote, guardedLookup, readPath, toPrice } from "./sources/custom";
import { euronextHistory, parseEuronextCsv } from "./sources/euronext";
import { withoutBondSuffix } from "./sources/openfigi";
import { chainFor, defaultProviderSettings, instrumentKey, parseBondTicker, searchAssets } from "./index";
import { assertPlausible } from "./plausible";
import { yahooRange } from "./sources/yahoo";
import { refreshIntervalMinutes, TD_DAILY_LIMIT, TD_SAFE_LIMIT, TwelveDataBudget, twelveDataSymbol } from "./sources/twelvedata";

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

  it("retire le suffixe de place d'un code obligataire, en temps linéaire", () => {
    expect(withoutBondSuffix("FRTR 3 05/25/33 OAT")).toBe("FRTR 3 05/25/33");
    expect(withoutBondSuffix("TTEFP 1.491 04/08/27  emtn")).toBe("TTEFP 1.491 04/08/27");
    expect(withoutBondSuffix("TTEFP V2 PERP")).toBe("TTEFP V2 PERP");
    expect(withoutBondSuffix(`X${" ".repeat(100_000)}FP`)).toBe("X");
  });

  const base = { id: "a", name: "x", isin: null, symbol: null, priceSource: "auto" as const, priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, archived: false };
  const order = defaultProviderSettings();

  it("construit la chaîne de sources selon le titre", () => {
    expect(chainFor({ ...base, kind: "etf", isin: "FR0011871128" }, order, false).chain).toEqual(["justetf", "euronext"]);
    expect(chainFor({ ...base, kind: "etc", isin: "IE00B4ND3602" }, order, false).chain).toEqual(["justetf", "euronext"]);
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

  it("Euronext : une ligne seulement à Amsterdam, possiblement en dollars, n'est pas utilisée", async () => {
    const f = (async () => new Response(JSON.stringify([{ isin: "IE00B4L5Y983", mic: "XAMS" }]))) as Fetcher;
    await expect(euronextHistory(f, "IE00B4L5Y983", "2026-01-01", "2026-02-01")).rejects.toThrow(/en euros/);
  });

  it("Yahoo : la période demandée couvre l'absence", () => {
    expect(yahooRange(null, "2026-11-08")).toBe("2y");
    expect(yahooRange("2026-11-05", "2026-11-08")).toBe("5d");
    expect(yahooRange("2026-09-20", "2026-11-08")).toBe("1y");
    expect(yahooRange("2024-01-01", "2026-11-08")).toBe("2y");
  });

  it("Twelve Data : l'intervalle garde le pire cas sous le quota journalier", () => {
    expect(refreshIntervalMinutes(0)).toBe(30);
    expect(refreshIntervalMinutes(5)).toBe(30);
    expect(refreshIntervalMinutes(0, 45)).toBe(45);
    expect(refreshIntervalMinutes(100)).toBe(190);
    expect(refreshIntervalMinutes(100, 30, 8000)).toBe(30);
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
    const b = new TwelveDataBudget("cle-budget", { day: "2026-11-08", used: TD_SAFE_LIMIT - 9 }, TD_DAILY_LIMIT, () => now, async (ms) => {
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

  it("URL personnalisée : la résolution DNS est revérifiée à la connexion", async () => {
    const look = (addresses: Array<{ address: string; family: number }>) =>
      new Promise<{ err: Error | null; address: unknown }>((done) => guardedLookup((async () => addresses) as never)("exemple.fr", { all: true }, (err, address) => done({ err, address })));
    expect((await look([{ address: "93.184.216.34", family: 4 }])).err).toBeNull();
    expect((await look([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }])).err?.message).toMatch(/privé/);
    expect((await look([{ address: "::ffff:127.0.0.1", family: 6 }])).err?.message).toMatch(/privé/);
  });

  it("URL personnalisée : une réponse trop volumineuse est interrompue", async () => {
    const big = (async () => new Response("x".repeat(2_000_100))) as Fetcher;
    await expect(customQuote(big, { priceUrl: "https://a.fr/x", pricePath: "p", isin: null, symbol: null }, "2026-11-08", false)).rejects.toThrow(/volumineuse/);
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
    backend = await testBackend({ fetcher: f });
    const etf = await call<{ id: string }>(backend, "assets.upsert", { kind: "etf", name: "S&P 500", isin: "FR0011871128", priceSource: "auto" });
    const status = await call<{ updated: number; errors: unknown[]; assets: Array<{ provider: string; tried: Array<{ provider: string }> }> }>(backend, "prices.refresh");
    expect(status.errors).toEqual([]);
    expect(status.assets[0]).toMatchObject({ provider: "euronext", tried: [{ provider: "justetf" }] });
    const ws = await call<{ prices: Array<{ assetId: string; price: number; source: string }> }>(backend, "workspace.load");
    expect(ws.prices.find((p) => p.assetId === etf.id)).toMatchObject({ price: 42.5, source: "euronext" });
  });

  it("la clé Twelve Data vient du serveur et n'en sort jamais", async () => {
    const market = await testMarket(fakeFetcher([]), { twelveDataKey: "cle-secrete-abcd", twelveDataDailyLimit: 5000, refreshMinutes: 45 });
    backend = await testBackend({ market });
    const s = await call<{ twelveData: Record<string, unknown> }>(backend, "market.settings");
    expect(s.twelveData).toMatchObject({ configured: true, limit: 5000, intervalMinutes: 45 });
    expect(s.twelveData).not.toHaveProperty("hint");
    expect(JSON.stringify(s)).not.toMatch(/cle-secrete|abcd/);
    expect(JSON.stringify(await call(backend, "data.export"))).not.toContain("cle-secrete");
    expect((await backend.dispatch("market.configure", { twelveDataKey: "autre-cle-1234" })).ok).toBe(false);
    const stored = await rawFor(await testProvider().session()).all<{ key: string }>("SELECT key FROM marche.config");
    expect(stored.map((r) => r.key)).not.toContain("twelveDataKey");
  });

  it("efface une clé enregistrée en base par une version précédente", async () => {
    const db = rawFor(await testProvider().session());
    await testMarket(fakeFetcher([]));
    await db.run("INSERT INTO marche.config (key, value) VALUES ('twelveDataKey', '\"ancienne-cle\"')");
    await SharedMarket.open(testProvider(), fakeFetcher([]));
    expect(await db.get("SELECT key FROM marche.config WHERE key = 'twelveDataKey'")).toBeUndefined();
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

  const euronextHit = (isin: string, mic: string, name: string, ticker: string, section = "etfs") => ({ value: isin, isin, mic, link: `/en/product/${section}/${isin}-${mic}`, name: "CODE", label: `<span class='name'><a href='/en/product/${section}/${isin}-${mic}' style='color: #007aff !important;'>${name}</a></span><span class='symbol'>${ticker}</span><span class='mic'>${mic}</span>` });

  it("recherche par nom : Euronext donne l'ISIN, une ligne par titre, et écarte ce qu'on ne pourrait pas coter", async () => {
    const f = fakeFetcher([
      [/searchJSON/, [euronextHit("LU1681043599", "XPAR", "Amundi MSCI World Swap &amp; Co", "CW8"), euronextHit("LU1681043599", "ETFP", "Amundi MSCI World Swap &amp; Co", "CW8"), euronextHit("FR0000120271", "XPAR", "TotalEnergies", "TTE", "equities"), { value: "  ", isin: "", mic: "", label: "tout voir", link: "/en/search_instruments/msci" }]],
      [/openfigi.*search/, { data: [{ name: "AMUNDI MSCI WORLD ETF", ticker: "CW8", exchCode: "FP", securityType: "ETP" }, { name: "TOTALENERGIES SE", ticker: "TTE", exchCode: "FP", securityType2: "Common Stock" }] }],
    ]);
    const { candidates } = await searchAssets(f, "msci world");
    expect(candidates.map((c) => c.isin)).toEqual(["LU1681043599", "FR0000120271"]);
    expect(candidates[0]).toMatchObject({ source: "euronext", kind: "etf", name: "Amundi MSCI World Swap & Co", symbol: null, exchange: "XPAR" });
    expect(candidates[1]).toMatchObject({ kind: "action", symbol: "TTE.PA" });
  });

  it("recherche par nom : les ETC sont reconnus, les ETN sur crypto écartés", async () => {
    const f = fakeFetcher([
      [/searchJSON/, [euronextHit("FR0013416716", "XPAR", "AMUNDI PHYS GOLD", "GOLD", "etvs"), euronextHit("XS3438606090", "XPAR", "HANETCBTC1XPAR", "BTC1", "etvs")]],
      [/openfigi.*search/, { data: [] }],
    ]);
    const { candidates } = await searchAssets(f, "physical gold");
    expect(candidates.map((c) => [c.name, c.kind])).toEqual([["AMUNDI PHYS GOLD", "etc"]]);
    const byIsin = await searchAssets(fakeFetcher([[/openfigi.*mapping/, [{ data: [{ name: "ISHARES PHYSICAL GOLD ETC", ticker: "IGLN", exchCode: "LN", securityType: "ETP", securityType2: "Mutual Fund" }] }]]]), "IE00B4ND3602");
    expect(byIsin.candidates[0]).toMatchObject({ kind: "etc", isin: "IE00B4ND3602" });
  });

  it("recherche par nom : si Euronext tombe, le reste répond quand même", async () => {
    const f = fakeFetcher([[/openfigi.*search/, { data: [{ name: "AMUNDI MSCI WORLD ETF", ticker: "CW8", exchCode: "FP", securityType: "ETP" }] }]]);
    const { candidates, errors } = await searchAssets(f, "msci world");
    expect(candidates[0]).toMatchObject({ source: "openfigi", kind: "etf" });
    expect(errors[0]).toMatch(/Euronext/);
  });

  describe("historique de comparaison", () => {
    const etf = { kind: "etf" as const, isin: "IE00B4L5Y983", symbol: null };
    const justEtf = { latestQuote: { raw: 99 }, latestQuoteDate: "2026-11-06", series: [{ date: "2015-01-02", value: { raw: 100 } }, { date: "2020-01-02", value: { raw: 150 } }, { date: "2026-11-05", value: { raw: 300 } }] };

    it("demande tout l'historique dividendes inclus, sans y mêler le dernier cours brut, puis ne retélécharge pas", async () => {
      const f = fakeFetcher([[/justetf/, justEtf]]);
      backend = await testBackend({ fetcher: f });
      const s = await call<{ dividends: boolean; points: Array<{ date: string; price: number }> }>(backend, "market.series", etf);
      expect(s.dividends).toBe(true);
      expect(s.points.map((p) => p.price)).toEqual([100, 150, 300]);
      expect(f.calls[0]).toMatch(/includeDividends=true/);
      expect(f.calls[0]).toMatch(/dateFrom=2000-01-01/);
      await call(backend, "market.series", etf);
      expect(f.calls).toHaveLength(1);
    });

    it("n'ajoute rien au portefeuille", async () => {
      backend = await testBackend({ fetcher: fakeFetcher([[/justetf/, justEtf]]) });
      await call(backend, "market.series", etf);
      const ws = await call<{ assets: unknown[]; prices: unknown[] }>(backend, "workspace.load");
      expect(ws.assets).toHaveLength(0);
      expect(ws.prices).toHaveLength(0);
    });

    it("passe à la source suivante, en cours seul, et n'utilise pas Twelve Data", async () => {
      const csv = "06/01/2020;10;10;10;10;10\n06/01/2021;12;12;12;12;12\n";
      const f = (async (url: string) => {
        if (/searchJSON/.test(url)) return new Response(JSON.stringify([{ isin: "IE00B4L5Y983", mic: "ETFP" }]));
        if (/AwlHistoricalPrice/.test(url)) return new Response(csv);
        return new Response("introuvable", { status: 404 });
      }) as Fetcher;
      backend = await testBackend({ fetcher: f, market: await testMarket(f, { twelveDataKey: "cle" }) });
      const s = await call<{ dividends: boolean; points: unknown[] }>(backend, "market.series", { ...etf, symbol: "IWDA" });
      expect(s).toMatchObject({ dividends: false });
      expect(s.points).toHaveLength(2);
    });

    it("garde la source qui remonte le plus loin, et s'arrête dès que c'est suffisant", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const recent = `${new Date(Date.parse(today) - 500 * 86_400_000).toISOString().slice(0, 10)}`;
      const [y, m, d] = recent.split("-");
      const f = (async (url: string) => {
        if (/justetf/.test(url)) return new Response(JSON.stringify({ series: [{ date: recent, value: { raw: 10 } }, { date: today, value: { raw: 11 } }] }));
        if (/searchJSON/.test(url)) return new Response(JSON.stringify([{ isin: "IE00B4L5Y983", mic: "ETFP" }]));
        if (/AwlHistoricalPrice/.test(url)) return new Response(`${d}/${m}/${Number(y) - 7};5;5;5;5;5\n${d}/${m}/${y};6;6;6;6;6\n`);
        return new Response("introuvable", { status: 404 });
      }) as Fetcher;
      backend = await testBackend({ fetcher: f, market: await testMarket(f) });
      const s = await call<{ dividends: boolean; points: Array<{ date: string }> }>(backend, "market.series", etf);
      expect(s.dividends).toBe(false);
      expect(s.points[0]!.date.slice(0, 4)).toBe(String(Number(y) - 7));
    });

    it("signale un titre introuvable sans réinterroger les sources aussitôt", async () => {
      const f = fakeFetcher([]);
      backend = await testBackend({ fetcher: f });
      const first = await backend.dispatch("market.series", etf);
      expect(first).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
      const n = f.calls.length;
      await backend.dispatch("market.series", etf);
      expect(f.calls).toHaveLength(n);
    });

    it("refuse une demande sans ISIN ni symbole", async () => {
      backend = await testBackend({ fetcher: fakeFetcher([]) });
      expect(await backend.dispatch("market.series", { kind: "etf" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    });
  });

  it("actualisation : enregistre l'historique, ne remplace jamais un cours manuel, signale les erreurs", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const f = fakeFetcher([
      [/justetf/, { latestQuote: { raw: 59.44 }, latestQuoteDate: today, series: [{ date: "2026-10-01", value: { raw: 58 } }, { date: today, value: { raw: 59.44 } }] }],
      [/coingecko.*market_chart/, { prices: [[Date.parse(today), 68000]] }, 429],
    ]);
    backend = await testBackend({ fetcher: f });
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

describe("base de cours commune", () => {
  const today = new Date().toISOString().slice(0, 10);
  const etf = { kind: "etf", name: "S&P 500", isin: "FR0011871128", priceSource: "auto" };

  it("un même titre n'est téléchargé qu'une fois pour tous les tenants", async () => {
    let calls = 0;
    const f = (async (url: string) => {
      if (/justetf/.test(url)) {
        calls++;
        return new Response(JSON.stringify({ latestQuote: { raw: 59 }, latestQuoteDate: today, series: [{ date: today, value: { raw: 59 } }] }));
      }
      return new Response("introuvable", { status: 404 });
    }) as Fetcher;
    const market = await testMarket(f);
    const a = await testBackend({ fetcher: f, market });
    const b = await testBackend({ fetcher: f, market });
    await call(a, "assets.upsert", etf);
    await call(b, "assets.upsert", etf);
    await call(a, "prices.refresh");
    await call(b, "prices.refresh");
    expect(calls).toBe(1);
    for (const x of [a, b]) {
      const ws = await call<{ prices: Array<{ price: number }> }>(x, "workspace.load");
      expect(ws.prices).toHaveLength(1);
      expect(ws.prices[0]).toMatchObject({ price: 59 });
      x.close();
    }
  });

  it("une restauration ne modifie pas les cours des autres", async () => {
    const market = await testMarket(fakeFetcher([]));
    const a = await testBackend({ market });
    const b = await testBackend({ market });
    const assetA = await call<{ id: string }>(a, "assets.upsert", etf);
    await call(b, "assets.upsert", etf);
    const dump = await call<{ tables: Record<string, unknown[]> }>(a, "data.export");
    dump.tables.prices = [{ asset_id: assetA.id, date: "2026-01-31", price: 999, source: "justetf" }];
    await call(a, "data.import", { dump, confirm: "REMPLACER" });
    expect((await call<{ prices: unknown[] }>(a, "workspace.load")).prices).toHaveLength(1);
    expect((await call<{ prices: unknown[] }>(b, "workspace.load")).prices).toHaveLength(0);
    a.close();
    b.close();
  });

  it("seul l'administrateur règle les sources", async () => {
    const market = await testMarket(fakeFetcher([]), { twelveDataKey: "cle-secrete-abcd" });
    const admin = await testBackend({ market });
    const other = await testBackend({ market, isAdmin: false });
    const order = (await call<{ order: unknown[] }>(admin, "market.settings")).order;
    await call(admin, "market.configure", { order });
    expect((await other.dispatch("market.configure", { order })).ok).toBe(false);
    expect(await call(other, "market.settings")).toMatchObject({ canEdit: false, twelveData: { configured: true } });
    admin.close();
    other.close();
  });

  it("une adresse personnalisée reste propre à la personne", () => {
    const base = { kind: "etf", isin: "FR0011871128", symbol: null, priceSource: "auto", priceProvider: null, priceUrl: null, pricePath: null } as const;
    expect(instrumentKey(base)).toBe("etf|FR0011871128||auto");
    expect(instrumentKey({ ...base, symbol: "CW8.PA" })).not.toBe(instrumentKey({ ...base, symbol: "LCWD.L" }));
    expect(instrumentKey({ ...base, priceUrl: "https://a.fr/x", pricePath: "p" })).toBeNull();
  });
});
