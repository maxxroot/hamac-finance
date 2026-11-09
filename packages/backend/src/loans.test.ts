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
