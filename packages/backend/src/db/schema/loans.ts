import { bigint, boolean, doublePrecision, index, pgTable, text } from "drizzle-orm/pg-core";
import { properties } from "./realestate";
import { timestamps } from "./_columns";

/** Crédits et remboursements anticipés. */

export const loans = pgTable("loans", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull().default("immobilier"),
  name: text("name").notNull(),
  propertyId: text("property_id").references(() => properties.id, { onDelete: "set null" }),
  share: doublePrecision("share").notNull().default(1),
  principalCents: bigint("principal_cents", { mode: "number" }).notNull(),
  rate: doublePrecision("rate").notNull(),
  termMonths: bigint("term_months", { mode: "number" }).notNull(),
  firstPayment: text("first_payment").notNull(),
  insuranceMode: text("insurance_mode").notNull().default("montant"),
  insuranceCents: bigint("insurance_cents", { mode: "number" }).notNull().default(0),
  insuranceRate: doublePrecision("insurance_rate").notNull().default(0),
  manualPaymentCents: bigint("manual_payment_cents", { mode: "number" }),
  manualBalanceCents: bigint("manual_balance_cents", { mode: "number" }),
  manualBalanceDate: text("manual_balance_date"),
  archived: boolean("archived").notNull().default(false),
  closedOn: text("closed_on"),
  deferredMonths: bigint("deferred_months", { mode: "number" }).notNull().default(0),
  deferredKind: text("deferred_kind").notNull().default("partiel"),
  ...timestamps,
});

/** Remboursements anticipés d'un crédit. */
export const loanPrepayments = pgTable(
  "loan_prepayments",
  {
    id: text("id").primaryKey(),
    loanId: text("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    feeCents: bigint("fee_cents", { mode: "number" }).notNull().default(0),
    mode: text("mode").notNull().default("duree"),
    ...timestamps,
  },
  (t) => [index("loan_prepayments_loan_idx").on(t.loanId)],
);
