import type { Gift, Goal, PlannedExpense } from "@hamac/core";
import * as t from "../../db/schema";
import { fromCents } from "../../db/units";

/** Lignes de la base → projets, donations et dépenses prévues. */

export const mapExpense = (r: typeof t.plannedExpenses.$inferSelect): PlannedExpense => ({
  id: r.id,
  year: r.year,
  amount: fromCents(r.amountCents),
  label: r.label,
  accountId: r.accountId,
});

export const mapGoal = (r: typeof t.goals.$inferSelect, allocations: Goal["allocations"] = []): Goal => ({ id: r.id, name: r.name, target: fromCents(r.targetCents), targetDate: r.targetDate, startDate: r.startDate, rate: r.rate, allocations, comment: r.comment, archived: r.archived });

export const mapGift = (r: typeof t.gifts.$inferSelect): Gift => ({ id: r.id, date: r.date, direction: r.direction as Gift["direction"], kind: r.kind as Gift["kind"], person: r.person, relation: r.relation as Gift["relation"], amount: fromCents(r.amountCents), comment: r.comment });
