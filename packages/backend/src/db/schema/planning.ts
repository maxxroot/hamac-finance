import { bigint, boolean, doublePrecision, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { timestamps } from "./_columns";

/** Projets, comptes qui les financent, donations et dépenses prévues. */

export const plannedExpenses = pgTable("planned_expenses", {
  id: text("id").primaryKey(),
  year: bigint("year", { mode: "number" }).notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  label: text("label").notNull(),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  ...timestamps,
});

/** Projets : une somme à réunir pour une date. */
export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  targetCents: bigint("target_cents", { mode: "number" }).notNull(),
  targetDate: text("target_date").notNull(),
  startDate: text("start_date").notNull(),
  rate: doublePrecision("rate").notNull().default(0),
  comment: text("comment").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  ...timestamps,
});

/** Comptes qui financent un projet : une part de leur valeur ou un montant réservé. */
export const goalAllocations = pgTable(
  "goal_allocations",
  {
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    /** Fraction (pourcentage) ou montant en euros (montant réservé). */
    value: doublePrecision("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.goalId, t.accountId] })],
);

/** Donations faites et reçues, pour suivre les abattements renouvelés tous les 15 ans. */
export const gifts = pgTable("gifts", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  direction: text("direction").notNull(),
  kind: text("kind").notNull(),
  person: text("person").notNull(),
  relation: text("relation").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  comment: text("comment").notNull().default(""),
  ...timestamps,
});
