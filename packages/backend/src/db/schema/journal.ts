import { bigint, doublePrecision, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { assets } from "./assets";
import { timestamps } from "./_columns";

/** Journal des opérations et versements programmés. */

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    type: text("type").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    assetId: text("asset_id").references(() => assets.id, { onDelete: "restrict" }),
    counterAccountId: text("counter_account_id").references(() => accounts.id, { onDelete: "restrict" }),
    /** Fonds euros d'arrivée d'un transfert vers un contrat ; null = son support par défaut. */
    counterAssetId: text("counter_asset_id").references(() => assets.id, { onDelete: "restrict" }),
    /** Arbitrage : quantité reçue du support d'arrivée (null pour un fonds euros). */
    counterQuantity: doublePrecision("counter_quantity"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    quantity: doublePrecision("quantity"),
    feeCents: bigint("fee_cents", { mode: "number" }),
    /** Obligation : coupon couru saisi à la main, compris dans `amount_cents` ; null = calculé d'après la date. */
    accruedCents: bigint("accrued_cents", { mode: "number" }),
    comment: text("comment").notNull().default(""),
    externalId: text("external_id"),
    /** Dividendes et intérêts : brut et retenues, facultatifs ; `amount_cents` reste le net crédité. */
    grossCents: bigint("gross_cents", { mode: "number" }),
    withheldIncomeTaxCents: bigint("withheld_income_tax_cents", { mode: "number" }),
    withheldSocialCents: bigint("withheld_social_cents", { mode: "number" }),
    withheldForeignCents: bigint("withheld_foreign_cents", { mode: "number" }),
    /** Titre en devise : taux de change appliqué (unités de la devise pour 1 €) ; null = taux BCE du jour. */
    fxRate: doublePrecision("fx_rate"),
    ...timestamps,
  },
  (t) => [
    index("tx_date_idx").on(t.date),
    index("tx_account_idx").on(t.accountId),
    index("tx_asset_idx").on(t.assetId),
    index("tx_counter_idx").on(t.counterAccountId),
    uniqueIndex("tx_external_uq").on(t.accountId, t.externalId),
  ],
);

export const contributionPlans = pgTable(
  "contribution_plans",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    fromMonth: text("from_month").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("plan_account_month_uq").on(t.accountId, t.fromMonth)],
);

export const contributionSkips = pgTable(
  "contribution_skips",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("skip_account_month_idx").on(t.accountId, t.month)],
);
