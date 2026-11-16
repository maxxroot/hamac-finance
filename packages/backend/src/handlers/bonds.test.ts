import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations.generated";
import { enterTenant, rawFor } from "../db/postgres";
import type { Backend } from "../index";
import { pgliteProvider, testBackend } from "../testkit";

let backend: Backend | null = null;
afterEach(() => {
  backend?.close();
  backend = null;
});

const bond = { kind: "obligation", name: "OAT test", couponRate: 0.03, maturityDate: "2032-05-25", couponFrequency: 1, priceSource: "modele" };
const assets = async (b: Backend) => {
  const r = await b.dispatch("workspace.load", undefined);
  if (!r.ok) throw new Error(r.error.message);
  return (r.data as { assets: Array<Record<string, unknown>> }).assets;
};

describe("date de coupon d'une obligation", () => {
  it("facultative, et enregistrée quand elle est donnée", async () => {
    backend = await testBackend();
    expect((await backend.dispatch("assets.upsert", bond)).ok).toBe(true);
    expect((await assets(backend))[0]).toMatchObject({ nextCouponDate: null });
    expect((await backend.dispatch("assets.upsert", { ...bond, name: "OAT datée", nextCouponDate: "2026-12-10" })).ok).toBe(true);
    expect((await assets(backend)).find((a) => a.name === "OAT datée")).toMatchObject({ nextCouponDate: "2026-12-10" });
  });

  it("refusée après l'échéance", async () => {
    backend = await testBackend();
    const r = await backend.dispatch("assets.upsert", { ...bond, nextCouponDate: "2033-01-01" });
    expect(r.ok === false && r.error.message).toMatch(/précéder l'échéance/);
  });

  it("ignorée pour un titre qui n'est pas une obligation", async () => {
    backend = await testBackend();
    expect((await backend.dispatch("assets.upsert", { kind: "etf", name: "ETF", priceSource: "manuel", nextCouponDate: "2026-12-10" })).ok).toBe(true);
    expect((await assets(backend))[0]).toMatchObject({ nextCouponDate: null });
  });
});

describe("pays de l'État émetteur", () => {
  it("enregistré pour une obligation d'État : celui donné, sinon celui de l'ISIN, sinon la France", async () => {
    backend = await testBackend();
    await backend.dispatch("assets.upsert", { ...bond, name: "OLO", bondKind: "etat", issuerCountry: "BE", issuer: "République française" });
    await backend.dispatch("assets.upsert", { ...bond, name: "Par ISIN", bondKind: "etat", isin: "DE0001102580" });
    await backend.dispatch("assets.upsert", { ...bond, name: "Sans pays", bondKind: "etat" });
    await backend.dispatch("assets.upsert", { ...bond, name: "Entreprise", bondKind: "entreprise", issuer: "Société Fictive", issuerCountry: "BE" });
    const byName = new Map((await assets(backend)).map((a) => [a.name, a]));
    // L'émetteur saisi à côté d'un pays n'est pas gardé : il pourrait le contredire.
    expect(byName.get("OLO")).toMatchObject({ issuerCountry: "BE", issuer: null });
    expect(byName.get("Par ISIN")).toMatchObject({ issuerCountry: "DE" });
    expect(byName.get("Sans pays")).toMatchObject({ issuerCountry: "FR" });
    expect(byName.get("Entreprise")).toMatchObject({ issuerCountry: null, issuer: "Société Fictive" });
  });

  it("refuse un code qui n'est pas un État", async () => {
    backend = await testBackend();
    expect((await backend.dispatch("assets.upsert", { ...bond, bondKind: "etat", issuerCountry: "XS" })).ok).toBe(false);
  });

  it("migration : pays lu dans l'ISIN, nom « OAT » corrigé pour un autre État, émetteur retiré", async () => {
    const provider = pgliteProvider();
    const session = await provider.session();
    await enterTenant(session, crypto.randomUUID());
    const raw = rawFor(session);
    await raw.exec("CREATE TABLE IF NOT EXISTS _hamac_migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    for (const m of migrations.filter((x) => x.tag < "0034")) {
      for (const statement of m.sql.split("--> statement-breakpoint")) if (statement.trim()) await raw.exec(statement);
      await raw.run("INSERT INTO _hamac_migrations (tag, applied_at) VALUES (?, ?)", [m.tag, "2026-01-01"]);
    }
    await raw.exec(`INSERT INTO assets (id, kind, name, isin, issuer, bond_kind) VALUES
      ('oat', 'obligation', 'OAT 3 % mai 2033', 'FR0000000001', 'République française', 'etat'),
      ('olo', 'obligation', 'OAT 3 % juin 2033', 'BE0000000001', 'République française', 'etat'),
      ('sans', 'obligation', 'OAT 2 % mai 2030', NULL, NULL, 'etat'),
      ('xs', 'obligation', 'Titre XS', 'XS0000000001', NULL, 'etat'),
      ('tte', 'obligation', 'TotalEnergies 1 % avril 2027', 'XS0000000002', 'TotalEnergies', 'entreprise'),
      ('etf', 'etf', 'ETF', 'BE0000000002', NULL, NULL)`);
    await migrate(raw);
    expect(await raw.all("SELECT id, name, issuer, issuer_country FROM assets ORDER BY id")).toEqual([
      { id: "etf", name: "ETF", issuer: null, issuer_country: null },
      { id: "oat", name: "OAT 3 % mai 2033", issuer: null, issuer_country: "FR" },
      { id: "olo", name: "OLO 3 % juin 2033", issuer: null, issuer_country: "BE" },
      { id: "sans", name: "OAT 2 % mai 2030", issuer: null, issuer_country: "FR" },
      { id: "tte", name: "TotalEnergies 1 % avril 2027", issuer: "TotalEnergies", issuer_country: null },
      { id: "xs", name: "Titre XS", issuer: null, issuer_country: "FR" },
    ]);
    await provider.close();
  });
});
