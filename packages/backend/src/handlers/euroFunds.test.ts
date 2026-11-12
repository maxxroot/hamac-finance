import { afterEach, describe, expect, it } from "vitest";
import { computePortfolio, defaultParams, type Account, type Asset, type EngineData, type FundRate, type Transaction } from "@hamac/core";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations.generated";
import { enterTenant, rawFor } from "../db/postgres";
import type { Backend } from "../index";
import { pgliteProvider, testBackend } from "../testkit";

let backend: Backend | null = null;
afterEach(() => {
  backend?.close();
  backend = null;
});

async function call<T = unknown>(b: Backend, name: string, input?: unknown): Promise<T> {
  const r = await b.dispatch(name, input);
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
}
interface Ws {
  accounts: Account[];
  assets: Asset[];
  transactions: Transaction[];
  fundRates: FundRate[];
}
const ws = (b: Backend) => call<Ws>(b, "workspace.load");

describe("fonds euros : contrats", () => {
  it("un nouveau contrat reçoit son fonds euros ; les autres comptes n'en ont pas", async () => {
    backend = await testBackend();
    const av = await call<Account>(backend, "accounts.upsert", { kind: "assurance_vie", name: "Contrat A" });
    const per = await call<Account>(backend, "accounts.upsert", { kind: "per", name: "PER" });
    const pea = await call<Account>(backend, "accounts.upsert", { kind: "pea", name: "PEA" });
    const sansFonds = await call<Account>(backend, "accounts.upsert", { kind: "assurance_vie", name: "Tout en UC", defaultAssetId: null });
    const { assets } = await ws(backend);
    expect(assets.find((a) => a.id === av.defaultAssetId)).toMatchObject({ kind: "fonds_euros", name: "Fonds euros (Contrat A)", priceSource: "modele", isin: null });
    expect(assets.find((a) => a.id === per.defaultAssetId)?.kind).toBe("fonds_euros");
    expect(pea.defaultAssetId).toBeNull();
    expect(sansFonds.defaultAssetId).toBeNull();
    expect(assets).toHaveLength(2);
  });

  it("deux contrats du même assureur partagent un fonds ; modifier un contrat garde son fonds", async () => {
    backend = await testBackend();
    const a = await call<Account>(backend, "accounts.upsert", { kind: "assurance_vie", name: "Contrat A" });
    const b = await call<Account>(backend, "accounts.upsert", { kind: "assurance_vie", name: "Contrat B", defaultAssetId: a.defaultAssetId });
    expect(b.defaultAssetId).toBe(a.defaultAssetId);
    expect((await ws(backend)).assets).toHaveLength(1);
    const renamed = await call<Account>(backend, "accounts.upsert", { id: a.id, kind: "assurance_vie", name: "Contrat A bis" });
    expect(renamed.defaultAssetId).toBe(a.defaultAssetId);
    // Un ETF ne peut pas être le support par défaut.
    const etf = await call<Asset>(backend, "assets.upsert", { kind: "etf", name: "ETF Monde" });
    const refused = await backend.dispatch("accounts.upsert", { id: a.id, kind: "assurance_vie", name: "Contrat A", defaultAssetId: etf.id });
    expect(refused.ok).toBe(false);
  });

  it("prendre le fonds d'un autre contrat : l'argent et les taux servis le suivent, l'ancien fonds disparaît", async () => {
    backend = await testBackend();
    const a = await call<Account>(backend, "accounts.upsert", { kind: "assurance_vie", name: "Contrat A" });
    const b = await call<Account>(backend, "accounts.upsert", { kind: "assurance_vie", name: "Contrat B" });
    await call(backend, "transactions.upsert", { date: "2025-01-02", type: "versement", accountId: b.id, amount: 800 });
    await call(backend, "fundRates.set", { accountId: b.id, assetId: b.defaultAssetId, year: 2024, rate: 0.028 });
    const shared = await call<Account>(backend, "accounts.upsert", { id: b.id, kind: "assurance_vie", name: "Contrat B", defaultAssetId: a.defaultAssetId });
    expect(shared.defaultAssetId).toBe(a.defaultAssetId);
    const w = await ws(backend);
    expect(w.assets.map((x) => x.id)).toEqual([a.defaultAssetId]);
    expect(w.fundRates).toMatchObject([{ accountId: b.id, assetId: a.defaultAssetId, year: 2024, rate: 0.028 }]);
  });

  it("supprimer un contrat vide supprime son fonds euros, sauf s'il sert à un autre contrat", async () => {
    backend = await testBackend();
    const a = await call<Account>(backend, "accounts.upsert", { kind: "assurance_vie", name: "Contrat A" });
    const b = await call<Account>(backend, "accounts.upsert", { kind: "assurance_vie", name: "Contrat B", defaultAssetId: a.defaultAssetId });
    const c = await call<Account>(backend, "accounts.upsert", { kind: "assurance_vie", name: "Contrat C" });
    await call(backend, "accounts.delete", { id: c.id });
    await call(backend, "accounts.delete", { id: a.id });
    expect((await ws(backend)).assets.map((x) => x.id)).toEqual([b.defaultAssetId]);
  });

  it("taux servis par fonds euros ; un transfert garde son fonds d'arrivée", async () => {
    backend = await testBackend();
    const av = await call<Account>(backend, "accounts.upsert", { kind: "assurance_vie", name: "Contrat" });
    const livret = await call<Account>(backend, "accounts.upsert", { kind: "livret", livretType: "AUTRE", name: "Livret" });
    const second = await call<Asset>(backend, "assets.upsert", { kind: "fonds_euros", name: "Euro Fictif" });
    await call(backend, "fundRates.set", { accountId: av.id, assetId: av.defaultAssetId, year: 2025, rate: 0.025 });
    await call(backend, "fundRates.set", { accountId: av.id, assetId: second.id, year: 2025, rate: 0.031 });
    const etf = await call<Asset>(backend, "assets.upsert", { kind: "etf", name: "ETF Monde" });
    expect((await backend.dispatch("fundRates.set", { accountId: av.id, assetId: etf.id, year: 2025, rate: 0.02 })).ok).toBe(false);
    await call(backend, "transactions.upsert", { date: "2025-01-02", type: "versement", accountId: livret.id, amount: 1000 });
    await call(backend, "transactions.upsert", { date: "2025-02-01", type: "transfert", accountId: livret.id, counterAccountId: av.id, counterAssetId: second.id, amount: 400 });
    const w = await ws(backend);
    expect(w.fundRates.map((r) => [r.assetId, r.rate])).toEqual(expect.arrayContaining([[av.defaultAssetId, 0.025], [second.id, 0.031]]));
    expect(w.transactions.find((t) => t.type === "transfert")).toMatchObject({ counterAccountId: av.id, counterAssetId: second.id });
    await call(backend, "fundRates.delete", { accountId: av.id, assetId: second.id, year: 2025 });
    expect((await ws(backend)).fundRates.map((r) => r.assetId)).toEqual([av.defaultAssetId]);
  });
});

describe("PER assurantiel ou bancaire", () => {
  it("un PER bancaire n'a pas de fonds euros ; un PER est assurantiel par défaut", async () => {
    backend = await testBackend();
    const insured = await call<Account>(backend, "accounts.upsert", { kind: "per", name: "PER assureur" });
    const bank = await call<Account>(backend, "accounts.upsert", { kind: "per", perKind: "bancaire", name: "PER courtier" });
    const pea = await call<Account>(backend, "accounts.upsert", { kind: "pea", perKind: "bancaire", name: "PEA" });
    expect([insured.perKind, bank.perKind, pea.perKind]).toEqual(["assurantiel", "bancaire", null]);
    expect(insured.defaultAssetId).not.toBeNull();
    expect(bank.defaultAssetId).toBeNull();
  });

  it("un PER devenu bancaire perd son fonds euros inutilisé ; refusé s'il a déjà servi", async () => {
    backend = await testBackend();
    const a = await call<Account>(backend, "accounts.upsert", { kind: "per", name: "PER A" });
    const switched = await call<Account>(backend, "accounts.upsert", { id: a.id, kind: "per", perKind: "bancaire", name: "PER A" });
    expect(switched.defaultAssetId).toBeNull();
    expect((await ws(backend)).assets).toEqual([]);

    const b = await call<Account>(backend, "accounts.upsert", { kind: "per", name: "PER B" });
    await call(backend, "transactions.upsert", { date: "2025-01-02", type: "versement", accountId: b.id, assetId: b.defaultAssetId, amount: 500 });
    const refused = await backend.dispatch("accounts.upsert", { id: b.id, kind: "per", perKind: "bancaire", name: "PER B" });
    expect(refused.ok).toBe(false);
  });
});

describe("arbitrage", () => {
  it("s'enregistre avec ses deux supports et leurs quantités ; refusé sur un PEA", async () => {
    backend = await testBackend();
    const w = await call<Account>(backend, "accounts.upsert", { kind: "crypto", name: "Plateforme" });
    const pea = await call<Account>(backend, "accounts.upsert", { kind: "pea", name: "PEA" });
    const btc = await call<Asset>(backend, "assets.upsert", { kind: "crypto", name: "Bitcoin" });
    const eth = await call<Asset>(backend, "assets.upsert", { kind: "crypto", name: "Ether" });
    await call(backend, "transactions.upsert", { date: "2025-03-01", type: "arbitrage", accountId: w.id, assetId: btc.id, quantity: 0.1, counterAssetId: eth.id, counterQuantity: 2.5, amount: 5_000, fee: 4.5 });
    expect((await ws(backend)).transactions).toMatchObject([{ type: "arbitrage", assetId: btc.id, quantity: 0.1, counterAssetId: eth.id, counterQuantity: 2.5, amount: 5_000, fee: 4.5 }]);
    const etf = await call<Asset>(backend, "assets.upsert", { kind: "etf", name: "ETF" });
    const refused = await backend.dispatch("transactions.upsert", { date: "2025-03-01", type: "arbitrage", accountId: pea.id, assetId: etf.id, quantity: 1, counterAssetId: etf.id, counterQuantity: 1, amount: 100 });
    expect(refused.ok).toBe(false);
  });
});

describe("fonds euros : reprise des données", () => {
  it("migration : un fonds euros par contrat, support par défaut, taux rattachés", async () => {
    const provider = pgliteProvider();
    const session = await provider.session();
    await enterTenant(session, crypto.randomUUID());
    const raw = rawFor(session);
    await raw.exec("CREATE TABLE IF NOT EXISTS _hamac_migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    for (const m of migrations.filter((x) => x.tag < "0028")) {
      for (const statement of m.sql.split("--> statement-breakpoint")) if (statement.trim()) await raw.exec(statement);
      await raw.run("INSERT INTO _hamac_migrations (tag, applied_at) VALUES (?, ?)", [m.tag, "2026-01-01"]);
    }
    await raw.exec("INSERT INTO accounts (id, kind, name) VALUES ('av', 'assurance_vie', 'Contrat A'), ('per', 'per', 'PER'), ('pea', 'pea', 'PEA'), ('liv', 'livret', 'Livret')");
    await raw.exec("INSERT INTO fund_rates (account_id, year, rate) VALUES ('av', 2023, 0.025), ('av', 2024, 0.03), ('liv', 2024, 0.02)");
    await migrate(raw);
    expect(await raw.all("SELECT id, kind, name, price_source FROM assets ORDER BY id")).toEqual([
      { id: "fe-av", kind: "fonds_euros", name: "Fonds euros (Contrat A)", price_source: "modele" },
      { id: "fe-per", kind: "fonds_euros", name: "Fonds euros (PER)", price_source: "modele" },
    ]);
    expect(await raw.all("SELECT id, default_asset_id, per_kind FROM accounts ORDER BY id")).toEqual([
      { id: "av", default_asset_id: "fe-av", per_kind: null },
      { id: "liv", default_asset_id: null, per_kind: null },
      { id: "pea", default_asset_id: null, per_kind: null },
      // Ayant reçu un fonds euros, un PER existant est assurantiel (migration 0030).
      { id: "per", default_asset_id: "fe-per", per_kind: "assurantiel" },
    ]);
    // Le taux d'un livret n'avait pas de sens ici : il n'est pas repris.
    expect(await raw.all("SELECT account_id, asset_id, year FROM fund_rates ORDER BY year")).toEqual([
      { account_id: "av", asset_id: "fe-av", year: 2023 },
      { account_id: "av", asset_id: "fe-av", year: 2024 },
    ]);
    await provider.close();
  });

  it("restaure une sauvegarde d'avant les fonds euros : mêmes valeurs au centime", async () => {
    backend = await testBackend();
    const dump = {
      format: "hamac",
      version: 1,
      engine: "postgres",
      schemaVersion: "0027_abandoned_blonde_phantom",
      exportedAt: "x",
      appVersion: "test",
      tables: {
        accounts: [
          { id: "av", kind: "assurance_vie", name: "Contrat A", opened_on: "2020-01-15" },
          { id: "liv", kind: "livret", livret_type: "AUTRE", name: "Livret" },
        ],
        assets: [{ id: "etf", kind: "etf", name: "ETF Monde", price_source: "manuel" }],
        transactions: [
          { id: "t1", date: "2024-01-05", type: "versement", account_id: "av", amount_cents: 1_000_000 },
          { id: "t2", date: "2024-01-05", type: "versement", account_id: "liv", amount_cents: 300_000 },
          { id: "t3", date: "2024-02-01", type: "achat", account_id: "av", asset_id: "etf", amount_cents: 400_000, quantity: 40 },
          { id: "t4", date: "2024-06-01", type: "transfert", account_id: "liv", counter_account_id: "av", amount_cents: 120_000 },
          { id: "t5", date: "2024-12-31", type: "interets", account_id: "av", amount_cents: 18_240 },
          { id: "t6", date: "2025-03-01", type: "frais", account_id: "av", amount_cents: 1_250 },
        ],
        contribution_plans: [{ id: "p", account_id: "av", from_month: "2024-03", amount_cents: 15_000 }],
        fund_rates: [{ account_id: "av", year: 2024, rate: 0.026 }],
        prices: [{ asset_id: "etf", date: "2025-06-30", price: 112.5, source: "manuel" }],
      },
    };
    expect((await backend.dispatch("data.import", { dump, confirm: "REMPLACER" })).ok).toBe(true);
    const w = await call<EngineData & Ws>(backend, "workspace.load");
    const av = w.accounts.find((a) => a.id === "av")!;
    expect(av.defaultAssetId).toBe("fe-av");
    expect(w.fundRates).toEqual([{ accountId: "av", assetId: "fe-av", year: 2024, rate: 0.026, comment: "" }]);

    // Même calcul qu'avant : sans fonds euros, l'argent du contrat était ses espèces.
    const params = defaultParams(new Date(2025, 5, 30));
    const data: EngineData = { ...w, params: { ...params, profile: { ...params.profile, startMonth: "2024-01" } } };
    const legacy: EngineData = { ...data, accounts: data.accounts.map((a) => ({ ...a, defaultAssetId: null })), assets: data.assets.filter((a) => a.kind !== "fonds_euros") };
    const now = computePortfolio(data, "2025-06-30").accountById.get("av")!;
    const before = computePortfolio(legacy, "2025-06-30").accountById.get("av")!;
    expect([now.value, now.netContrib, now.gain, now.interests]).toEqual([before.value, before.netContrib, before.gain, before.interests]);
    expect(now.cash).toBe(0);
    expect(now.positions.find((p) => p.asset.id === "fe-av")?.value).toBe(before.cash);
  });
});
