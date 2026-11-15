import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Backend } from "@hamac/backend";
import { testBackend } from "@hamac/backend/testkit";
import { callThrough, type Call } from "./engine";
import { connectTestClient, testStores, type TestStores } from "./testClient";

/** Fiscalité depuis l'assistant : récapitulatif, estimation, fin d'année, IFU en deux temps, scénarios. */

let backend: Backend;
let call: Call;
let stores: TestStores;
let broker: string;

beforeEach(async () => {
  backend = await testBackend();
  call = callThrough((name, input) => backend.dispatch(name, input));
  stores = testStores();
  // Données fictives : un dividende de 100 € brut et une plus-value de 200 € en 2025, chez un courtier sans IFU utilisable.
  broker = (await call("institutions.upsert", { name: "Courtier fictif", kind: "courtier", tax: { report: true, withheldIncomeTax: 0.128, withheldSocial: 0 } })).id;
  const cto = (await call("accounts.upsert", { kind: "cto", name: "CTO", institutionId: broker })).id;
  const action = (await call("assets.upsert", { kind: "action", name: "Action fictive", priceSource: "manuel", manualPrice: 140, manualPriceDate: "2025-04-02" })).id;
  await call("transactions.upsert", { date: "2024-03-01", type: "versement", accountId: cto, amount: 2000 });
  await call("transactions.upsert", { date: "2024-03-02", type: "achat", accountId: cto, assetId: action, amount: 1000, quantity: 10 });
  await call("transactions.upsert", { date: "2025-04-02", type: "vente", accountId: cto, assetId: action, amount: 700, quantity: 5 });
  await call("transactions.upsert", { date: "2025-05-02", type: "dividende", accountId: cto, assetId: action, amount: 87.2 });
});
afterEach(() => backend.close());

const connect = (scope: "read" | "write" = "write", tenantId = "t1") => connectTestClient(call, stores, scope, tenantId);
const box = (list: Array<{ box: string }>, b: string) => list.find((x) => x.box === b);

describe("récapitulatif fiscal", () => {
  it("cases à reporter, fiche de l'établissement et contrôles, comme la page Aide à la déclaration", async () => {
    const { tool } = await connect("read");
    const report = (await tool("get_tax_report", { year: 2025 })).json;
    expect(report).toMatchObject({ year: 2025, declarationYear: 2026, consistent: true });
    expect(box(report.boxes, "2DC")).toMatchObject({ total: 100, toEnter: 100, status: "calcule" });
    expect(box(report.boxes, "3VG")).toMatchObject({ total: 200 });
    expect(report.sheets).toEqual([expect.objectContaining({ institutionId: broker, mode: "À saisir" })]);
    expect(report.disclaimer).toContain("responsable");

    const sheet = (await tool("get_tax_report", { year: 2025, institutionId: broker })).json.sheet;
    expect(sheet.incomes).toEqual([expect.objectContaining({ date: "2025-05-02", received: 87.2, gross: 100 })]);
    expect(sheet.disposals).toEqual([expect.objectContaining({ quantity: 5, proceeds: 700, cost: 500, gain: 200 })]);
    expect(box(sheet.statementComparison, "2DC")).toMatchObject({ hamac: 100, statement: null, gap: null });
  });

  it("établissement sans fiche : message lisible", async () => {
    const bank = (await call("institutions.upsert", { name: "Banque fictive", kind: "banque" })).id;
    const { tool } = await connect("read");
    const res = await tool("get_tax_report", { year: 2025, institutionId: bank });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("Aucune fiche");
  });
});

describe("estimation, fin d'année, paramètres", () => {
  it("renvoie les estimations, la liste de fin d'année et les paramètres en lecture", async () => {
    const { tool } = await connect("read");
    const estimate = (await tool("get_tax_estimate")).json;
    expect(estimate.ifEverythingWithdrawnToday).toEqual(expect.arrayContaining([expect.objectContaining({ account: expect.stringContaining("CTO") })]));
    expect(estimate.byYear.some((y: { year: number }) => y.year === 2025)).toBe(true);
    const checklist = (await tool("get_year_end_checklist")).json;
    expect(checklist.items.length).toBeGreaterThan(0);
    expect(checklist.withholdingDispense).toHaveProperty("forYear");
    const settings = (await tool("get_tax_settings")).json;
    expect(settings.tax).toHaveProperty("tmi");
    expect(settings.household).toHaveProperty("couple");
  });
});

describe("IFU en deux temps", () => {
  it("l'aperçu compare sans écrire ; l'application enregistre une seule fois ; le récapitulatif signale l'écart", async () => {
    const { tool } = await connect();
    const preview = (await tool("prepare_tax_statement", { institutionId: broker, year: 2025, amounts: [{ box: "2dc", amount: 110 }, { box: "2CK", amount: 12.8 }, { box: "2ZZ", amount: 5 }] })).json;
    expect(box(preview.comparison, "2DC")).toMatchObject({ hamac: 100, statement: 110, gap: -10 });
    expect(preview.notComparedBoxes).toEqual([{ box: "2ZZ", amount: 5 }]);
    expect((await call("workspace.load")).taxStatements).toHaveLength(0);

    // Une confirmation d'IFU n'est pas une confirmation de suppression, et reste utilisable.
    expect((await tool("apply_deletion", { deletionId: preview.confirmationId })).isError).toBe(true);
    expect((await tool("apply_tax_statement", { confirmationId: preview.confirmationId })).json).toMatchObject({ boxes: 3 });
    expect((await tool("apply_tax_statement", { confirmationId: preview.confirmationId })).text).toContain("refaites prepare_tax_statement");
    expect((await call("workspace.load")).taxStatements).toHaveLength(3);

    const report = (await tool("get_tax_report", { year: 2025 })).json;
    expect(report.alerts.map((a: { message: string }) => a.message).join(" ")).toContain("écart sur la case 2DC");
    const again = (await tool("prepare_tax_statement", { institutionId: broker, year: 2025, amounts: [{ box: "2DC", amount: 100 }] })).json;
    expect(again.replaces).toHaveLength(3);
  });

  it("refuse une case donnée deux fois, et les outils d'écriture n'existent pas en lecture seule", async () => {
    const { tool } = await connect();
    expect((await tool("prepare_tax_statement", { institutionId: broker, year: 2025, amounts: [{ box: "2DC", amount: 1 }, { box: "2dc", amount: 2 }] })).text).toContain("plusieurs fois");
    const read = await connect("read");
    const names = (await read.client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["get_tax_report", "get_tax_estimate", "get_year_end_checklist", "get_tax_settings"]));
    expect(names).not.toContain("prepare_tax_statement");
  });
});

describe("scénarios", () => {
  it("préparer la déclaration : marche à suivre adaptée à la portée du jeton", async () => {
    const write = await connect();
    expect((await write.client.listPrompts()).prompts.map((p) => p.name).sort()).toEqual(["prepare_tax_return", "year_end_review"]);
    const prompt = await write.client.getPrompt({ name: "prepare_tax_return", arguments: { year: "2025" } });
    const text = (prompt.messages[0]!.content as { text: string }).text;
    expect(text).toContain("revenus 2025");
    expect(text).toContain("prepare_tax_statement");
    const read = await connect("read");
    const readText = ((await read.client.getPrompt({ name: "prepare_tax_return", arguments: {} })).messages[0]!.content as { text: string }).text;
    expect(readText).not.toContain("apply_tax_statement");
  });
});
