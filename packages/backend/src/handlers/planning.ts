import { eq } from "drizzle-orm";
import { one } from "../db/driver";
import { RpcError, type planningProcedures } from "@hamac/api";
import * as t from "../db/schema";
import { mapExpense, mapGift, mapGoal } from "../repo";
import { newId, nowIso, toCents } from "../db/units";
import { OK, type DomainHandlers } from "./_types";

/** Projets, donations et dépenses prévues. */

export const planningHandlers: DomainHandlers<typeof planningProcedures> = {
  async "goals.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { name: input.name, targetCents: toCents(input.target), targetDate: input.targetDate, startDate: input.startDate, rate: input.rate, comment: input.comment, archived: input.archived, updatedAt: nowIso() };
    const allocations = input.allocations.map((a) => ({ goalId: id, accountId: a.accountId, mode: a.mode, value: a.value }));
    await ctx.raw.transaction(async () => {
      if (input.id) {
        const res = await ctx.db.update(t.goals).set(row).where(eq(t.goals.id, id)).returning({ id: t.goals.id });
        if (!res.length) throw new RpcError("NOT_FOUND", "Projet introuvable.");
      } else await ctx.db.insert(t.goals).values({ id, ...row });
      await ctx.db.delete(t.goalAllocations).where(eq(t.goalAllocations.goalId, id));
      if (allocations.length) await ctx.db.insert(t.goalAllocations).values(allocations);
    });
    return mapGoal((await ctx.db.select().from(t.goals).where(eq(t.goals.id, id)).limit(1).then(one))!, input.allocations.map((a) => ({ accountId: a.accountId, mode: a.mode, value: a.value })));
  },

  async "goals.delete"({ id }, ctx) {
    await ctx.db.delete(t.goals).where(eq(t.goals.id, id));
    return OK;
  },

  async "gifts.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { date: input.date, direction: input.direction, kind: input.kind, person: input.person, relation: input.relation, amountCents: toCents(input.amount), comment: input.comment, updatedAt: nowIso() };
    if (input.id) {
      const res = await ctx.db.update(t.gifts).set(row).where(eq(t.gifts.id, id)).returning({ id: t.gifts.id });
      if (!res.length) throw new RpcError("NOT_FOUND", "Donation introuvable.");
    } else await ctx.db.insert(t.gifts).values({ id, ...row });
    return mapGift((await ctx.db.select().from(t.gifts).where(eq(t.gifts.id, id)).limit(1).then(one))!);
  },

  async "gifts.delete"({ id }, ctx) {
    await ctx.db.delete(t.gifts).where(eq(t.gifts.id, id));
    return OK;
  },

  async "plannedExpenses.upsert"(input, ctx) {
    const id = input.id ?? newId();
    const row = { year: input.year, amountCents: toCents(input.amount), label: input.label, accountId: input.accountId, updatedAt: nowIso() };
    if (input.id) await ctx.db.update(t.plannedExpenses).set(row).where(eq(t.plannedExpenses.id, id));
    else await ctx.db.insert(t.plannedExpenses).values({ id, ...row });
    return mapExpense((await ctx.db.select().from(t.plannedExpenses).where(eq(t.plannedExpenses.id, id)).limit(1).then(one))!);
  },

  async "plannedExpenses.delete"({ id }, ctx) {
    await ctx.db.delete(t.plannedExpenses).where(eq(t.plannedExpenses.id, id));
    return OK;
  },
};
