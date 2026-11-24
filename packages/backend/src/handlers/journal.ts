import { and, eq } from "drizzle-orm";
import { one } from "../db/driver";
import { RpcError, type journalProcedures } from "@hamac/api";
import { validateTransaction, type Account, type Asset } from "@hamac/core";
import * as t from "../db/schema";
import { mapAccount, mapAsset, mapPlan, mapSkip, mapTx } from "../repo";
import { newId, nowIso, toCents } from "../db/units";
import { OK, type DomainHandlers } from "./_types";
import { assetsHandlers } from "./assets";

/** Journal des opérations, import en masse et versements programmés. */

export const journalHandlers: DomainHandlers<typeof journalProcedures> = {
  async "transactions.upsert"(input, ctx) {
    const [accounts, assets] = await Promise.all([ctx.db.select().from(t.accounts), ctx.db.select().from(t.assets)]);
    const accMap = new Map<string, Account>(accounts.map((a) => [a.id, mapAccount(a)]));
    const assetMap = new Map<string, Asset>(assets.map((a) => [a.id, mapAsset(a)]));
    const errors = validateTransaction(input, accMap, assetMap);
    if (errors.length) throw new RpcError("VALIDATION", errors.map((e) => e.message).join(" "), errors);

    const id = input.id ?? newId();
    const row = {
      date: input.date,
      type: input.type,
      accountId: input.accountId,
      assetId: input.assetId,
      counterAccountId: input.counterAccountId,
      counterAssetId: input.counterAssetId,
      amountCents: toCents(input.amount),
      quantity: input.quantity,
      counterQuantity: input.counterQuantity,
      feeCents: input.fee == null ? null : toCents(input.fee),
      accruedCents: input.accrued == null ? null : toCents(input.accrued),
      comment: input.comment,
      grossCents: input.gross == null ? null : toCents(input.gross),
      withheldIncomeTaxCents: input.withheldIncomeTax == null ? null : toCents(input.withheldIncomeTax),
      withheldSocialCents: input.withheldSocial == null ? null : toCents(input.withheldSocial),
      withheldForeignCents: input.withheldForeign == null ? null : toCents(input.withheldForeign),
      fxRate: input.fxRate,
      updatedAt: nowIso(),
    };
    if (input.id) {
      const res = await ctx.db.update(t.transactions).set(row).where(eq(t.transactions.id, id)).returning({ id: t.transactions.id });
      if (res.length === 0) throw new RpcError("NOT_FOUND", "Opération introuvable.");
    } else {
      await ctx.db.insert(t.transactions).values({ id, ...row });
    }
    return mapTx((await ctx.db.select().from(t.transactions).where(eq(t.transactions.id, id)).limit(1).then(one))!);
  },

  async "transactions.createWithAsset"({ asset, transaction }, ctx) {
    // Une seule transaction : si l'opération est refusée, le titre n'est pas créé.
    return ctx.raw.transaction(async () => {
      const created = await assetsHandlers["assets.upsert"](asset, ctx);
      const tx = await journalHandlers["transactions.upsert"]({ ...transaction, assetId: created.id }, ctx);
      return { asset: created, transaction: tx };
    });
  },

  async "transactions.createWithdrawalAndDeposit"({ withdrawal, deposit }, ctx) {
    if (withdrawal.id || deposit.id) throw new RpcError("VALIDATION", "Retrait et versement liés : seulement à la création.");
    if (withdrawal.type !== "retrait" || deposit.type !== "versement") throw new RpcError("VALIDATION", "Il faut un retrait, puis un versement.");
    if (withdrawal.accountId === deposit.accountId) throw new RpcError("VALIDATION", "Choisissez un autre compte à créditer.");
    if (withdrawal.date !== deposit.date || withdrawal.amount !== deposit.amount) throw new RpcError("VALIDATION", "Le versement doit avoir la date et le montant du retrait.");
    // Une seule transaction : si le versement est refusé, le retrait n'est pas enregistré.
    return ctx.raw.transaction(async () => {
      const w = await journalHandlers["transactions.upsert"](withdrawal, ctx);
      const d = await journalHandlers["transactions.upsert"](deposit, ctx);
      // Même instant SQL pour les deux : le versement est daté juste après le retrait, pour l'ordre du journal.
      const row = await ctx.db.select({ createdAt: t.transactions.createdAt }).from(t.transactions).where(eq(t.transactions.id, w.id)).limit(1).then(one);
      if (row) await ctx.db.update(t.transactions).set({ createdAt: new Date(Date.parse(row.createdAt) + 1).toISOString() }).where(eq(t.transactions.id, d.id));
      return { withdrawal: w, deposit: d };
    });
  },

  async "transactions.delete"({ id }, ctx) {
    await ctx.db.delete(t.transactions).where(eq(t.transactions.id, id));
    return OK;
  },

  async "plans.set"(input, ctx) {
    const existing = await ctx.db
      .select()
      .from(t.contributionPlans)
      .where(and(eq(t.contributionPlans.accountId, input.accountId), eq(t.contributionPlans.fromMonth, input.fromMonth)))
      .limit(1).then(one);
    const id = existing?.id ?? newId();
    if (existing) {
      await ctx.db.update(t.contributionPlans).set({ amountCents: toCents(input.amount), comment: input.comment, updatedAt: nowIso() }).where(eq(t.contributionPlans.id, id));
    } else {
      await ctx.db.insert(t.contributionPlans).values({ id, accountId: input.accountId, fromMonth: input.fromMonth, amountCents: toCents(input.amount), comment: input.comment });
    }
    return mapPlan((await ctx.db.select().from(t.contributionPlans).where(eq(t.contributionPlans.id, id)).limit(1).then(one))!);
  },

  async "plans.delete"({ id }, ctx) {
    await ctx.db.delete(t.contributionPlans).where(eq(t.contributionPlans.id, id));
    return OK;
  },

  async "skips.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { accountId: input.accountId, month: input.month, amountCents: toCents(input.amount), comment: input.comment, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.contributionSkips).set(row).where(eq(t.contributionSkips.id, id));
    else await ctx.db.insert(t.contributionSkips).values({ id, ...row });
    return mapSkip((await ctx.db.select().from(t.contributionSkips).where(eq(t.contributionSkips.id, id)).limit(1).then(one))!);
  },

  async "skips.delete"({ id }, ctx) {
    await ctx.db.delete(t.contributionSkips).where(eq(t.contributionSkips.id, id));
    return OK;
  },

  async "transactions.bulkCreate"({ items }, ctx) {
    const [accounts, assets] = await Promise.all([ctx.db.select().from(t.accounts), ctx.db.select().from(t.assets)]);
    const accMap = new Map<string, Account>(accounts.map((a) => [a.id, mapAccount(a)]));
    const assetMap = new Map<string, Asset>(assets.map((a) => [a.id, mapAsset(a)]));
    const errors: Array<{ index: number; message: string }> = [];
    const valid = items.filter((tx, index) => {
      const errs = validateTransaction(tx, accMap, assetMap);
      if (errs.length) errors.push({ index, message: errs.map((e) => e.message).join(" ") });
      return errs.length === 0;
    });
    const ids: string[] = [];
    // Tout ou rien pour les lignes valides.
    await ctx.raw.transaction(async () => {
      const insert = "INSERT INTO transactions (id, date, type, account_id, asset_id, counter_account_id, amount_cents, quantity, fee_cents, comment, gross_cents, withheld_income_tax_cents, withheld_social_cents, withheld_foreign_cents, fx_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      const cents = (v: number | null | undefined) => (v == null ? null : toCents(v));
      for (const tx of valid) {
        const txId = newId();
        ids.push(txId);
        await ctx.raw.run(insert, [txId, tx.date, tx.type, tx.accountId, tx.assetId, tx.counterAccountId, toCents(tx.amount), tx.quantity, cents(tx.fee), tx.comment, cents(tx.gross), cents(tx.withheldIncomeTax), cents(tx.withheldSocial), cents(tx.withheldForeign), tx.fxRate ?? null]);
      }
    });
    return { created: valid.length, ids, errors };
  },
};
