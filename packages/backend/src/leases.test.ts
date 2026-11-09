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

interface Ws {
  leases: Array<Record<string, unknown>>;
  leaseRents: Array<Record<string, unknown>>;
}
const ws = (b: Backend) => call<Ws>(b, "workspace.load");
const newProperty = async (b: Backend, kind = "locatif") => (await call<{ id: string }>(b, "properties.upsert", { kind, name: "Studio", value: 100_000 })).id;
const lease = (propertyId: string) => ({ propertyId, kind: "vide", startDate: "2024-01-15", durationMonths: 36, rent: 800, charges: 50, deposit: 800 });

describe("baux", () => {
  it("enregistre un bail et le renvoie à l'espace de travail", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend);
    await call(backend, "leases.upsert", { ...lease(propertyId), tenant: "Locataire fictif" });
    expect((await ws(backend)).leases).toMatchObject([{ propertyId, kind: "vide", tenant: "Locataire fictif", rent: 800, charges: 50, deposit: 800, noticeBy: null }]);
  });

  it("réservé aux biens en location", async () => {
    backend = await testBackend();
    await expect(call(backend, "leases.upsert", lease(await newProperty(backend, "residence_principale")))).rejects.toThrow("investissement locatif");
    await expect(call(backend, "leases.upsert", lease("inconnu"))).rejects.toThrow("introuvable");
  });

  it("refuse deux baux sur la même période, accepte un bail après un congé", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend);
    const first = await call<{ id: string }>(backend, "leases.upsert", lease(propertyId));
    await expect(call(backend, "leases.upsert", { ...lease(propertyId), startDate: "2028-01-01" })).rejects.toThrow("déjà un bail");
    await call(backend, "leases.upsert", { ...lease(propertyId), id: first.id, noticeBy: "locataire", noticeDate: "2025-09-05", noticeMonths: 1 });
    await call(backend, "leases.upsert", { ...lease(propertyId), startDate: "2026-01-01" });
    expect((await ws(backend)).leases).toHaveLength(2);
  });

  it("le préavis ne se garde que pour un congé du locataire", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend);
    expect(await call(backend, "leases.upsert", { ...lease(propertyId), noticeBy: "proprietaire", noticeDate: "2026-07-14", noticeMonths: 1 })).toMatchObject({ noticeBy: "proprietaire", noticeMonths: null });
  });

  it("nouveau loyer : après le premier mois, remplacé s'il existe déjà pour ce mois", async () => {
    backend = await testBackend();
    const { id: leaseId } = await call<{ id: string }>(backend, "leases.upsert", lease(await newProperty(backend)));
    await expect(call(backend, "leaseRents.upsert", { leaseId, fromMonth: "2024-01", rent: 900 })).rejects.toThrow("premier mois");
    await call(backend, "leaseRents.upsert", { leaseId, fromMonth: "2025-01", rent: 815, charges: 50 });
    await call(backend, "leaseRents.upsert", { leaseId, fromMonth: "2025-01", rent: 820, charges: 55 });
    expect((await ws(backend)).leaseRents).toMatchObject([{ leaseId, fromMonth: "2025-01", rent: 820, charges: 55 }]);
  });

  it("supprimer un bien retire ses baux et ses loyers", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend);
    const { id: leaseId } = await call<{ id: string }>(backend, "leases.upsert", lease(propertyId));
    await call(backend, "leaseRents.upsert", { leaseId, fromMonth: "2025-01", rent: 815 });
    await call(backend, "properties.delete", { id: propertyId });
    expect(await ws(backend)).toMatchObject({ leases: [], leaseRents: [] });
  });

  it("baux et loyers sont dans les sauvegardes", async () => {
    backend = await testBackend();
    const { id: leaseId } = await call<{ id: string }>(backend, "leases.upsert", lease(await newProperty(backend)));
    await call(backend, "leaseRents.upsert", { leaseId, fromMonth: "2025-01", rent: 815 });
    const dump = await call(backend, "data.export");
    await call(backend, "data.import", { dump, confirm: "REMPLACER" });
    const after = await ws(backend);
    expect(after.leases).toHaveLength(1);
    expect(after.leaseRents).toHaveLength(1);
  });
});

describe("loyers signalés et dépenses", () => {
  const start = async (b: Backend) => {
    const propertyId = await newProperty(b);
    const { id: leaseId } = await call<{ id: string }>(b, "leases.upsert", lease(propertyId));
    return { propertyId, leaseId };
  };
  const data = (b: Backend) => call<{ rentExceptions: Array<Record<string, unknown>>; propertyExpenses: Array<Record<string, unknown>> }>(b, "workspace.load");

  it("un seul écart par mois : le dernier signalement remplace le précédent", async () => {
    backend = await testBackend();
    const { leaseId } = await start(backend);
    await call(backend, "rentExceptions.set", { leaseId, month: "2025-03", kind: "impaye" });
    await call(backend, "rentExceptions.set", { leaseId, month: "2025-03", kind: "montant", amount: 500 });
    expect((await data(backend)).rentExceptions).toMatchObject([{ leaseId, month: "2025-03", kind: "montant", amount: 500 }]);
  });

  it("refuse un montant manquant ou un mois avant le bail, ne garde pas de montant inutile", async () => {
    backend = await testBackend();
    const { leaseId } = await start(backend);
    await expect(call(backend, "rentExceptions.set", { leaseId, month: "2025-03", kind: "montant" })).rejects.toThrow();
    await expect(call(backend, "rentExceptions.set", { leaseId, month: "2023-12", kind: "impaye" })).rejects.toThrow("précède");
    expect(await call(backend, "rentExceptions.set", { leaseId, month: "2025-03", kind: "vide", amount: 100 })).toMatchObject({ amount: null });
  });

  it("dépense annuelle, dernière année contrôlée, retirée à la suppression", async () => {
    backend = await testBackend();
    const { propertyId } = await start(backend);
    const base = { propertyId, date: "2025-10-15", category: "taxe_fonciere", amount: 900 };
    await expect(call(backend, "propertyExpenses.upsert", { ...base, yearly: true, untilYear: 2024 })).rejects.toThrow("dernière année");
    const saved = await call<{ id: string }>(backend, "propertyExpenses.upsert", { ...base, yearly: true, untilYear: 2030 });
    expect((await data(backend)).propertyExpenses).toMatchObject([{ propertyId, amount: 900, yearly: true, untilYear: 2030 }]);
    await call(backend, "propertyExpenses.upsert", { ...base, id: saved.id, yearly: false, untilYear: 2030 });
    expect((await data(backend)).propertyExpenses).toMatchObject([{ yearly: false, untilYear: null }]);
    await call(backend, "propertyExpenses.delete", { id: saved.id });
    expect((await data(backend)).propertyExpenses).toEqual([]);
  });

  it("présents dans les sauvegardes", async () => {
    backend = await testBackend();
    const { propertyId, leaseId } = await start(backend);
    await call(backend, "rentExceptions.set", { leaseId, month: "2025-03", kind: "impaye" });
    await call(backend, "propertyExpenses.upsert", { propertyId, date: "2025-10-15", category: "assurance", amount: 120 });
    const dump = await call(backend, "data.export");
    await call(backend, "data.import", { dump, confirm: "REMPLACER" });
    const after = await data(backend);
    expect(after.rentExceptions).toHaveLength(1);
    expect(after.propertyExpenses).toHaveLength(1);
  });
});

describe("rappels d'un bail", () => {
  it("activés par défaut, désactivables, activés pour une sauvegarde sans cette colonne", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend);
    const saved = await call<{ id: string; reminders: boolean }>(backend, "leases.upsert", lease(propertyId));
    expect(saved.reminders).toBe(true);
    expect(await call(backend, "leases.upsert", { ...lease(propertyId), id: saved.id, reminders: false })).toMatchObject({ reminders: false });
    const dump = await call<{ tables: { leases: Array<Record<string, unknown>> } }>(backend, "data.export");
    for (const row of dump.tables.leases) delete row.reminders;
    await call(backend, "data.import", { dump, confirm: "REMPLACER" });
    expect((await ws(backend)).leases).toMatchObject([{ reminders: true }]);
  });
});
