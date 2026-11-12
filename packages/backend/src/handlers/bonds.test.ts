import { afterEach, describe, expect, it } from "vitest";
import type { Backend } from "../index";
import { testBackend } from "../testkit";

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
