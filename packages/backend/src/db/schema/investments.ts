import { bigint, boolean, doublePrecision, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { timestamps } from "./_columns";

/** Plans obligataires et projets de crowdlending. */

export const bondPlans = pgTable("bond_plans", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  label: text("label").notNull(),
  targetYear: bigint("target_year", { mode: "number" }).notNull(),
  nominalCents: bigint("nominal_cents", { mode: "number" }).notNull(),
  comment: text("comment").notNull().default(""),
  ...timestamps,
});

export const crowdProjects = pgTable(
  "crowd_projects",
  {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  rate: doublePrecision("rate"),
  startDate: text("start_date").notNull(),
  termMonths: bigint("term_months", { mode: "number" }),
  repayment: text("repayment").notNull(),
  status: text("status").notNull().default("en_cours"),
  statusDate: text("status_date"),
  repaidCapitalCents: bigint("repaid_capital_cents", { mode: "number" }),
  expectedRecoveryCents: bigint("expected_recovery_cents", { mode: "number" }),
  inAllocation: boolean("in_allocation"),
  comment: text("comment").notNull().default(""),
  externalId: text("external_id"),
  extendedTo: text("extended_to"),
  ...timestamps,
},
  (t) => [uniqueIndex("crowd_external_uq").on(t.accountId, t.externalId)],
);
