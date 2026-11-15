import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Backend } from "@hamac/backend";
import { testBackend } from "@hamac/backend/testkit";
import type { TokenScope } from "../auth/apiTokens";
import { DraftStore } from "./drafts";
import { callThrough, parisToday, type Call } from "./engine";
import { connectTestClient, testStores, type TestStores } from "./testClient";

/** Les outils MCP sur un vrai backend (PostgreSQL en mémoire), appelés par le client MCP officiel. */

let backend: Backend;
let call: Call;
let stores: TestStores;
let pea: string;
let etf: string;

beforeEach(async () => {
  backend = await testBackend();
  call = callThrough((name, input) => backend.dispatch(name, input));
  stores = testStores();
  pea = (await call("accounts.upsert", { kind: "pea", name: "PEA Bourse" })).id;
  etf = (await call("assets.upsert", { kind: "etf", name: "Amundi MSCI World", isin: "LU1681043599", priceSource: "manuel", manualPrice: 500, manualPriceDate: "2026-01-02" })).id;
  await call("transactions.upsert", { date: "2026-01-02", type: "versement", accountId: pea, amount: 2000 });
  await call("transactions.upsert", { date: "2026-01-03", type: "achat", accountId: pea, assetId: etf, amount: 1000, quantity: 2 });
});
afterEach(() => backend.close());

const connect = (scope: TokenScope = "write", tenantId = "t1") => connectTestClient(call, stores, scope, tenantId);

describe("outils exposés", () => {
  it("en lecture seule : aucun outil qui écrit", async () => {
    const { client, instructions } = await connect("read");
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual(["check_data", "compare_statement", "get_account", "get_summary", "get_tax_estimate", "get_tax_report", "get_tax_settings", "get_year_end_checklist", "list_accounts", "list_assets", "list_institutions", "list_transactions"]);
    expect(instructions).toContain("lecture seule");
  });

  it("en écriture : import, saisie, suppression confirmée en plus", async () => {
    const { client, instructions } = await connect("write");
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["prepare_import", "apply_import", "undo_import", "save_asset", "record_statement", "save_institution", "save_account", "save_transaction", "prepare_deletion", "apply_deletion"]));
    expect(instructions).toContain("accord explicite");
  });
});

describe("lecture", () => {
  it("synthèse et comptes : encours calculés par le moteur", async () => {
    const { tool } = await connect("read");
    const summary = (await tool("get_summary")).json;
    expect(summary.date).toBe(parisToday());
    expect(summary.investments).toMatchObject({ value: 2000, netContributions: 2000, cash: 1000 });
    const [account] = (await tool("list_accounts")).json;
    expect(account).toMatchObject({ id: pea, name: "PEA Bourse", kind: "pea", value: 2000, netContributions: 2000 });
    expect(account.allowedTypes).toContain("achat");
    const detail = (await tool("get_account", { accountId: pea })).json;
    expect(detail.positions).toEqual([expect.objectContaining({ assetId: etf, quantity: 2, unitCost: 500, value: 1000 })]);
  });

  it("opérations filtrées, plus récentes d'abord ; compte inconnu : erreur lisible", async () => {
    const { tool } = await connect("read");
    const all = (await tool("list_transactions", { accountId: pea })).json;
    expect(all.total).toBe(2);
    expect(all.transactions.map((t: { type: string }) => t.type)).toEqual(["achat", "versement"]);
    expect((await tool("list_transactions", { type: "achat" })).json.transactions[0]).toMatchObject({ asset: "Amundi MSCI World", quantity: 2 });
    const missing = await tool("get_account", { accountId: "absent" });
    expect(missing).toMatchObject({ isError: true });
    expect(missing.text).toContain("list_accounts");
  });

  it("titres filtrés par ISIN, comparaison d'un relevé de situation", async () => {
    const { tool } = await connect("read");
    expect((await tool("list_assets", { query: "lu1681043599" })).json).toEqual([expect.objectContaining({ id: etf, isin: "LU1681043599" })]);
    expect((await tool("compare_statement", { accountId: pea, date: "2026-01-31", value: 2050 })).json).toMatchObject({ hamacValue: 2000, gap: 50 });
  });

  it("arguments invalides : refusés avant l'outil", async () => {
    const { tool } = await connect("read");
    expect((await tool("list_transactions", { from: "02/01/2026" })).isError).toBe(true);
  });
});

describe("import en deux temps", () => {
  const lines = [
    { date: "2026-01-02", amount: 2000, label: "VERSEMENT" },
    { date: "2026-02-03", amount: -1012.5, label: "ACHAT 2 AMUNDI MSCI WORLD", type: "achat", isin: "LU1681043599", quantity: 2, fee: 2.5 },
    { date: "2026-02-10", amount: -300, label: "ACHAT 10 ACME", type: "achat", isin: "FR0000120073", assetName: "ACME", quantity: 10 },
  ];

  it("l'aperçu n'écrit rien et signale doublon, ligne nouvelle et titre inconnu", async () => {
    const { tool } = await connect();
    const preview = (await tool("prepare_import", { accountId: pea, lines })).json;
    expect(preview.summary).toEqual({ lines: 3, ok: 1, duplicates: 1, scheduled: 0, errors: 1 });
    expect(preview.lines.map((l: { status: string }) => l.status)).toEqual(["doublon", "ok", "erreur"]);
    expect(preview.lines[1]).toMatchObject({ type: "achat", assetId: etf, amount: 1012.5, quantity: 2, fee: 2.5 });
    expect(preview.unknownAssets).toEqual([{ isin: "FR0000120073", name: "ACME", kind: null, lines: [2] }]);
    expect((await call("workspace.load")).transactions).toHaveLength(2);
  });

  it("appliquer écrit les lignes retenues, une seule fois ; annuler les retire", async () => {
    const { tool } = await connect();
    const { importId } = (await tool("prepare_import", { accountId: pea, lines })).json;
    expect((await tool("apply_import", { importId, include: [2] })).text).toContain("doublon ou programme");
    const applied = (await tool("apply_import", { importId })).json;
    expect(applied).toMatchObject({ created: 1, notImported: 2, errors: [] });
    expect((await call("workspace.load")).transactions).toHaveLength(3);
    expect((await tool("apply_import", { importId })).text).toContain("déjà été appliqué");
    expect((await tool("undo_import", { importId })).json).toEqual({ deleted: 1, alreadyGone: 0 });
    expect((await call("workspace.load")).transactions).toHaveLength(2);
  });

  it("doublon repris à la demande ; ligne ok écartée", async () => {
    const { tool } = await connect();
    const { importId } = (await tool("prepare_import", { accountId: pea, lines })).json;
    expect((await tool("apply_import", { importId, include: [0], exclude: [1] })).json.created).toBe(1);
    expect((await call("workspace.load")).transactions.filter((t) => t.type === "versement")).toHaveLength(2);
  });

  it("refuse d'appliquer si le journal a changé depuis l'aperçu", async () => {
    const { tool } = await connect();
    const { importId } = (await tool("prepare_import", { accountId: pea, lines })).json;
    await call("transactions.upsert", { date: "2026-02-03", type: "achat", accountId: pea, assetId: etf, amount: 1012.5, quantity: 2, fee: 2.5 });
    expect((await tool("apply_import", { importId })).text).toContain("refaites prepare_import");
  });

  it("un aperçu ne s'applique que dans le tenant qui l'a préparé", async () => {
    const { tool } = await connect("write", "t1");
    const { importId } = (await tool("prepare_import", { accountId: pea, lines })).json;
    const other = await connect("write", "t2");
    expect((await other.tool("apply_import", { importId })).text).toContain("introuvable");
  });

  it("titre inconnu créé, puis reconnu par un nouvel aperçu ; ISIN déjà connu : rien de créé", async () => {
    const { tool } = await connect();
    expect((await tool("save_asset", { kind: "etf", name: "Doublon", isin: "LU1681043599" })).json).toMatchObject({ created: false, id: etf });
    const created = (await tool("save_asset", { kind: "action", name: "ACME", isin: "FR0000120073" })).json;
    expect(created).toMatchObject({ created: true, kind: "action" });
    const preview = (await tool("prepare_import", { accountId: pea, lines })).json;
    expect(preview.lines[2]).toMatchObject({ status: "ok", assetId: created.id });
  });

  it("fichier CSV lu par Hamac, colonnes devinées et renvoyées", async () => {
    const { tool } = await connect();
    const content = "Date;Libellé;Montant\n02/01/2026;VERSEMENT;2000,00\n15/03/2026;VERSEMENT;150,00\n";
    const preview = (await tool("prepare_import", { accountId: pea, file: { content, name: "releve.csv" } })).json;
    expect(preview.format).toBe("csv");
    expect(preview.columns.map((c: { role: string }) => c.role)).toEqual(["date", "label", "amount"]);
    expect(preview.lines.map((l: { status: string; type: string }) => `${l.status}:${l.type}`)).toEqual(["doublon:versement", "ok:versement"]);
    expect((await tool("prepare_import", { accountId: pea, file: { content, columns: ["date"] } })).text).toContain("3 colonnes");
    expect((await tool("prepare_import", { accountId: pea, lines, file: { content } })).text).toContain("pas les deux");
  });

  it("relevé de situation enregistré : visible au compte", async () => {
    const { tool } = await connect();
    await tool("record_statement", { accountId: pea, date: "2026-01-31", value: 2010 });
    expect((await tool("get_account", { accountId: pea })).json.lastStatement).toEqual({ date: "2026-01-31", value: 2010 });
  });
});

describe("aperçus en mémoire", () => {
  it("un aperçu expire après une heure, une annulation après 24 heures", () => {
    let now = 0;
    const store = new DraftStore(() => now);
    const d = store.add("t", { accountId: "a", lines: [], defaultType: "auto", statuses: [] });
    now = 59 * 60_000;
    expect(store.get("t", d.id)).not.toBeNull();
    store.markApplied("t", d.id, ["x"]);
    now += 23 * 3600_000;
    expect(store.get("t", d.id)?.applied?.ids).toEqual(["x"]);
    now += 2 * 3600_000;
    expect(store.get("t", d.id)).toBeNull();
    const stale = store.add("t", { accountId: "a", lines: [], defaultType: "auto", statuses: [] });
    now += 61 * 60_000;
    expect(store.get("t", stale.id)).toBeNull();
  });
});
