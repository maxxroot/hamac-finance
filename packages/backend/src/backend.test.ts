import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Workspace } from "@hamac/api";
import { buildTaxReport, computePortfolio, cryptoTax, reportTotalsMismatches } from "@hamac/core";
import type { Backend } from "./index";
import { testBackend } from "./testkit";

let backend: Backend | null = null;
afterEach(() => {
  backend?.close();
  backend = null;
});

async function memory() {
  backend = await testBackend();
  return backend;
}

describe("backend", () => {
  it("applique les migrations et renvoie les infos système", async () => {
    const res = await (await memory()).dispatch("system.info", undefined);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toMatchObject({ appVersion: "test" });
  });

  it("renvoie null pour un réglage jamais enregistré", async () => {
    expect(await (await memory()).dispatch("settings.get", { key: "ui.lastRoute" })).toEqual({ ok: true, data: null });
  });

  it("enregistre et relit un réglage", async () => {
    const b = await memory();
    expect(await b.dispatch("settings.set", { key: "ui.privacyMode", value: true })).toEqual({ ok: true });
    expect(await b.dispatch("settings.get", { key: "ui.privacyMode" })).toEqual({ ok: true, data: true });
  });

  it("refuse une entrée invalide et une procédure inconnue", async () => {
    const b = await memory();
    const bad = await b.dispatch("settings.set", { key: "nimporte.quoi", value: 1 });
    expect(bad.ok === false && bad.error.code).toBe("VALIDATION");
    const unknown = await b.dispatch("rien.du.tout", {});
    expect(unknown.ok === false && unknown.error.code).toBe("NOT_FOUND");
  });

  it("n'écrit aucune copie à l'ouverture d'un compte à jour", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hamac-"));
    backend = await testBackend({ backupsDir: join(dir, "sauvegardes") });
    expect(existsSync(join(dir, "sauvegardes"))).toBe(false);
  });
});

describe("données du plan", () => {
  async function call<T = unknown>(b: Backend, name: string, input?: unknown): Promise<T> {
    const res = await b.dispatch(name, input);
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res.data as T;
  }

  it("crée la structure type puis la refuse sur une base non vide", async () => {
    const b = await memory();
    await call(b, "workspace.createStarter");
    const ws = await call<{ accounts: Array<{ name: string; kind: string }> }>(b, "workspace.load");
    expect(ws.accounts.map((a) => a.name)).toEqual(["LEP", "LDDS", "Livret A", "Assurance-vie", "Compte-titres", "PEA", "Crypto"]);
    const again = await b.dispatch("workspace.createStarter", undefined);
    expect(again.ok === false && again.error.code).toBe("CONFLICT");
  });

  it("enregistre une opération en centimes exacts et applique les règles métier", async () => {
    const b = await memory();
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
    const b = await memory();
    const a = await call<{ isin: string }>(b, "assets.upsert", { kind: "etf", name: "A", isin: "fr0011871128" });
    expect(a.isin).toBe("FR0011871128");
    const dup = await b.dispatch("assets.upsert", { kind: "etf", name: "B", isin: "FR0011871128" });
    expect(dup.ok === false && dup.error.code).toBe("CONFLICT");
  });

  it("versements programmés : un plan par compte et par mois (mise à jour en place)", async () => {
    const b = await memory();
    const lep = await call<{ id: string }>(b, "accounts.upsert", { kind: "livret", livretType: "LEP", name: "LEP" });
    await call(b, "plans.set", { accountId: lep.id, fromMonth: "2026-11", amount: 100 });
    await call(b, "plans.set", { accountId: lep.id, fromMonth: "2026-11", amount: 120 });
    const ws = await call<{ plans: Array<{ amount: number }> }>(b, "workspace.load");
    expect(ws.plans).toHaveLength(1);
    expect(ws.plans[0].amount).toBe(120);
  });

  it("valide les paramètres", async () => {
    const b = await memory();
    const ws = await call<{ params: Record<string, unknown> }>(b, "workspace.load");
    const bad = await b.dispatch("params.update", { ...ws.params, profile: { ...(ws.params.profile as object), horizonAge: 50 } });
    expect(bad.ok === false && bad.error.code).toBe("VALIDATION");
  });

  it("accepte des paramètres d'une interface plus ancienne (réglage absent → valeur par défaut)", async () => {
    const b = await memory();
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
    const b = await memory();
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
    const a = await memory();
    await seedDemo(a);
    const dump = await call<{ tables: Record<string, unknown[]> }>(a, "data.export");
    const before = await call<Record<string, unknown>>(a, "workspace.load");

    const b = await testBackend();
    await call(b, "data.import", { dump, confirm: "REMPLACER" });
    const after = await call<Record<string, unknown>>(b, "workspace.load");
    expect(after.transactions).toEqual(before.transactions);
    expect(after.accounts).toEqual(before.accounts);
    expect(after.params).toEqual(before.params);
    b.close();
  });

  it("refuse un fichier qui n'est pas une sauvegarde, sans rien toucher", async () => {
    const b = await memory();
    await call(b, "workspace.createStarter");
    const bad = await b.dispatch("data.import", { dump: { format: "autre" }, confirm: "REMPLACER" });
    expect(bad.ok).toBe(false);
    const ws = await call<{ accounts: unknown[] }>(b, "workspace.load");
    expect(ws.accounts).toHaveLength(7);
  });

  it("import groupé : lignes valides enregistrées, erreurs signalées par ligne", async () => {
    const b = await memory();
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

  it("import groupé : le brut et les retenues d'un revenu sont conservés", async () => {
    const b = await memory();
    const c = await call<{ id: string }>(b, "accounts.upsert", { kind: "crowdlending", name: "Plateforme" });
    await call(b, "transactions.bulkCreate", { items: [{ date: "2026-03-31", type: "interets", accountId: c.id, amount: 100, gross: 100, withheldIncomeTax: 12.8, withheldSocial: 18.6 }] });
    const ws = await call<{ transactions: Array<Record<string, unknown>> }>(b, "workspace.load");
    expect(ws.transactions[0]).toMatchObject({ amount: 100, gross: 100, withheldIncomeTax: 12.8, withheldSocial: 18.6, withheldForeign: null });
  });

  it("archiver un compte arrête ses versements programmés sans effacer le passé", async () => {
    const b = await memory();
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
    const b = await memory();
    const btc = await call<{ id: string }>(b, "assets.upsert", { kind: "crypto", name: "BTC", symbol: "bitcoin", priceSource: "manuel" });
    const etf = await call<{ id: string }>(b, "assets.upsert", { kind: "etf", name: "ETF", priceSource: "manuel" });
    for (const id of [btc.id, etf.id]) for (const date of ["2026-03-10", "2026-03-15", "2026-03-31"]) await call(b, "prices.setManual", { assetId: id, date, price: 10 });
    const ws = await call<{ prices: Array<{ assetId: string; date: string }> }>(b, "workspace.load");
    expect(ws.prices.filter((p) => p.assetId === btc.id)).toHaveLength(3);
    expect(ws.prices.filter((p) => p.assetId === etf.id).map((p) => p.date)).toEqual(["2026-03-31"]);
  });

  it("crowdlending : un projet exige une plateforme, qui ne se supprime plus ensuite", async () => {
    const b = await memory();
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
    const b = await memory();
    const c = await call<{ id: string }>(b, "accounts.upsert", { kind: "crowdlending", name: "Plateforme" });
    const base = { accountId: c.id, name: "Projet", amount: 1_000, rate: 0.1, startDate: "2026-01-15", termMonths: 12 };
    expect(await call(b, "crowdProjects.upsert", { ...base, extendedTo: "2027-07-15" })).toMatchObject({ extendedTo: "2027-07-15" });
    expect((await b.dispatch("crowdProjects.upsert", { ...base, extendedTo: "2026-06-01" })).ok).toBe(false);
  });

  it("crédits : immobilier par défaut, seul un crédit immobilier ou travaux se rattache à un bien", async () => {
    const b = await memory();
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
    const b = await memory();
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

  it("enregistre un projet et remplace ses comptes à la modification", async () => {
    const b = await memory();
    const livret = await call<{ id: string }>(b, "accounts.upsert", { kind: "livret", livretType: "AUTRE", name: "Livret" });
    const pea = await call<{ id: string }>(b, "accounts.upsert", { kind: "pea", name: "PEA" });
    const g = await call<{ id: string; allocations: unknown[] }>(b, "goals.upsert", { name: "Voiture", target: 20_000, targetDate: "2028-06-01", startDate: "2026-01-01", allocations: [{ accountId: livret.id, mode: "pourcentage", value: 0.5 }, { accountId: pea.id, mode: "montant", value: 3_000 }] });
    expect(g.allocations).toHaveLength(2);
    await call(b, "goals.upsert", { id: g.id, name: "Voiture", target: 20_000, targetDate: "2028-06-01", startDate: "2026-01-01", rate: 0.02, allocations: [{ accountId: livret.id, mode: "montant", value: 8_000 }] });
    const ws = await call<{ goals: Array<{ rate: number; allocations: Array<{ mode: string; value: number }> }> }>(b, "workspace.load");
    expect(ws.goals[0]).toMatchObject({ rate: 0.02, allocations: [{ mode: "montant", value: 8_000 }] });
    await expect(call(b, "goals.upsert", { name: "Faux", target: 1, targetDate: "2026-01-01", startDate: "2026-06-01" })).rejects.toThrow(/VALIDATION/);
    await expect(call(b, "goals.upsert", { name: "Faux", target: 1, targetDate: "2027-01-01", startDate: "2026-06-01", allocations: [{ accountId: livret.id, mode: "pourcentage", value: 1.5 }] })).rejects.toThrow(/VALIDATION/);
    // Supprimer un compte retire sa part des projets.
    await call(b, "accounts.delete", { id: livret.id });
    const after = await call<{ goals: Array<{ allocations: unknown[] }> }>(b, "workspace.load");
    expect(after.goals[0].allocations).toHaveLength(0);
  });

  it("enregistre, modifie et supprime une donation", async () => {
    const b = await memory();
    const g = await call<{ id: string; amount: number; kind: string }>(b, "gifts.upsert", { date: "2025-06-01", direction: "faite", person: "Camille", relation: "enfant", amount: 20_000 });
    expect(g).toMatchObject({ amount: 20_000, kind: "donation" });
    await call(b, "gifts.upsert", { id: g.id, date: "2025-06-01", direction: "faite", kind: "don_argent", person: "Camille", relation: "enfant", amount: 25_000 });
    let ws = await call<{ gifts: Array<{ kind: string; amount: number }> }>(b, "workspace.load");
    expect(ws.gifts).toEqual([expect.objectContaining({ kind: "don_argent", amount: 25_000 })]);
    await expect(call(b, "gifts.upsert", { date: "2025-06-01", direction: "faite", person: "", relation: "enfant", amount: 1 })).rejects.toThrow(/VALIDATION/);
    await call(b, "gifts.delete", { id: g.id });
    ws = await call(b, "workspace.load");
    expect(ws.gifts).toHaveLength(0);
  });

  it("enregistre un autre bien, garde ses estimations passées et ne garde l'échéancier que pour un prêt", async () => {
    const b = await memory();
    const or = await call<{ id: string; loanPrincipal: number | null }>(b, "otherAssets.upsert", { kind: "metal", name: "Pièces", value: 18_000, valueDate: "2025-01-10", purchasePrice: 12_000, purchaseDate: "2016-03-01", loanPrincipal: 5_000 });
    expect(or.loanPrincipal).toBeNull();
    await call(b, "otherAssetValues.add", { assetId: or.id, date: "2026-02-01", value: 21_000 });
    await call(b, "otherAssetValues.add", { assetId: or.id, date: "2024-01-01", value: 15_000 });
    let ws = await call<{ otherAssets: Array<{ value: number; valueDate: string }>; otherAssetValues: Array<{ date: string; value: number }> }>(b, "workspace.load");
    expect(ws.otherAssets[0]).toMatchObject({ value: 21_000, valueDate: "2026-02-01" });
    expect(ws.otherAssetValues.map((v) => [v.date, v.value])).toEqual([["2024-01-01", 15_000], ["2025-01-10", 18_000]]);
    const pret = await call<{ loanPrincipal: number; loanTermMonths: number }>(b, "otherAssets.upsert", { kind: "pret", name: "Prêt", value: 0, loanPrincipal: 6_000, loanTermMonths: 12, loanFirstPayment: "2026-01-05" });
    expect(pret).toMatchObject({ loanPrincipal: 6_000, loanTermMonths: 12 });
    await call(b, "otherAssets.delete", { id: or.id });
    ws = await call(b, "workspace.load");
    expect(ws.otherAssets).toHaveLength(1);
    expect(ws.otherAssetValues).toHaveLength(0);
  });

  it("enregistre une SCI, le démembrement d'un bien et la part d'un compte joint", async () => {
    const b = await memory();
    const sci = await call<{ id: string; share: number }>(b, "companies.upsert", { name: "SCI Fictive", share: 0.4 });
    expect(sci.share).toBe(0.4);
    const bien = await call<{ id: string; companyId: string | null; dismemberment: string; usufructBirthDate: string | null }>(b, "properties.upsert", { kind: "locatif", ownership: "sci_familiale", name: "Studio", value: 150_000, companyId: sci.id, dismemberment: "nue_propriete", usufructBirthDate: "1958-04-02" });
    expect(bien).toMatchObject({ companyId: sci.id, dismemberment: "nue_propriete", usufructBirthDate: "1958-04-02" });
    // Hors SCI, le rattachement à une société est retiré ; en pleine propriété, l'usufruitier aussi.
    const nom = await call<{ companyId: string | null; usufructBirthDate: string | null }>(b, "properties.upsert", { id: bien.id, kind: "locatif", ownership: "nom_propre", name: "Studio", value: 150_000, companyId: sci.id, dismemberment: "pleine", usufructBirthDate: "1958-04-02" });
    expect(nom).toMatchObject({ companyId: null, usufructBirthDate: null });
    // Un démembrement sans de quoi l'évaluer est refusé.
    await expect(call(b, "properties.upsert", { kind: "locatif", name: "Sans date", value: 1, dismemberment: "usufruit" })).rejects.toThrow(/VALIDATION/);

    const joint = await call<{ share: number }>(b, "accounts.upsert", { kind: "cto", name: "Compte-titres joint", share: 0.5 });
    expect(joint.share).toBe(0.5);
    const pea = await call<{ share: number }>(b, "accounts.upsert", { kind: "pea", name: "PEA", share: 0.5 });
    expect(pea.share).toBe(1);

    await call(b, "companies.delete", { id: sci.id });
    const ws = await call<{ companies: unknown[] }>(b, "workspace.load");
    expect(ws.companies).toHaveLength(0);
  });

  it("conserve l'établissement garant et le pays d'un établissement", async () => {
    const b = await memory();
    const defaut = await call<{ protection: { guarantor: string; country: string } }>(b, "institutions.upsert", { name: "Banque", kind: "banque" });
    expect(defaut.protection).toEqual({ guarantor: "", country: "france" });
    const marque = await call<{ id: string }>(b, "institutions.upsert", { name: "Marque en ligne", kind: "banque", protection: { guarantor: "Groupe Fictif", country: "ue" } });
    const ws = await call<{ institutions: Array<{ id: string; protection: { guarantor: string; country: string } }> }>(b, "workspace.load");
    expect(ws.institutions.find((i) => i.id === marque.id)?.protection).toEqual({ guarantor: "Groupe Fictif", country: "ue" });
  });

  it("conserve la case du récapitulatif fiscal et le détail fiscal d'un dividende", async () => {
    const b = await memory();
    const inst = await call<{ id: string; tax: { report: boolean; withheldIncomeTax: number | null } }>(b, "institutions.upsert", { name: "Courtier", kind: "courtier", tax: { report: true, withheldIncomeTax: 0.128, withheldSocial: 0 } });
    expect(inst.tax).toEqual({ report: true, withholds: null, withheldIncomeTax: 0.128, withheldSocial: 0 });
    const defaut = await call<{ tax: { report: boolean } }>(b, "institutions.upsert", { name: "Autre", kind: "banque" });
    expect(defaut.tax.report).toBe(false);
    const cto = await call<{ id: string }>(b, "accounts.upsert", { kind: "cto", name: "CTO", institutionId: inst.id });
    await call(b, "transactions.upsert", { date: "2025-06-02", type: "dividende", accountId: cto.id, amount: 87.2, gross: 100, withheldIncomeTax: 12.8, withheldSocial: 0, withheldForeign: 0 });
    const ws = await call<{ transactions: Array<{ gross: number; withheldIncomeTax: number; withheldSocial: number }> }>(b, "workspace.load");
    expect(ws.transactions[0]).toMatchObject({ gross: 100, withheldIncomeTax: 12.8, withheldSocial: 0 });
  });

  it("garde les montants du document fiscal, les remplace, et les inclut dans la sauvegarde", async () => {
    const b = await memory();
    const inst = await call<{ id: string }>(b, "institutions.upsert", { name: "Courtier", kind: "courtier" });
    const save = (amounts: unknown[]) => call(b, "taxStatements.save", { institutionId: inst.id, year: 2025, amounts });
    await save([{ box: "2DC", amount: 12.34 }, { box: "2TR", amount: 5 }]);
    await save([{ box: "2DC", amount: 20 }]);
    const ws = await call<{ taxStatements: unknown[] }>(b, "workspace.load");
    expect(ws.taxStatements).toEqual([{ institutionId: inst.id, year: 2025, box: "2DC", amount: 20 }]);
    const dump = await call<{ tables: Record<string, unknown[]> }>(b, "data.export");
    expect(dump.tables.tax_statement_amounts).toHaveLength(1);
    await call(b, "data.import", { dump, confirm: "REMPLACER" });
    expect((await call<{ taxStatements: unknown[] }>(b, "workspace.load")).taxStatements).toHaveLength(1);
  });

  it("produit le récapitulatif fiscal à partir de l'espace de travail réel", async () => {
    const b = await memory();
    const inst = await call<{ id: string }>(b, "institutions.upsert", { name: "Courtier", kind: "courtier", tax: { report: true, withheldIncomeTax: 0.128, withheldSocial: 0 } });
    const cto = await call<{ id: string }>(b, "accounts.upsert", { kind: "cto", name: "CTO", institutionId: inst.id });
    const action = await call<{ id: string }>(b, "assets.upsert", { kind: "action", name: "Action fictive", priceSource: "manuel" });
    await call(b, "transactions.upsert", { date: "2024-03-01", type: "versement", accountId: cto.id, amount: 2000 });
    await call(b, "transactions.upsert", { date: "2024-03-02", type: "achat", accountId: cto.id, assetId: action.id, amount: 1000, quantity: 10 });
    await call(b, "transactions.upsert", { date: "2025-04-02", type: "vente", accountId: cto.id, assetId: action.id, amount: 700, quantity: 5 });
    await call(b, "transactions.upsert", { date: "2025-05-02", type: "dividende", accountId: cto.id, assetId: action.id, amount: 87.2 });
    const ws = await call<Workspace>(b, "workspace.load");
    const asOf = "2026-11-09";
    const report = buildTaxReport(ws, computePortfolio(ws, asOf).disposals, cryptoTax(ws, asOf), 2025);
    expect(report.sheets).toHaveLength(1);
    expect(report.sheets[0].mode).toBe("a_saisir");
    expect(report.lines.find((l) => l.rule.box === "2DC")).toMatchObject({ total: 100, toEnter: 100, status: "calcule" });
    expect(report.lines.find((l) => l.rule.box === "2CK")).toMatchObject({ total: 12.8 });
    expect(report.lines.find((l) => l.rule.box === "3VG")).toMatchObject({ total: 200 });
    expect(reportTotalsMismatches(report)).toEqual([]);
  });

  it("refuse une grille invalide", async () => {
    const b = await memory();
    const bad = await b.dispatch("institutions.upsert", { name: "X", kind: "courtier", offers: { pea: { orderFees: { tiers: [] } } } });
    expect(bad.ok === false && bad.error.code).toBe("VALIDATION");
  });

});

describe("taux datés des livrets", () => {
  async function call<T = unknown>(b: Backend, name: string, input?: unknown): Promise<T> {
    const res = await b.dispatch(name, input);
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.message}`);
    return res.data as T;
  }
  it("le taux saisi sur le livret crée l'historique ; un nouveau taux s'ajoute sans effacer l'ancien", async () => {
    const b = await memory();
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
    const b = await memory();
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
    const b = await memory();
    const cto = await call<{ id: string }>(b, "accounts.upsert", { kind: "cto", name: "CTO" });
    const r = await call<{ asset: { id: string; bondKind: string }; transaction: { assetId: string } }>(b, "transactions.createWithAsset", {
      asset: { kind: "obligation", name: "OAT 3 % 25/05/2033", priceSource: "modele", couponRate: 0.03, maturityDate: "2033-05-25", issuer: "République française", bondKind: "etat" },
      transaction: { date: "2026-11-07", type: "achat", accountId: cto.id, amount: 2950, quantity: 3000, fee: 0 },
    });
    expect(r.asset.bondKind).toBe("etat");
    expect(r.transaction.assetId).toBe(r.asset.id);
  });
  it("tout ou rien : une opération refusée n'ajoute pas le titre", async () => {
    const b = await memory();
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
    const b = await memory();
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
