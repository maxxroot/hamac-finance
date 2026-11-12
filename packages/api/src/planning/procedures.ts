import type { Gift, Goal, PlannedExpense } from "@hamac/core";
import { ok, byId, entity } from "../common";
import { GiftInput, GoalInput, PlannedExpenseInput } from "./inputs";

/** Projets, donations et dépenses prévues. */

export const planningProcedures = {
  "plannedExpenses.upsert": { input: PlannedExpenseInput, output: entity<PlannedExpense>() },
  "plannedExpenses.delete": { input: byId, output: ok },
  "goals.upsert": { input: GoalInput, output: entity<Goal>() },
  "goals.delete": { input: byId, output: ok },
  "gifts.upsert": { input: GiftInput, output: entity<Gift>() },
  "gifts.delete": { input: byId, output: ok },
} as const;
