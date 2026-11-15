import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Backend } from "@hamac/backend";
import { testBackend } from "@hamac/backend/testkit";
import { ConfirmationStore } from "./confirmations";
import { callThrough, type Call } from "./engine";
import { connectTestClient, testStores, type TestStores } from "./testClient";

/** Gérer le patrimoine depuis l'assistant : établissements, comptes, titres, opérations, suppressions confirmées. */

let backend: Backend;
let call: Call;
let stores: TestStores;

beforeEach(async () => {
  backend = await testBackend();
  call = callThrough((name, input) => backend.dispatch(name, input));
  stores = testStores();
});
afterEach(() => backend.close());

const connect = (tenantId = "t1") => connectTestClient(call, stores, "write", tenantId);

describe("établissements et comptes", () => {
  it("crée un établissement, y rattache un compte, puis ne modifie que les champs donnés", async () => {
    const { tool } = await connect();
    const bank = (await tool("save_institution", { name: "Banque A", kind: "courtier", tax: { report: true } })).json;
    expect(bank).toMatchObject({ created: true, name: "Banque A", tax: { report: true, crowdInstrument: "prets" } });

    const pea = (await tool("save_account", { kind: "pea", name: "PEA", institutionId: bank.id, openedOn: "2020-05-04" })).json;
    expect(pea).toMatchObject({ created: true, institutionId: bank.id });
    expect((await tool("save_account", { id: pea.id, role: "Long terme" })).json).toMatchObject({ created: false, name: "PEA", institutionId: bank.id });
    const detail = (await tool("get_account", { accountId: pea.id })).json;
    expect(detail.settings).toMatchObject({ role: "Long terme", openedOn: "2020-05-04", institutionId: bank.id });

    // Modification partielle de la fiscalité : le reste de la fiche est gardé.
    await tool("save_institution", { id: bank.id, website: "https://exemple.fr", tax: { withholds: true } });
    const [listed] = (await tool("list_institutions")).json;
    expect(listed).toMatchObject({ name: "Banque A", website: "https://exemple.fr", tax: { report: true, withholds: true }, accounts: [{ id: pea.id, name: "PEA" }] });
  });

  it("refuse une création incomplète et un identifiant inconnu, avec un message lisible", async () => {
    const { tool } = await connect();
    expect((await tool("save_account", { name: "Sans type" })).text).toContain("kind et name");
    expect((await tool("save_institution", { id: "absent", name: "X" })).text).toContain("list_institutions");
    await tool("save_account", { kind: "pea", name: "PEA" });
    expect((await tool("save_account", { kind: "pea", name: "Second PEA" })).text).toContain("un seul PEA");
  });

  it("taux d'un livret et taux servi du fonds euros par défaut d'un contrat", async () => {
    const { tool } = await connect();
    const lep = (await tool("save_account", { kind: "livret", livretType: "LEP", name: "LEP" })).json;
    await tool("set_account_rate", { accountId: lep.id, fromDate: "2026-02-01", rate: 0.027 });
    expect((await tool("get_account", { accountId: lep.id })).json.rates).toEqual([expect.objectContaining({ fromDate: "2026-02-01", rate: 0.027 })]);

    const av = (await tool("save_account", { kind: "assurance_vie", name: "Assurance-vie" })).json;
    expect(av.defaultAssetId).toBeTruthy();
    expect((await tool("set_fund_rate", { accountId: av.id, year: 2025, rate: 0.025 })).json).toMatchObject({ assetId: av.defaultAssetId, year: 2025 });
  });
});

describe("titres et opérations", () => {
  it("crée un titre, retrouve l'existant par ISIN, et garde ses champs à la modification", async () => {
    const { tool } = await connect();
    const etf = (await tool("save_asset", { kind: "etf", name: "ETF Monde", isin: "lu1681043599" })).json;
    expect(etf).toMatchObject({ created: true, isin: "LU1681043599", priceSource: "auto" });
    expect((await tool("save_asset", { kind: "etf", name: "Autre nom", isin: "LU1681043599" })).json).toMatchObject({ created: false, id: etf.id });
    expect((await tool("save_asset", { id: etf.id, archived: true })).json).toMatchObject({ isin: "LU1681043599", archived: true });

    const scpi = (await tool("save_asset", { kind: "scpi", name: "SCPI fictive" })).json;
    expect(scpi.priceSource).toBe("manuel");
    await tool("set_price", { assetId: scpi.id, date: "2026-01-31", price: 187.5 });
    expect((await tool("list_assets", { query: "SCPI" })).json[0]).toMatchObject({ manualPrice: 187.5, manualPriceDate: "2026-01-31" });

    expect((await tool("save_asset", { kind: "obligation", name: "OAT sans échéance" })).isError).toBe(true);
  });

  it("saisit une opération, la corrige sans perdre les autres champs, et programme un versement", async () => {
    const { tool } = await connect();
    const pea = (await tool("save_account", { kind: "pea", name: "PEA" })).json;
    const tx = (await tool("save_transaction", { date: "2026-01-05", type: "versement", accountId: pea.id, amount: 500, comment: "Virement" })).json;
    expect(tx).toMatchObject({ created: true, amount: 500 });
    await tool("save_transaction", { id: tx.id, amount: 550 });
    const [saved] = (await tool("list_transactions", { accountId: pea.id })).json.transactions;
    expect(saved).toMatchObject({ id: tx.id, amount: 550, comment: "Virement", date: "2026-01-05" });
    expect((await tool("save_transaction", { date: "2026-01-05", type: "versement", accountId: pea.id })).text).toContain("amount");

    await tool("set_contribution_plan", { accountId: pea.id, fromMonth: "2026-02", amount: 200 });
    await tool("save_contribution_skip", { accountId: pea.id, month: "2026-03", amount: 200 });
    const detail = (await tool("get_account", { accountId: pea.id })).json;
    expect(detail.contributionPlans).toEqual([expect.objectContaining({ fromMonth: "2026-02", amount: 200 })]);
    expect(detail.contributionSkips).toEqual([expect.objectContaining({ month: "2026-03", amount: 200 })]);
  });
});

describe("suppressions avec accord préalable", () => {
  it("l'aperçu ne supprime rien ; la confirmation supprime une seule fois", async () => {
    const { tool } = await connect();
    const pea = (await tool("save_account", { kind: "pea", name: "PEA" })).json;
    const tx = (await tool("save_transaction", { date: "2026-01-05", type: "versement", accountId: pea.id, amount: 500 })).json;
    const preview = (await tool("prepare_deletion", { kind: "transaction", id: tx.id })).json;
    expect(preview.target).toContain("Versement de 500 €");
    expect((await call("workspace.load")).transactions).toHaveLength(1);

    expect((await tool("apply_deletion", { deletionId: preview.deletionId })).json.deleted).toContain("Versement");
    expect((await call("workspace.load")).transactions).toHaveLength(0);
    expect((await tool("apply_deletion", { deletionId: preview.deletionId })).text).toContain("refaites prepare_deletion");
  });

  it("un compte qui a des opérations ne se supprime pas : l'assistant propose d'archiver", async () => {
    const { tool } = await connect();
    const pea = (await tool("save_account", { kind: "pea", name: "PEA" })).json;
    await tool("save_transaction", { date: "2026-01-05", type: "versement", accountId: pea.id, amount: 500 });
    const refused = await tool("prepare_deletion", { kind: "account", id: pea.id });
    expect(refused).toMatchObject({ isError: true });
    expect(refused.text).toContain("archived: true");
  });

  it("un établissement supprimé détache ses comptes, annoncé dans l'aperçu", async () => {
    const { tool } = await connect();
    const bank = (await tool("save_institution", { name: "Banque B", kind: "banque" })).json;
    const lep = (await tool("save_account", { kind: "livret", livretType: "LEP", name: "LEP", institutionId: bank.id })).json;
    const preview = (await tool("prepare_deletion", { kind: "institution", id: bank.id })).json;
    expect(preview.consequences.join(" ")).toContain("LEP");
    await tool("apply_deletion", { deletionId: preview.deletionId });
    const ws = await call("workspace.load");
    expect(ws.institutions).toHaveLength(0);
    expect(ws.accounts.find((a) => a.id === lep.id)?.institutionId).toBeNull();
  });

  it("refuse si l'objet s'est mis à servir depuis l'aperçu, et dans un autre tenant", async () => {
    const { tool } = await connect();
    const pea = (await tool("save_account", { kind: "pea", name: "PEA" })).json;
    const preview = (await tool("prepare_deletion", { kind: "account", id: pea.id })).json;
    const other = await connect("t2");
    expect((await other.tool("apply_deletion", { deletionId: preview.deletionId })).text).toContain("introuvable");

    const again = (await tool("prepare_deletion", { kind: "account", id: pea.id })).json;
    await tool("save_transaction", { date: "2026-01-05", type: "versement", accountId: pea.id, amount: 500 });
    expect((await tool("apply_deletion", { deletionId: again.deletionId })).text).toContain("archivez-le");
    expect((await call("workspace.load")).accounts).toHaveLength(1);
  });

  it("une confirmation expire après 15 minutes", () => {
    let now = 0;
    const store = new ConfirmationStore(() => now);
    const p = store.add("t", { kind: "transaction", targetId: "x", label: "x" });
    now = 16 * 60_000;
    expect(store.take("t", p.id)).toBeNull();
  });
});
