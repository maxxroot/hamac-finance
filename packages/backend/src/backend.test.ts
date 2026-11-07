import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackend, type Backend } from "./index";

let backend: Backend | null = null;
afterEach(() => backend?.close());

function memory() {
  backend = createBackend({ databasePath: ":memory:", mode: "desktop", appVersion: "test", backupsDir: null });
  return backend;
}

describe("backend", () => {
  it("applique les migrations et renvoie les infos système", async () => {
    const res = await memory().dispatch("system.info", undefined);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toMatchObject({ mode: "desktop", appVersion: "test" });
  });

  it("renvoie null pour un réglage jamais enregistré", async () => {
    expect(await memory().dispatch("settings.get", { key: "ui.lastRoute" })).toEqual({ ok: true, data: null });
  });

  it("enregistre et relit un réglage", async () => {
    const b = memory();
    expect(await b.dispatch("settings.set", { key: "ui.privacyMode", value: true })).toEqual({ ok: true });
    expect(await b.dispatch("settings.get", { key: "ui.privacyMode" })).toEqual({ ok: true, data: true });
  });

  it("refuse une entrée invalide et une procédure inconnue", async () => {
    const b = memory();
    const bad = await b.dispatch("settings.set", { key: "nimporte.quoi", value: 1 });
    expect(bad.ok === false && bad.error.code).toBe("VALIDATION");
    const unknown = await b.dispatch("rien.du.tout", {});
    expect(unknown.ok === false && unknown.error.code).toBe("NOT_FOUND");
  });

  it("crée une sauvegarde quotidienne sur disque", () => {
    const dir = mkdtempSync(join(tmpdir(), "hamac-"));
    backend = createBackend({
      databasePath: join(dir, "hamac.sqlite"),
      mode: "desktop",
      appVersion: "test",
      backupsDir: join(dir, "sauvegardes"),
    });
    expect(readdirSync(join(dir, "sauvegardes"))).toHaveLength(1);
  });
});

describe("données du plan", () => {
  async function call<T = unknown>(b: Backend, name: string, input?: unknown): Promise<T> {
    const res = await b.dispatch(name, input);
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res.data as T;
  }

  it("crée la structure type puis la refuse sur une base non vide", async () => {
    const b = memory();
    await call(b, "workspace.createStarter");
    const ws = await call<{ accounts: Array<{ name: string; kind: string }> }>(b, "workspace.load");
    expect(ws.accounts.map((a) => a.name)).toEqual(["LEP", "LDDS", "Livret A", "Assurance-vie", "Compte-titres", "PEA", "Crypto"]);
    const again = await b.dispatch("workspace.createStarter", undefined);
    expect(again.ok === false && again.error.code).toBe("CONFLICT");
  });

  it("enregistre une opération en centimes exacts et applique les règles métier", async () => {
    const b = memory();
    const pea = await call<{ id: string }>(b, "accounts.upsert", { kind: "pea", name: "PEA" });
    const etf = await call<{ id: string }>(b, "assets.upsert", { kind: "etf", name: "ETF S&P 500", isin: "fr0011871128" });
    const tx = await call<{ amount: number; fee: number }>(b, "transactions.upsert", {
      date: "2026-11-01", type: "achat", accountId: pea.id, assetId: etf.id, amount: 904.5, quantity: 18, fee: 4.5,
    });
    expect(tx).toMatchObject({ amount: 904.5, fee: 4.5 });

    const bad = await b.dispatch("transactions.upsert", { date: "2026-11-01", type: "achat", accountId: pea.id, amount: 10 });
    expect(bad.ok === false && bad.error.code).toBe("VALIDATION");

    const del = await b.dispatch("accounts.delete", { id: pea.id });
    expect(del.ok === false && del.error.code).toBe("CONFLICT");
  });

  it("normalise l'ISIN et refuse les doublons", async () => {
    const b = memory();
    const a = await call<{ isin: string }>(b, "assets.upsert", { kind: "etf", name: "A", isin: "fr0011871128" });
    expect(a.isin).toBe("FR0011871128");
    const dup = await b.dispatch("assets.upsert", { kind: "etf", name: "B", isin: "FR0011871128" });
    expect(dup.ok === false && dup.error.code).toBe("CONFLICT");
  });

  it("versements programmés : un plan par compte et par mois (mise à jour en place)", async () => {
    const b = memory();
    const lep = await call<{ id: string }>(b, "accounts.upsert", { kind: "livret", livretType: "LEP", name: "LEP" });
    await call(b, "plans.set", { accountId: lep.id, fromMonth: "2026-11", amount: 100 });
    await call(b, "plans.set", { accountId: lep.id, fromMonth: "2026-11", amount: 120 });
    const ws = await call<{ plans: Array<{ amount: number }> }>(b, "workspace.load");
    expect(ws.plans).toHaveLength(1);
    expect(ws.plans[0].amount).toBe(120);
  });

  it("valide les paramètres", async () => {
    const b = memory();
    const ws = await call<{ params: Record<string, unknown> }>(b, "workspace.load");
    const bad = await b.dispatch("params.update", { ...ws.params, profile: { ...(ws.params.profile as object), horizonAge: 50 } });
    expect(bad.ok === false && bad.error.code).toBe("VALIDATION");
  });
});

describe("jeu de démonstration", () => {
  it("se charge sans erreur sur une base vide, une seule fois", async () => {
    const { seedDemo } = await import("./demo");
    const b = memory();
    await seedDemo(b);
    await seedDemo(b);
    const res = await b.dispatch("workspace.load", undefined);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const ws = res.data as { accounts: unknown[]; transactions: unknown[]; plans: unknown[] };
      expect(ws.accounts).toHaveLength(7);
      expect(ws.transactions.length).toBeGreaterThan(15);
      expect(ws.plans.length).toBe(5);
    }
  });
});
