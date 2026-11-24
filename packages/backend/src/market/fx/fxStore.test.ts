import { afterEach, describe, expect, it } from "vitest";
import type { Backend } from "../../index";
import { ecbFake, testBackend, testMarket } from "../../testkit";
import { parseEcbCsv } from "../sources/ecb";

let backend: Backend | null = null;
afterEach(() => {
  backend?.close();
  backend = null;
});

const ok = async <T,>(p: Promise<{ ok: true; data: unknown } | { ok: false; error: { message: string } }>): Promise<T> => {
  const r = await p;
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
};

describe("taux de change de la BCE", () => {
  it("lit la réponse CSV de la BCE et ignore les lignes invalides", () => {
    const csv = "KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE\nEXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-11-12,1.1598\nEXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-11-13,NaN\n";
    expect(parseEcbCsv(csv)).toEqual([{ currency: "USD", date: "2026-11-12", rate: 1.1598 }]);
  });

  it("télécharge tout l'historique une fois, puis seulement les derniers jours, et pas l'euro", async () => {
    const fake = ecbFake({ USD: { "1999-01-04": 1.1789, "2026-11-12": 1.16, "2026-11-13": 1.17 } });
    const market = await testMarket(fake);
    await market.fx.ensure(["USD", "EUR", "XXX"]);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toContain("D.USD.EUR.SP00.A?startPeriod=1999-01-04");
    expect(await market.fx.rates(["USD"], "2026-11-13")).toEqual([
      { currency: "USD", date: "2026-11-12", rate: 1.16 },
      { currency: "USD", date: "2026-11-13", rate: 1.17 },
    ]);
    // Déjà à jour : la BCE n'est pas réinterrogée.
    await market.fx.ensure(["USD"]);
    expect(fake.calls).toHaveLength(1);
    await market.close();
  });

  it("un titre en dollars : devise enregistrée, taux livrés avec l'espace de travail", async () => {
    const fake = ecbFake({ USD: { "2026-11-12": 1.16, "2026-11-13": 1.17 } });
    backend = await testBackend({ market: await testMarket(fake) });
    const account = await ok<{ id: string }>(backend.dispatch("accounts.upsert", { kind: "cto", name: "CTO" }));
    const asset = await ok<{ id: string; currency: string }>(backend.dispatch("assets.upsert", { kind: "obligation", name: "US Treasury 4 % 2030", couponRate: 0.04, maturityDate: "2030-11-15", bondKind: "etat", issuerCountry: "US", currency: "USD" }));
    expect(asset.currency).toBe("USD");
    await ok(backend.dispatch("transactions.upsert", { date: "2026-11-13", type: "achat", accountId: account.id, assetId: asset.id, amount: 9000, quantity: 10000, fee: 1, fxRate: 1.09 }));
    const ws = await ok<{ transactions: Array<{ fxRate: number | null }>; fxRates: Array<{ currency: string; date: string; rate: number }> }>(backend.dispatch("workspace.load", undefined));
    expect(ws.transactions[0]!.fxRate).toBe(1.09);
    expect(ws.fxRates.map((r) => r.date)).toEqual(["2026-11-12", "2026-11-13"]);
  });

  it("refuse une devise inconnue ; un fonds euros et une crypto restent en euros", async () => {
    backend = await testBackend();
    expect((await backend.dispatch("assets.upsert", { kind: "etf", name: "ETF", currency: "XYZ" })).ok).toBe(false);
    const fund = await ok<{ currency: string }>(backend.dispatch("assets.upsert", { kind: "fonds_euros", name: "Fonds euros", currency: "USD" }));
    expect(fund.currency).toBe("EUR");
    const btc = await ok<{ currency: string }>(backend.dispatch("assets.upsert", { kind: "crypto", name: "Bitcoin", symbol: "bitcoin", currency: "USD" }));
    expect(btc.currency).toBe("EUR");
  });

  it("refuse un taux de change sur un titre en euros", async () => {
    backend = await testBackend();
    const account = await ok<{ id: string }>(backend.dispatch("accounts.upsert", { kind: "cto", name: "CTO" }));
    const etf = await ok<{ id: string }>(backend.dispatch("assets.upsert", { kind: "etf", name: "ETF" }));
    const r = await backend.dispatch("transactions.upsert", { date: "2026-11-13", type: "achat", accountId: account.id, assetId: etf.id, amount: 100, quantity: 1, fxRate: 1.1 });
    expect(r.ok).toBe(false);
  });
});
