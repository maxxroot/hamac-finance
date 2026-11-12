import { eq } from "drizzle-orm";
import { one } from "../../db/driver";
import { RpcError, type realestateProcedures } from "@hamac/api";
import { leaseEnd } from "@hamac/core";
import type { BackendContext } from "../../context";
import * as t from "../../db/schema";
import { newId, nowIso, toCents, mapLease, mapRentNotice, mapRentPayment, mapRentWaiver } from "../../repo";
import { OK, type DomainHandlers } from "../_types";

/** Loyers pointés, mois remis et relances. */

export const rentHandlers = {
  async "rentPayments.upsert"(input, ctx) {
    await rentMonthLease(ctx, input.leaseId, input.month);
    const id = input.id ?? newId();
    const row = { leaseId: input.leaseId, month: input.month, date: input.date, amountCents: toCents(input.amount), method: input.method, comment: input.comment, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.rentPayments).set(row).where(eq(t.rentPayments.id, id));
    else await ctx.db.insert(t.rentPayments).values({ id, ...row });
    return mapRentPayment((await ctx.db.select().from(t.rentPayments).where(eq(t.rentPayments.id, id)).limit(1).then(one))!);
  },

  async "rentPayments.addMany"({ payments }, ctx) {
    // Tout ou rien : un mois refusé n'en laisse pas d'autres à moitié pointés.
    await ctx.raw.transaction(async () => {
      for (const p of payments) {
        await rentMonthLease(ctx, p.leaseId, p.month);
        await ctx.db.insert(t.rentPayments).values({ id: newId(), leaseId: p.leaseId, month: p.month, date: p.date, amountCents: toCents(p.amount), method: p.method, comment: p.comment });
      }
    });
    return { count: payments.length };
  },

  async "rentPayments.delete"({ id }, ctx) {
    await ctx.db.delete(t.rentPayments).where(eq(t.rentPayments.id, id));
    return OK;
  },

  async "rentWaivers.set"(input, ctx) {
    await rentMonthLease(ctx, input.leaseId, input.month);
    const set = { comment: input.comment, updatedAt: nowIso() };
    const saved = await ctx.db
      .insert(t.rentWaivers)
      .values({ id: newId(), leaseId: input.leaseId, month: input.month, ...set })
      .onConflictDoUpdate({ target: [t.rentWaivers.leaseId, t.rentWaivers.month], set })
      .returning();
    return mapRentWaiver(saved[0]);
  },

  async "rentNotices.add"(input, ctx) {
    const lease = await ctx.db.select().from(t.leases).where(eq(t.leases.id, input.leaseId)).limit(1).then(one);
    if (!lease) throw new RpcError("NOT_FOUND", "Bail introuvable.");
    const saved = await ctx.db.insert(t.rentNotices).values({ id: newId(), leaseId: input.leaseId, level: input.level, sentOn: input.sentOn, amountCents: toCents(input.amount), comment: input.comment }).returning();
    return mapRentNotice(saved[0]);
  },

  async "rentNotices.delete"({ id }, ctx) {
    await ctx.db.delete(t.rentNotices).where(eq(t.rentNotices.id, id));
    return OK;
  },

  async "rentWaivers.delete"({ id }, ctx) {
    await ctx.db.delete(t.rentWaivers).where(eq(t.rentWaivers.id, id));
    return OK;
  },
} satisfies Partial<DomainHandlers<typeof realestateProcedures>>;

/** Bail d'un loyer pointé ou remis ; le mois doit tomber pendant le bail. */
async function rentMonthLease(ctx: BackendContext, leaseId: string, month: string) {
  const row = await ctx.db.select().from(t.leases).where(eq(t.leases.id, leaseId)).limit(1).then(one);
  if (!row) throw new RpcError("NOT_FOUND", "Bail introuvable.");
  const lease = mapLease(row);
  if (month < lease.startDate.slice(0, 7)) throw new RpcError("VALIDATION", "Ce mois précède le début du bail.");
  const end = leaseEnd(lease);
  if (end != null && month > end.slice(0, 7)) throw new RpcError("VALIDATION", "Ce mois suit la fin du bail.");
  return lease;
}
