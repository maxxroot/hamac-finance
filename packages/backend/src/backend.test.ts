import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackend, type Backend } from "./index";

let backend: Backend | null = null;
afterEach(() => {
  backend?.close();
  backend = null;
});

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

  it("accepte des paramètres d'une interface plus ancienne (réglage absent → valeur par défaut)", async () => {
    const b = memory();
    const ws = await call<{ params: { profile: Record<string, unknown> } }>(b, "workspace.load");
    const { contributionDay: _omis, ...profile } = ws.params.profile;
    const saved = await call<{ profile: { contributionDay: number } }>(b, "params.update", { ...ws.params, profile });
    expect(saved.profile.contributionDay).toBe(1);
    const day = await call<{ profile: { contributionDay: number } }>(b, "params.update", { ...ws.params, profile: { ...profile, contributionDay: 12 } });
    expect(day.profile.contributionDay).toBe(12);
    const bad = await b.dispatch("params.update", { ...ws.params, profile: { ...profile, contributionDay: 40 } });
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
      expect(ws.accounts).toHaveLength(8);
      expect(ws.transactions.length).toBeGreaterThan(15);
      expect(ws.plans.length).toBe(5);
    }
  });
});

describe("sauvegarde et import", () => {
  async function call<T = unknown>(b: Backend, name: string, input?: unknown): Promise<T> {
    const res = await b.dispatch(name, input);
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res.data as T;
  }

  it("export puis import dans une autre base : données identiques", async () => {
    const { seedDemo } = await import("./demo");
    const a = memory();
    await seedDemo(a);
    const dump = await call<{ tables: Record<string, unknown[]> }>(a, "data.export");
    const before = await call<Record<string, unknown>>(a, "workspace.load");

    const b = createBackend({ databasePath: ":memory:", mode: "web", appVersion: "test", backupsDir: null });
    await call(b, "data.import", { dump, confirm: "REMPLACER" });
    const after = await call<Record<string, unknown>>(b, "workspace.load");
    expect(after.transactions).toEqual(before.transactions);
    expect(after.accounts).toEqual(before.accounts);
    expect(after.params).toEqual(before.params);
    b.close();
  });

  it("refuse un fichier qui n'est pas une sauvegarde, sans rien toucher", async () => {
    const b = memory();
    await call(b, "workspace.createStarter");
    const bad = await b.dispatch("data.import", { dump: { format: "autre" }, confirm: "REMPLACER" });
    expect(bad.ok).toBe(false);
    const ws = await call<{ accounts: unknown[] }>(b, "workspace.load");
    expect(ws.accounts).toHaveLength(7);
  });

  it("import groupé : lignes valides enregistrées, erreurs signalées par ligne", async () => {
    const b = memory();
    const lep = await call<{ id: string }>(b, "accounts.upsert", { kind: "livret", name: "LEP" });
    const res = await call<{ created: number; errors: Array<{ index: number }> }>(b, "transactions.bulkCreate", {
      items: [
        { date: "2026-01-01", type: "versement", accountId: lep.id, amount: 100 },
        { date: "2026-02-01", type: "achat", accountId: lep.id, amount: 100 },
        { date: "2026-03-01", type: "interets", accountId: lep.id, amount: 12.5 },
      ],
    });
    expect(res.created).toBe(2);
    expect(res.errors.map((e) => e.index)).toEqual([1]);
  });

  it("archiver un compte arrête ses versements programmés sans effacer le passé", async () => {
    const b = memory();
    const pea = await call<Record<string, unknown> & { id: string }>(b, "accounts.upsert", { kind: "pea", name: "PEA" });
    await call(b, "plans.set", { accountId: pea.id, fromMonth: "2020-01", amount: 200 });
    await call(b, "plans.set", { accountId: pea.id, fromMonth: "2099-01", amount: 500 });
    await call(b, "accounts.upsert", { ...pea, archived: true });
    const ws = await call<{ plans: Array<{ fromMonth: string; amount: number }> }>(b, "workspace.load");
    expect(ws.plans[0]).toMatchObject({ fromMonth: "2020-01", amount: 200 });
    expect(ws.plans.at(-1)).toMatchObject({ amount: 0 });
    expect(ws.plans.some((p) => p.fromMonth === "2099-01")).toBe(false);
  });

  it("espace de travail : cours quotidiens pour la crypto, dernier du mois pour le reste", async () => {
    const b = memory();
    const btc = await call<{ id: string }>(b, "assets.upsert", { kind: "crypto", name: "BTC", symbol: "bitcoin", priceSource: "manuel" });
    const etf = await call<{ id: string }>(b, "assets.upsert", { kind: "etf", name: "ETF", priceSource: "manuel" });
    for (const id of [btc.id, etf.id]) for (const date of ["2026-03-10", "2026-03-15", "2026-03-31"]) await call(b, "prices.setManual", { assetId: id, date, price: 10 });
    const ws = await call<{ prices: Array<{ assetId: string; date: string }> }>(b, "workspace.load");
    expect(ws.prices.filter((p) => p.assetId === btc.id)).toHaveLength(3);
    expect(ws.prices.filter((p) => p.assetId === etf.id).map((p) => p.date)).toEqual(["2026-03-31"]);
  });

  it("crowdlending : un projet exige une plateforme, qui ne se supprime plus ensuite", async () => {
    const b = memory();
    const cto = await call<{ id: string }>(b, "accounts.upsert", { kind: "cto", name: "CTO" });
    const c = await call<{ id: string }>(b, "accounts.upsert", { kind: "crowdlending", name: "Plateforme" });
    const base = { name: "Projet", amount: 1_000, rate: 0.1, startDate: "2026-01-15", termMonths: 12 };
    expect((await b.dispatch("crowdProjects.upsert", { ...base, accountId: cto.id })).ok).toBe(false);
    const p = await call<{ id: string; status: string; statusDate: string | null; repayment: string }>(b, "crowdProjects.upsert", { ...base, accountId: c.id });
    expect(p).toMatchObject({ status: "en_cours", repayment: "in_fine", statusDate: null });
    expect((await b.dispatch("accounts.delete", { id: c.id })).ok).toBe(false);
    const ws = await call<{ crowdProjects: unknown[] }>(b, "workspace.load");
    expect(ws.crowdProjects).toHaveLength(1);
  });

  it("crowdlending : la prolongation d'une échéance est enregistrée, et refusée si elle ne la recule pas", async () => {
    const b = memory();
    const c = await call<{ id: string }>(b, "accounts.upsert", { kind: "crowdlending", name: "Plateforme" });
    const base = { accountId: c.id, name: "Projet", amount: 1_000, rate: 0.1, startDate: "2026-01-15", termMonths: 12 };
    expect(await call(b, "crowdProjects.upsert", { ...base, extendedTo: "2027-07-15" })).toMatchObject({ extendedTo: "2027-07-15" });
    expect((await b.dispatch("crowdProjects.upsert", { ...base, extendedTo: "2026-06-01" })).ok).toBe(false);
  });

  it("crédits : immobilier par défaut, seul un crédit immobilier ou travaux se rattache à un bien", async () => {
    const b = memory();
    const bien = await call<{ id: string }>(b, "properties.upsert", { kind: "locatif", name: "Studio", value: 100_000 });
    const base = { name: "Prêt", principal: 10_000, rate: 0.04, termMonths: 24, firstPayment: "2026-01-05", propertyId: bien.id };
    expect(await call(b, "loans.upsert", base)).toMatchObject({ kind: "immobilier", propertyId: bien.id });
    expect(await call(b, "loans.upsert", { ...base, kind: "travaux" })).toMatchObject({ kind: "travaux", propertyId: bien.id });
    expect(await call(b, "loans.upsert", { ...base, kind: "consommation" })).toMatchObject({ kind: "consommation", propertyId: null });
  });
});

describe("établissements", () => {
  async function call<T = unknown>(b: Backend, name: string, input?: unknown): Promise<T> {
    const res = await b.dispatch(name, input);
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res.data as T;
  }

  it("crée un établissement avec ses offres validées, y rattache un compte, puis le supprime sans perdre le compte", async () => {
    const b = memory();
    const inst = await call<{ id: string; offers: { pea?: { orderFees: { tiers: unknown[] }; custodyFixed: number } } }>(b, "institutions.upsert", {
      name: "Courtier",
      kind: "courtier",
      offers: { pea: { orderFees: { tiers: [{ upTo: 500, fixed: 1.99, rate: 0 }, { upTo: null, fixed: 0, rate: 0.006 }] } } },
    });
    expect(inst.offers.pea!.orderFees.tiers).toHaveLength(2);
    expect(inst.offers.pea!.custodyFixed).toBe(0);
    const pea = await call<{ id: string; institutionId: string }>(b, "accounts.upsert", { kind: "pea", name: "PEA", institutionId: inst.id });
    expect(pea.institutionId).toBe(inst.id);
    await call(b, "institutions.delete", { id: inst.id });
    const ws = await call<{ accounts: Array<{ institutionId: string | null }>; institutions: unknown[] }>(b, "workspace.load");
    expect(ws.institutions).toHaveLength(0);
    expect(ws.accounts[0].institutionId).toBeNull();
  });

  it("refuse une grille invalide", async () => {
    const b = memory();
    const bad = await b.dispatch("institutions.upsert", { name: "X", kind: "courtier", offers: { pea: { orderFees: { tiers: [] } } } });
    expect(bad.ok === false && bad.error.code).toBe("VALIDATION");
  });

  it("migration : les noms d'établissement des anciens comptes deviennent des établissements rattachés", async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const { migrations } = await import("./db/migrations.generated");
    const { migrate } = await import("./db/migrate");
    const raw = new DatabaseSync(":memory:");
    raw.exec("CREATE TABLE _hamac_migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    for (const m of migrations.slice(0, 3)) {
      for (const st of m.sql.split("--> statement-breakpoint")) if (st.trim()) raw.exec(st);
      raw.prepare("INSERT INTO _hamac_migrations VALUES (?, ?)").run(m.tag, "x");
    }
    raw.exec(`INSERT INTO settings VALUES ('plan.parameters', '{"broker":{"feeRate":0.004,"minFee":1}}', 'x')`);
    raw.exec(`INSERT INTO accounts (id, kind, name, institution) VALUES ('p', 'pea', 'PEA', 'Boursomachin'), ('c', 'cto', 'CTO', ' boursomachin '), ('l', 'livret', 'LEP', 'Ma banque'), ('x', 'livret', 'LDDS', '')`);
    raw.exec(`INSERT INTO comparisons (id, kind, name, "values", score, comment) VALUES ('k', 'assurance_vie', 'Contrat Z', '{"fraisVersement":"0 %"}', 8, 'bien')`);
    migrate(raw);
    const insts = raw.prepare("SELECT name, kind, offers, comment FROM institutions ORDER BY name").all() as Array<{ name: string; kind: string; offers: string; comment: string }>;
    expect(insts.map((i) => [i.name, i.kind])).toEqual([["Boursomachin", "courtier"], ["Contrat Z", "assureur"], ["Ma banque", "banque"]]);
    // json_patch retire les clés à null : elles reprennent leur valeur par défaut à la lecture (Offers).
    const { Offers } = await import("@hamac/core");
    const broker = Offers.parse(JSON.parse(insts[0].offers));
    expect(broker.pea!.orderFees).toEqual({ tiers: [{ upTo: null, fixed: 0, rate: 0.004 }], min: 1, max: null });
    expect(insts[1].comment).toMatch(/fraisVersement/);
    const links = raw.prepare("SELECT a.id, i.name FROM accounts a LEFT JOIN institutions i ON i.id = a.institution_id ORDER BY a.id").all();
    expect(links).toEqual([
      { id: "c", name: "Boursomachin" },
      { id: "l", name: "Ma banque" },
      { id: "p", name: "Boursomachin" },
      { id: "x", name: null },
    ]);
    raw.close();
  });
});

describe("taux datés des livrets", () => {
  async function call<T = unknown>(b: Backend, name: string, input?: unknown): Promise<T> {
    const res = await b.dispatch(name, input);
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res.data as T;
  }
  it("le taux saisi sur le livret crée l'historique ; un nouveau taux s'ajoute sans effacer l'ancien", async () => {
    const b = memory();
    const lep = await call<{ id: string }>(b, "accounts.upsert", { kind: "livret", livretType: "LEP", name: "LEP", rate: 0.027, rateFrom: "2025-08-01" });
    await call(b, "accountRates.set", { accountId: lep.id, fromDate: "2026-02-01", rate: 0.025 });
    const ws = await call<{ accountRates: Array<{ fromDate: string; rate: number }>; accounts: Array<{ rate: number }> }>(b, "workspace.load");
    expect(ws.accountRates.map((r) => [r.fromDate, r.rate])).toEqual([
      ["2025-08-01", 0.027],
      ["2026-02-01", 0.025],
    ]);
    expect(ws.accounts[0].rate).toBe(0.025);
  });

  it("un taux identique au précédent ne crée pas de doublon", async () => {
    const b = memory();
    const lep = await call<{ id: string }>(b, "accounts.upsert", { kind: "livret", name: "LEP", rate: 0.03, rateFrom: "2025-01-01" });
    await call(b, "accountRates.set", { accountId: lep.id, fromDate: "2025-08-01", rate: 0.03 });
    await call(b, "accountRates.set", { accountId: lep.id, fromDate: "2026-02-01", rate: 0.025 });
    await call(b, "accountRates.set", { accountId: lep.id, fromDate: "2026-06-01", rate: 0.025 });
    const ws = await call<{ accountRates: Array<{ fromDate: string }> }>(b, "workspace.load");
    expect(ws.accountRates.map((r) => r.fromDate)).toEqual(["2025-01-01", "2026-02-01"]);
  });
});

describe("achat avec création du titre", () => {
  async function call<T = unknown>(b: Backend, name: string, input?: unknown): Promise<T> {
    const res = await b.dispatch(name, input);
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res.data as T;
  }
  it("crée l'obligation et l'achat ensemble", async () => {
    const b = memory();
    const cto = await call<{ id: string }>(b, "accounts.upsert", { kind: "cto", name: "CTO" });
    const r = await call<{ asset: { id: string; bondKind: string }; transaction: { assetId: string } }>(b, "transactions.createWithAsset", {
      asset: { kind: "obligation", name: "OAT 3 % 25/05/2033", priceSource: "modele", couponRate: 0.03, maturityDate: "2033-05-25", issuer: "République française", bondKind: "etat" },
      transaction: { date: "2026-11-07", type: "achat", accountId: cto.id, amount: 2950, quantity: 3000, fee: 0 },
    });
    expect(r.asset.bondKind).toBe("etat");
    expect(r.transaction.assetId).toBe(r.asset.id);
  });
  it("tout ou rien : une opération refusée n'ajoute pas le titre", async () => {
    const b = memory();
    const lep = await call<{ id: string }>(b, "accounts.upsert", { kind: "livret", name: "LEP" });
    const res = await b.dispatch("transactions.createWithAsset", {
      asset: { kind: "obligation", name: "OAT", priceSource: "modele", couponRate: 0.03, maturityDate: "2033-05-25", bondKind: "etat" },
      transaction: { date: "2026-11-07", type: "achat", accountId: lep.id, amount: 100, quantity: 100 },
    });
    expect(res.ok).toBe(false);
    const ws = await call<{ assets: unknown[]; transactions: unknown[] }>(b, "workspace.load");
    expect(ws.assets).toHaveLength(0);
    expect(ws.transactions).toHaveLength(0);
  });
});

describe("comptes uniques (règle légale)", () => {
  it("refuse un second PEA ou un second LEP, accepte plusieurs comptes-titres", async () => {
    const b = memory();
    const ok = async (input: unknown) => (await b.dispatch("accounts.upsert", input)).ok;
    expect(await ok({ kind: "pea", name: "PEA" })).toBe(true);
    const second = await b.dispatch("accounts.upsert", { kind: "pea", name: "Autre PEA" });
    expect(second.ok === false && second.error.code).toBe("CONFLICT");
    expect(await ok({ kind: "livret", livretType: "LEP", name: "LEP" })).toBe(true);
    expect(await ok({ kind: "livret", livretType: "LEP", name: "LEP 2" })).toBe(false);
    expect(await ok({ kind: "cto", name: "CTO 1" })).toBe(true);
    expect(await ok({ kind: "cto", name: "CTO 2" })).toBe(true);
  });
});
