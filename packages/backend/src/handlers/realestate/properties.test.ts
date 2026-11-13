import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "../../db/migrate";
import { migrations } from "../../db/migrations.generated";
import { enterTenant, rawFor } from "../../db/postgres";
import type { Backend } from "../../index";
import { pgliteProvider, testBackend } from "../../testkit";

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

const bien = { kind: "locatif", name: "Studio", value: 100_000 };

describe("dépenses : part récupérable sur le locataire", () => {
  it("proposée selon la catégorie et les réglages, jamais sur l'assurance ni une amélioration", async () => {
    backend = await testBackend();
    const { id: propertyId } = await call<{ id: string }>(backend, "properties.upsert", bien);
    const depense = { propertyId, date: "2025-01-01", amount: 1_200 };
    const copro = await call<{ recoverableRate: number }>(backend, "propertyExpenses.upsert", { ...depense, category: "copropriete" });
    expect(copro.recoverableRate).toBeCloseTo(2 / 3, 10);
    expect(await call(backend, "propertyExpenses.upsert", { ...depense, category: "taxe_fonciere", recoverableRate: 0.15 })).toMatchObject({ recoverableRate: 0.15 });
    expect(await call(backend, "propertyExpenses.upsert", { ...depense, category: "assurance", recoverableRate: 0.5 })).toMatchObject({ recoverableRate: 0 });
    expect(await call(backend, "propertyExpenses.upsert", { ...depense, category: "travaux", improvement: true, recoverableRate: 0.5 })).toMatchObject({ recoverableRate: 0 });
    const { params } = await call<{ params: { rental: object } }>(backend, "workspace.load");
    await call(backend, "params.update", { ...params, rental: { coproRecoverable: 0.7 } });
    expect(await call(backend, "propertyExpenses.upsert", { ...depense, category: "copropriete" })).toMatchObject({ recoverableRate: 0.7 });
  });

  it("migration : la copropriété déjà saisie devient récupérable aux deux tiers, le reste à 0", async () => {
    const provider = pgliteProvider();
    const session = await provider.session();
    await enterTenant(session, crypto.randomUUID());
    const raw = rawFor(session);
    await raw.exec("CREATE TABLE IF NOT EXISTS _hamac_migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    for (const m of migrations.filter((x) => x.tag < "0031")) {
      for (const statement of m.sql.split("--> statement-breakpoint")) if (statement.trim()) await raw.exec(statement);
      await raw.run("INSERT INTO _hamac_migrations (tag, applied_at) VALUES (?, ?)", [m.tag, "2026-01-01"]);
    }
    await raw.exec("INSERT INTO properties (id, kind, name, value_cents) VALUES ('b', 'locatif', 'Studio', 10000000)");
    await raw.exec("INSERT INTO property_expenses (id, property_id, date, category, amount_cents) VALUES ('c', 'b', '2025-01-01', 'copropriete', 120000), ('t', 'b', '2025-10-15', 'taxe_fonciere', 90000)");
    await migrate(raw);
    const rows = await raw.all<{ id: string; recoverable_rate: number }>("SELECT id, recoverable_rate FROM property_expenses ORDER BY id");
    expect(rows[0].recoverable_rate).toBeCloseTo(2 / 3, 10);
    expect(rows[1].recoverable_rate).toBe(0);
    await provider.close();
  });

  it("restaure une sauvegarde d'avant la part récupérable : même reprise que la migration", async () => {
    backend = await testBackend();
    const dump = {
      format: "hamac",
      version: 1,
      engine: "postgres",
      schemaVersion: "0030_condemned_human_robot",
      exportedAt: "x",
      appVersion: "test",
      tables: {
        properties: [{ id: "b", kind: "locatif", name: "Studio", value_cents: 10_000_000 }],
        property_expenses: [
          { id: "c", property_id: "b", date: "2025-01-01", category: "copropriete", amount_cents: 120_000 },
          { id: "t", property_id: "b", date: "2025-10-15", category: "taxe_fonciere", amount_cents: 90_000 },
        ],
      },
    };
    expect((await backend.dispatch("data.import", { dump, confirm: "REMPLACER" })).ok).toBe(true);
    const { propertyExpenses } = await call<{ propertyExpenses: Array<{ id: string; recoverableRate: number }> }>(backend, "workspace.load");
    expect(propertyExpenses.find((e) => e.id === "c")!.recoverableRate).toBeCloseTo(2 / 3, 10);
    expect(propertyExpenses.find((e) => e.id === "t")!.recoverableRate).toBe(0);
  });
});

describe("provisions du cashflow prévu", () => {
  it("enregistrées à part : modifier le bien ne les touche pas, null revient aux réglages", async () => {
    backend = await testBackend();
    const property = await call<{ id: string }>(backend, "properties.upsert", bien);
    await call(backend, "properties.setProvisions", { id: property.id, vacancy: { kind: "montant", value: 600 }, works: { kind: "taux", value: 0.08 } });
    const load = async () => (await call<{ properties: Array<Record<string, unknown>> }>(backend!, "workspace.load")).properties[0];
    expect(await load()).toMatchObject({ vacancyProvision: { kind: "montant", value: 600 }, worksProvision: { kind: "taux", value: 0.08 } });
    await call(backend, "properties.upsert", { ...bien, id: property.id, name: "T2 rénové" });
    expect(await load()).toMatchObject({ name: "T2 rénové", vacancyProvision: { kind: "montant", value: 600 } });
    await call(backend, "properties.setProvisions", { id: property.id, vacancy: null, works: null });
    expect(await load()).toMatchObject({ vacancyProvision: null, worksProvision: null });
  });

  it("refusées : plus de 100 % du loyer, bien inconnu", async () => {
    backend = await testBackend();
    const property = await call<{ id: string }>(backend, "properties.upsert", bien);
    expect((await backend.dispatch("properties.setProvisions", { id: property.id, vacancy: { kind: "taux", value: 1.5 }, works: null })).ok).toBe(false);
    expect((await backend.dispatch("properties.setProvisions", { id: "inconnu", vacancy: null, works: null })).ok).toBe(false);
  });
});
