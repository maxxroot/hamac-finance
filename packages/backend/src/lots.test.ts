import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "./db/migrate";
import { migrations } from "./db/migrations.generated";
import { enterTenant, rawFor } from "./db/postgres";
import type { Backend } from "./index";
import { pgliteProvider, testBackend } from "./testkit";

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

type Rows = Array<Record<string, unknown>>;
interface Ws {
  properties: Rows;
  lots: Rows;
  leases: Rows;
  renters: Rows;
  leaseRenters: Rows;
  leaseGuarantees: Rows;
}
const ws = (b: Backend) => call<Ws>(b, "workspace.load");
const newProperty = async (b: Backend, rentalMode = "vide") => (await call<{ id: string }>(b, "properties.upsert", { kind: "locatif", name: "Maison", value: 300_000, rentalMode })).id;
const lease = (propertyId: string, extra: Record<string, unknown> = {}) => ({ propertyId, kind: "vide", startDate: "2024-01-15", durationMonths: 36, rent: 800, charges: 50, deposit: 800, ...extra });

describe("lots", () => {
  it("un bail sans lot choisi loue le logement du bien, créé au premier bail", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend);
    const first = await call<{ lotId: string }>(backend, "leases.upsert", lease(propertyId, { actualEnd: "2025-06-30" }));
    const second = await call<{ lotId: string }>(backend, "leases.upsert", lease(propertyId, { startDate: "2025-09-01" }));
    expect(second.lotId).toBe(first.lotId);
    expect((await ws(backend)).lots).toMatchObject([{ id: first.lotId, propertyId, name: "Logement", kind: "logement" }]);
  });

  it("colocation par chambre : une chambre à choisir, deux chambres louées en même temps", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend, "chambres");
    await expect(call(backend, "leases.upsert", lease(propertyId, { kind: "meuble" }))).rejects.toThrow("Ajoutez d'abord les chambres");
    const c1 = await call<{ id: string }>(backend, "lots.upsert", { propertyId, name: "Chambre 1", kind: "chambre", targetRent: 450 });
    const c2 = await call<{ id: string }>(backend, "lots.upsert", { propertyId, name: "Chambre 2", kind: "chambre" });
    await expect(call(backend, "leases.upsert", lease(propertyId, { kind: "meuble" }))).rejects.toThrow("Choisissez le lot");
    await call(backend, "leases.upsert", lease(propertyId, { kind: "etudiant", durationMonths: 9, lotId: c1.id }));
    await call(backend, "leases.upsert", lease(propertyId, { kind: "meuble", durationMonths: 12, lotId: c2.id }));
    await expect(call(backend, "leases.upsert", lease(propertyId, { kind: "meuble", durationMonths: 12, lotId: c2.id, startDate: "2024-03-01" }))).rejects.toThrow("déjà un bail");
    expect((await ws(backend)).lots).toMatchObject([{ name: "Chambre 1", targetRent: 450 }, { name: "Chambre 2", targetRent: null }]);
  });

  it("le logement entier et une chambre ne se louent pas en même temps", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend, "colocation");
    const whole = await call<{ id: string }>(backend, "lots.upsert", { propertyId, name: "Logement", kind: "logement" });
    const room = await call<{ id: string }>(backend, "lots.upsert", { propertyId, name: "Chambre 1", kind: "chambre" });
    await call(backend, "leases.upsert", lease(propertyId, { lotId: whole.id }));
    await expect(call(backend, "leases.upsert", lease(propertyId, { kind: "meuble", lotId: room.id, startDate: "2025-01-01" }))).rejects.toThrow("logement entier et une chambre");
  });

  it("le type de bail suit le mode de location ; un bail existant garde le sien", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend, "meuble");
    await expect(call(backend, "leases.upsert", lease(propertyId))).rejects.toThrow("ne correspond pas");
    const parking = await call<{ id: string }>(backend, "lots.upsert", { propertyId, name: "Parking", kind: "parking" });
    await expect(call(backend, "leases.upsert", lease(propertyId, { kind: "meuble", lotId: parking.id }))).rejects.toThrow("ne correspond pas");
    await call(backend, "leases.upsert", lease(propertyId, { kind: "autre", lotId: parking.id }));
    const bail = await call<{ id: string }>(backend, "leases.upsert", lease(propertyId, { kind: "meuble", durationMonths: 12 }));
    await call(backend, "properties.upsert", { id: propertyId, kind: "locatif", name: "Maison", value: 300_000, rentalMode: "vide" });
    await call(backend, "leases.upsert", lease(propertyId, { id: bail.id, kind: "meuble", durationMonths: 12, comment: "modifié" }));
  });

  it("un lot loué ne se supprime pas et garde sa nature ; un lot vide se supprime", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend, "chambres");
    const room = await call<{ id: string }>(backend, "lots.upsert", { propertyId, name: "Chambre 1", kind: "chambre" });
    const spare = await call<{ id: string }>(backend, "lots.upsert", { propertyId, name: "Chambre 2", kind: "chambre" });
    await call(backend, "leases.upsert", lease(propertyId, { kind: "meuble", lotId: room.id }));
    await expect(call(backend, "lots.delete", { id: room.id })).rejects.toThrow("archivez-le");
    await expect(call(backend, "lots.upsert", { id: room.id, propertyId, name: "Chambre 1", kind: "logement" })).rejects.toThrow("nature");
    await call(backend, "lots.upsert", { id: room.id, propertyId, name: "Chambre bleue", kind: "chambre", archived: true });
    await call(backend, "lots.delete", { id: spare.id });
    expect((await ws(backend)).lots).toMatchObject([{ name: "Chambre bleue", archived: true }]);
  });
});

describe("locataires et garanties", () => {
  it("le bail crée ses locataires, les reprend par leur id et garde leur ordre", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend, "colocation");
    const bail = await call<{ id: string }>(backend, "leases.upsert", lease(propertyId, { renters: [{ firstName: "Alice", lastName: "Fictive", email: "alice@example.org" }, { lastName: "Bruno Exemple" }] }));
    const { renters } = await ws(backend);
    const alice = renters.find((r) => r.firstName === "Alice")!;
    const bruno = renters.find((r) => r.lastName === "Bruno Exemple")!;
    await call(backend, "leases.upsert", lease(propertyId, { id: bail.id, renters: [{ id: bruno.id, lastName: "Bruno Exemple", phone: "0600000000" }, { id: alice.id, firstName: "Alice", lastName: "Fictive" }] }));
    const after = await ws(backend);
    expect(after.renters).toHaveLength(2);
    expect(after.renters.find((r) => r.id === bruno.id)).toMatchObject({ phone: "0600000000" });
    expect(after.leaseRenters).toEqual([
      { leaseId: bail.id, renterId: bruno.id, sortOrder: 0 },
      { leaseId: bail.id, renterId: alice.id, sortOrder: 1 },
    ]);
    await expect(call(backend, "leases.upsert", lease(propertyId, { id: bail.id, renters: [{ lastName: "" }] }))).rejects.toThrow("invalide");
    await expect(call(backend, "renters.delete", { id: alice.id })).rejects.toThrow("retirez-le");
    await call(backend, "leases.upsert", lease(propertyId, { id: bail.id, renters: [{ id: bruno.id, lastName: "Bruno Exemple" }] }));
    await call(backend, "renters.delete", { id: alice.id });
    expect((await ws(backend)).renters).toHaveLength(1);
  });

  it("la liste des garanties envoyée remplace celle du bail", async () => {
    backend = await testBackend();
    const propertyId = await newProperty(backend);
    const bail = await call<{ id: string }>(backend, "leases.upsert", lease(propertyId, { guarantees: [{ kind: "caution", name: "Parent fictif", amount: 20_000, until: "2027-01-14" }, { kind: "gli", name: "Assureur fictif" }] }));
    const [caution] = (await ws(backend)).leaseGuarantees;
    expect(caution).toMatchObject({ leaseId: bail.id, kind: "caution", amount: 20_000, until: "2027-01-14", sortOrder: 0 });
    await call(backend, "leases.upsert", lease(propertyId, { id: bail.id, guarantees: [{ id: caution.id, kind: "caution", name: "Parent fictif", amount: 15_000 }] }));
    expect((await ws(backend)).leaseGuarantees).toMatchObject([{ id: caution.id, amount: 15_000, until: null }]);
  });
});

describe("reprise des données d'avant les lots", () => {
  it("migration : un lot par bien loué, le mode du dernier bail, un locataire par nom, le garant en caution", async () => {
    const provider = pgliteProvider();
    const session = await provider.session();
    await enterTenant(session, crypto.randomUUID());
    const raw = rawFor(session);
    await raw.exec("CREATE TABLE IF NOT EXISTS _hamac_migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    const before = migrations.filter((m) => m.tag < "0022");
    for (const m of before) {
      for (const statement of m.sql.split("--> statement-breakpoint")) if (statement.trim()) await raw.exec(statement);
      await raw.run("INSERT INTO _hamac_migrations (tag, applied_at) VALUES (?, ?)", [m.tag, "2026-01-01"]);
    }
    await raw.exec("INSERT INTO properties (id, kind, name, value_cents) VALUES ('p1', 'locatif', 'Studio', 10000000), ('p2', 'locatif', 'T2', 20000000), ('p3', 'residence_principale', 'Maison', 30000000)");
    await raw.exec(
      "INSERT INTO leases (id, property_id, kind, tenant, start_date, duration_months, rent_cents, guarantor) VALUES " +
        "('l1', 'p1', 'vide', 'Ancien Locataire', '2018-01-01', 36, 50000, ''), ('l2', 'p1', 'meuble', ' ancien locataire ', '2021-01-01', 12, 55000, 'Parent Fictif'), ('l3', 'p1', 'etudiant', '', '2024-09-01', 9, 60000, '')",
    );
    await migrate(raw);
    expect(await raw.all("SELECT id, rental_mode FROM properties ORDER BY id")).toEqual([
      { id: "p1", rental_mode: "meuble" },
      { id: "p2", rental_mode: "vide" },
      { id: "p3", rental_mode: "vide" },
    ]);
    const lots = await raw.all<{ id: string; property_id: string; name: string }>("SELECT id, property_id, name FROM lots ORDER BY property_id");
    expect(lots.map((l) => [l.property_id, l.name])).toEqual([["p1", "Logement"], ["p2", "Logement"]]);
    expect(new Set((await raw.all<{ lot_id: string }>("SELECT lot_id FROM leases")).map((l) => l.lot_id))).toEqual(new Set([lots[0].id]));
    expect(await raw.all("SELECT last_name FROM renters")).toEqual([{ last_name: "ancien locataire" }]);
    expect(await raw.all("SELECT lease_id FROM lease_renters ORDER BY lease_id")).toEqual([{ lease_id: "l1" }, { lease_id: "l2" }]);
    expect(await raw.all("SELECT lease_id, kind, name FROM lease_guarantees")).toEqual([{ lease_id: "l2", kind: "caution", name: "Parent Fictif" }]);
    await provider.close();
  });

  it("restaure une sauvegarde d'avant les lots", async () => {
    backend = await testBackend();
    const dump = {
      format: "hamac",
      version: 1,
      engine: "postgres",
      schemaVersion: "0021_clever_johnny_blaze",
      exportedAt: "x",
      appVersion: "test",
      tables: {
        properties: [{ id: "p1", kind: "locatif", name: "Studio", value_cents: 10_000_000 }],
        leases: [{ id: "l1", property_id: "p1", kind: "meuble", tenant: "Locataire Fictif", guarantor: "Parent Fictif", start_date: "2024-09-01", duration_months: 12, rent_cents: 60_000 }],
      },
    };
    expect((await backend.dispatch("data.import", { dump, confirm: "REMPLACER" })).ok).toBe(true);
    const w = await ws(backend);
    expect(w.properties).toMatchObject([{ id: "p1", rentalMode: "meuble" }]);
    expect(w.lots).toMatchObject([{ propertyId: "p1", name: "Logement", kind: "logement" }]);
    expect(w.leases).toMatchObject([{ id: "l1", lotId: w.lots[0].id }]);
    expect(w.renters).toMatchObject([{ lastName: "Locataire Fictif" }]);
    expect(w.leaseGuarantees).toMatchObject([{ leaseId: "l1", kind: "caution", name: "Parent Fictif" }]);
  });
});
