import { afterEach, describe, expect, it } from "vitest";
import type { Backend } from "./index";
import { testBackend } from "./testkit";

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

const base = { kind: "immobilier", name: "Prêt", principal: 100_000, rate: 0.03, termMonths: 120, firstPayment: "2026-01-05" };
const loans = async (b: Backend) => (await call<{ loans: Array<Record<string, unknown>> }>(b, "workspace.load")).loans;

describe("assurance d'un crédit", () => {
  it("sans précision : montant fixe, comme les crédits existants", async () => {
    backend = await testBackend();
    await call(backend, "loans.upsert", { ...base, insurance: 25 });
    expect((await loans(backend))[0]).toMatchObject({ insuranceMode: "montant", insurance: 25, insuranceRate: 0 });
  });

  it("enregistre le taux et ne garde que la valeur utile au mode choisi", async () => {
    backend = await testBackend();
    await call(backend, "loans.upsert", { ...base, insuranceMode: "capital_restant", insuranceRate: 0.0034, insurance: 99 });
    expect((await loans(backend))[0]).toMatchObject({ insuranceMode: "capital_restant", insuranceRate: 0.0034, insurance: 0 });
    const id = (await loans(backend))[0]!.id;
    await call(backend, "loans.upsert", { ...base, id, insuranceMode: "montant", insurance: 40, insuranceRate: 0.5 });
    expect((await loans(backend))[0]).toMatchObject({ insuranceMode: "montant", insurance: 40, insuranceRate: 0 });
  });

  it("refuse un mode inconnu ou un taux négatif", async () => {
    backend = await testBackend();
    expect((await backend.dispatch("loans.upsert", { ...base, insuranceMode: "au-hasard" })).ok).toBe(false);
    expect((await backend.dispatch("loans.upsert", { ...base, insuranceMode: "capital_initial", insuranceRate: -0.01 })).ok).toBe(false);
  });

  it("une sauvegarde sans ces colonnes se restaure en montant fixe", async () => {
    backend = await testBackend();
    await call(backend, "loans.upsert", { ...base, insurance: 25 });
    const dump = await call<{ tables: { loans: Array<Record<string, unknown>> } }>(backend, "data.export");
    for (const row of dump.tables.loans) {
      delete row.insurance_mode;
      delete row.insurance_rate;
    }
    await call(backend, "data.import", { dump, confirm: "REMPLACER" });
    expect((await loans(backend))[0]).toMatchObject({ insuranceMode: "montant", insurance: 25, insuranceRate: 0 });
  });
});

describe("part à charge d'un crédit", () => {
  it("100 % sans précision, enregistre la part indiquée, refuse une part hors limites", async () => {
    backend = await testBackend();
    expect(await call(backend, "loans.upsert", base)).toMatchObject({ share: 1 });
    expect(await call(backend, "loans.upsert", { ...base, share: 0.5 })).toMatchObject({ share: 0.5 });
    await expect(call(backend, "loans.upsert", { ...base, share: 0 })).rejects.toThrow();
    await expect(call(backend, "loans.upsert", { ...base, share: 1.5 })).rejects.toThrow();
  });

  it("une sauvegarde sans cette colonne se restaure à 100 %", async () => {
    backend = await testBackend();
    await call(backend, "loans.upsert", base);
    const dump = await call<{ tables: { loans: Array<Record<string, unknown>> } }>(backend, "data.export");
    for (const row of dump.tables.loans) delete row.share;
    await call(backend, "data.import", { dump, confirm: "REMPLACER" });
    expect((await loans(backend))[0]).toMatchObject({ share: 1 });
  });
});

describe("statut et frais d'un bien", () => {
  const bien = { kind: "locatif", name: "Studio", value: 100_000 };
  const properties = async (b: Backend) => (await call<{ properties: Array<Record<string, unknown>> }>(b, "workspace.load")).properties;

  it("en nom propre et sans frais par défaut, enregistre ce qui est saisi", async () => {
    backend = await testBackend();
    expect(await call(backend, "properties.upsert", bien)).toMatchObject({ ownership: "nom_propre", notaryFees: 0, agencyFees: 0, initialWorks: 0, otherFees: 0 });
    await call(backend, "properties.upsert", { ...bien, name: "SCI", ownership: "sci_familiale", notaryFees: 7_500.5, agencyFees: 3_000, initialWorks: 12_000, otherFees: 450 });
    expect((await properties(backend)).find((p) => p.name === "SCI")).toMatchObject({ ownership: "sci_familiale", notaryFees: 7_500.5, agencyFees: 3_000, initialWorks: 12_000, otherFees: 450 });
  });

  it("fiche descriptive : vide par défaut, enregistrée, alertes DPE activées sans autre précision", async () => {
    backend = await testBackend();
    expect(await call(backend, "properties.upsert", bien)).toMatchObject({ propertyType: null, address: "", surface: null, parking: false, dpe: null, dpeDate: null, dpeReminders: true });
    const fiche = { propertyType: "appartement", address: "1 rue fictive", postalCode: "00000", city: "Ville fictive", surface: 42.5, rooms: 2, bedrooms: 1, floor: -1, buildYear: 1990, outdoor: "Balcon", parking: true, cellar: true, heating: "Gaz", coOwnership: true, syndic: "Syndic fictif", dpe: "D", ges: "C", dpeDate: "2024-03-15", dpeReminders: false };
    await call(backend, "properties.upsert", { ...bien, name: "Fiche", ...fiche });
    expect((await properties(backend)).find((p) => p.name === "Fiche")).toMatchObject(fiche);
  });

  it("refuse une note DPE inconnue ou une surface nulle", async () => {
    backend = await testBackend();
    await expect(call(backend, "properties.upsert", { ...bien, dpe: "H" })).rejects.toThrow();
    await expect(call(backend, "properties.upsert", { ...bien, surface: 0 })).rejects.toThrow();
  });

  it("refuse un statut inconnu ou des frais négatifs", async () => {
    backend = await testBackend();
    await expect(call(backend, "properties.upsert", { ...bien, ownership: "inconnu" })).rejects.toThrow();
    await expect(call(backend, "properties.upsert", { ...bien, notaryFees: -1 })).rejects.toThrow();
  });

  it("une sauvegarde sans ces colonnes se restaure en nom propre, sans frais", async () => {
    backend = await testBackend();
    await call(backend, "properties.upsert", { ...bien, ownership: "indivision", notaryFees: 5_000 });
    const dump = await call<{ tables: { properties: Array<Record<string, unknown>> } }>(backend, "data.export");
    for (const row of dump.tables.properties) {
      delete row.ownership;
      delete row.notary_fees_cents;
    }
    await call(backend, "data.import", { dump, confirm: "REMPLACER" });
    expect((await properties(backend))[0]).toMatchObject({ ownership: "nom_propre", notaryFees: 0 });
  });
});

describe("vie d'un bien", () => {
  const bien = { kind: "locatif", name: "Studio", value: 100_000, valueDate: "2024-01-01", purchasePrice: 90_000, purchaseDate: "2023-01-01" };
  const load = (b: Backend) => call<{ properties: Array<Record<string, unknown>>; loans: Array<Record<string, unknown>>; propertyValues: Array<Record<string, unknown>> }>(b, "workspace.load");

  it("une nouvelle date d'estimation garde l'ancienne ; une correction à la même date non", async () => {
    backend = await testBackend();
    const { id } = await call<{ id: string }>(backend, "properties.upsert", bien);
    await call(backend, "properties.upsert", { ...bien, id, value: 101_000 });
    expect((await load(backend)).propertyValues).toEqual([]);
    await call(backend, "properties.upsert", { ...bien, id, value: 110_000, valueDate: "2025-01-01" });
    const after = await load(backend);
    expect(after.propertyValues).toMatchObject([{ propertyId: id, date: "2024-01-01", value: 101_000 }]);
    expect(after.properties[0]).toMatchObject({ value: 110_000, valueDate: "2025-01-01" });
  });

  it("ajout d'une estimation : la plus récente devient la valeur actuelle, une ancienne rejoint l'historique", async () => {
    backend = await testBackend();
    const { id } = await call<{ id: string }>(backend, "properties.upsert", bien);
    await call(backend, "propertyValues.add", { propertyId: id, date: "2023-06-01", value: 95_000 });
    await call(backend, "propertyValues.add", { propertyId: id, date: "2026-01-01", value: 120_000 });
    const after = await load(backend);
    expect(after.properties[0]).toMatchObject({ value: 120_000, valueDate: "2026-01-01" });
    expect(after.propertyValues).toMatchObject([{ date: "2023-06-01", value: 95_000 }, { date: "2024-01-01", value: 100_000 }]);
    await call(backend, "propertyValues.delete", { id: after.propertyValues[0].id });
    expect((await load(backend)).propertyValues).toHaveLength(1);
  });

  it("vente : bien archivé, crédits soldés ; annulation : tout revient", async () => {
    backend = await testBackend();
    const { id } = await call<{ id: string }>(backend, "properties.upsert", bien);
    await call(backend, "loans.upsert", { ...base, propertyId: id });
    await expect(call(backend, "properties.sell", { id, saleDate: "2022-01-01", salePrice: 1 })).rejects.toThrow("précéder");
    await call(backend, "properties.sell", { id, saleDate: "2026-06-01", salePrice: 150_000, saleFees: 5_000 });
    let after = await load(backend);
    expect(after.properties[0]).toMatchObject({ saleDate: "2026-06-01", salePrice: 150_000, saleFees: 5_000, archived: true });
    expect(after.loans[0]).toMatchObject({ archived: true, closedOn: "2026-06-01" });
    await call(backend, "properties.cancelSale", { id });
    after = await load(backend);
    expect(after.properties[0]).toMatchObject({ saleDate: null, salePrice: null, saleFees: 0, archived: false });
    expect(after.loans[0]).toMatchObject({ archived: false, closedOn: null });
  });

  it("vente sans solder les crédits, et modifier le bien vendu garde la vente", async () => {
    backend = await testBackend();
    const { id } = await call<{ id: string }>(backend, "properties.upsert", bien);
    await call(backend, "loans.upsert", { ...base, propertyId: id });
    await call(backend, "properties.sell", { id, saleDate: "2026-06-01", salePrice: 150_000, closeLoans: false });
    await call(backend, "properties.upsert", { ...bien, id, name: "Studio vendu", archived: true });
    const after = await load(backend);
    expect(after.loans[0]).toMatchObject({ archived: false, closedOn: null });
    expect(after.properties[0]).toMatchObject({ name: "Studio vendu", saleDate: "2026-06-01" });
  });

  it("seuls les travaux peuvent être une amélioration", async () => {
    backend = await testBackend();
    const { id: propertyId } = await call<{ id: string }>(backend, "properties.upsert", { ...bien, kind: "residence_principale" });
    const depense = { propertyId, date: "2025-01-01", amount: 1_000, improvement: true };
    expect(await call(backend, "propertyExpenses.upsert", { ...depense, category: "travaux" })).toMatchObject({ improvement: true });
    expect(await call(backend, "propertyExpenses.upsert", { ...depense, category: "assurance" })).toMatchObject({ improvement: false });
  });
});
