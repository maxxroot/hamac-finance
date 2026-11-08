import { describe, expect, it } from "vitest";
import { pgliteProvider } from "../testkit";
import { testBackend } from "../testkit";
import { enterTenant, positional, rawFor, tenantNames } from "./postgres";
import { migrate, pendingMigrations } from "./migrate";

describe("PostgreSQL", () => {
  it("numérote les paramètres, sans toucher aux chaînes ni aux identifiants", () => {
    expect(positional(`SELECT '?', "a?" FROM t WHERE a = ? AND b = ?`)).toBe(`SELECT '?', "a?" FROM t WHERE a = $1 AND b = $2`);
  });

  it("n'accepte qu'un UUID comme tenant", () => {
    expect(() => tenantNames(`x"; DROP SCHEMA comptes; --`)).toThrow(/invalide/);
    expect(tenantNames("0123456789abcdef0123456789abcdef").schema).toBe("t_0123456789abcdef0123456789abcdef");
  });

  it("isole les tenants : ni les données d'un autre, ni les comptes de l'instance", async () => {
    const provider = pgliteProvider();
    const admin = rawFor(await provider.session());
    await admin.exec("CREATE SCHEMA comptes");
    await admin.exec("CREATE TABLE comptes.users (id text)");
    await admin.exec("REVOKE ALL ON SCHEMA public FROM PUBLIC");
    const [ida, idb] = [crypto.randomUUID(), crypto.randomUUID()];
    const open = async (id: string) => {
      const session = await provider.session();
      await enterTenant(session, id);
      const raw = rawFor(session);
      await migrate(raw);
      return raw;
    };
    const a = await open(ida);
    const b = await open(idb);
    await a.run("INSERT INTO settings (key, value, updated_at) VALUES ('secret', 'a', 'x')");
    expect(await b.all("SELECT key FROM settings")).toEqual([]);
    await expect(b.all(`SELECT * FROM "${tenantNames(ida).schema}".settings`)).rejects.toThrow(/permission denied/);
    await expect(b.all("SELECT * FROM comptes.users")).rejects.toThrow(/permission denied/);
    await expect(b.exec("CREATE TABLE public.vol (id text)")).rejects.toThrow(/permission denied/);
    await provider.close();
  });

  it("migrations : tenant neuf sans rien à sauvegarder, puis rien à rejouer", async () => {
    const provider = pgliteProvider();
    const session = await provider.session();
    await enterTenant(session, crypto.randomUUID());
    const raw = rawFor(session);
    expect(await pendingMigrations(raw)).toEqual([]);
    const version = await migrate(raw);
    expect(await migrate(raw)).toBe(version);
    expect(await pendingMigrations(raw)).toEqual([]);
    await provider.close();
  });

  it("restaure une sauvegarde de l'ancien bureau (numéro de schéma à part, booléens 0 ou 1)", async () => {
    const b = await testBackend();
    const dump = {
      format: "hamac",
      version: 1,
      schemaVersion: "0019_neat_venom",
      exportedAt: "x",
      appVersion: "bureau",
      tables: { accounts: [{ id: "c1", kind: "cto", name: "Compte", archived: 0, in_allocation: 1, created_at: "2026-01-01", updated_at: "2026-01-01" }] },
    };
    const res = await b.dispatch("data.import", { dump, confirm: "REMPLACER" });
    expect(res.ok).toBe(true);
    const ws = await b.dispatch("workspace.load", undefined);
    if (!ws.ok) throw new Error(ws.error.message);
    expect((ws.data as { accounts: Array<{ archived: boolean; inAllocation: boolean | null }> }).accounts[0]).toMatchObject({ archived: false, inAllocation: true });
    b.close();
  });
});
