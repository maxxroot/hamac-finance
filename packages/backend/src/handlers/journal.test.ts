import { afterEach, describe, expect, it } from "vitest";
import type { Transaction } from "@hamac/core";
import type { Backend } from "../index";
import { enterTenant, rawFor } from "../db/postgres";
import { testBackend, testProvider } from "../testkit";

// Montants fictifs.

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

describe("retrait et versement sur un autre compte", () => {
  const tenantId = () => crypto.randomUUID();
  async function setup(tenant = tenantId()) {
    backend = await testBackend({ tenantId: tenant });
    const b = backend;
    const livret = await call<{ id: string }>(b, "accounts.upsert", { kind: "livret", name: "Livret fictif" });
    const cto = await call<{ id: string }>(b, "accounts.upsert", { kind: "cto", name: "CTO fictif" });
    const pair = (over: { withdrawal?: object; deposit?: object } = {}) => ({
      withdrawal: { date: "2026-03-02", type: "retrait", accountId: livret.id, amount: 400, comment: "Vers le CTO", ...over.withdrawal },
      deposit: { date: "2026-03-02", type: "versement", accountId: cto.id, amount: 400, comment: "Vers le CTO", ...over.deposit },
    });
    const transactions = async () => (await call<{ transactions: Transaction[] }>(b, "workspace.load")).transactions;
    return { b, livret, cto, pair, transactions };
  }

  it("enregistre les deux opérations, avec le même commentaire", async () => {
    const { b, livret, cto, pair, transactions } = await setup();
    const r = await call<{ withdrawal: Transaction; deposit: Transaction }>(b, "transactions.createWithdrawalAndDeposit", pair());
    expect(r.withdrawal).toMatchObject({ type: "retrait", accountId: livret.id, amount: 400, comment: "Vers le CTO" });
    expect(r.deposit).toMatchObject({ type: "versement", accountId: cto.id, amount: 400, comment: "Vers le CTO" });
    // Le versement est créé après le retrait : au journal (du plus récent au plus ancien), il passe au-dessus.
    expect((await transactions()).map((x) => x.type)).toEqual(["versement", "retrait"]);
  });

  it("le versement est créé juste après le retrait, même dans une seule transaction SQL", async () => {
    const tenant = tenantId();
    const { b, pair } = await setup(tenant);
    const r = await call<{ withdrawal: Transaction; deposit: Transaction }>(b, "transactions.createWithdrawalAndDeposit", pair());
    const session = await testProvider().session();
    await enterTenant(session, tenant);
    const raw = rawFor(session);
    const created = async (id: string) => (await raw.all<{ created_at: string }>("SELECT created_at FROM transactions WHERE id = ?", [id]))[0].created_at;
    expect(await created(r.deposit.id) > (await created(r.withdrawal.id))).toBe(true);
    await raw.close();
  });

  it("tout ou rien : un versement refusé n'enregistre pas le retrait", async () => {
    const { b, pair, transactions } = await setup();
    // Un compte-titres n'a pas de fonds euros : le support est refusé par la validation.
    const fund = await call<{ id: string }>(b, "assets.upsert", { kind: "fonds_euros", name: "Fonds fictif", priceSource: "modele" });
    const res = await b.dispatch("transactions.createWithdrawalAndDeposit", pair({ deposit: { assetId: fund.id } }));
    expect(res.ok).toBe(false);
    expect(await transactions()).toHaveLength(0);
  });

  it("refuse un même compte, un autre montant ou une autre date, un autre type", async () => {
    const { b, livret, pair, transactions } = await setup();
    for (const input of [
      pair({ deposit: { accountId: livret.id } }),
      pair({ deposit: { amount: 300 } }),
      pair({ deposit: { date: "2026-03-03" } }),
      pair({ withdrawal: { type: "versement" } }),
    ]) {
      const res = await b.dispatch("transactions.createWithdrawalAndDeposit", input);
      expect(res.ok === false && res.error.code).toBe("VALIDATION");
    }
    expect(await transactions()).toHaveLength(0);
  });
});
