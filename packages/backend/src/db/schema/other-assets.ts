import { bigint, boolean, doublePrecision, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps } from "./_columns";

/** Autres biens et leurs estimations passées. */

/** Autres biens : or, objets de valeur, véhicules, parts de société non cotée, compte courant d'associé, argent prêté. */
export const otherAssets = pgTable("other_assets", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  valueCents: bigint("value_cents", { mode: "number" }).notNull(),
  valueDate: text("value_date"),
  purchasePriceCents: bigint("purchase_price_cents", { mode: "number" }),
  purchaseDate: text("purchase_date"),
  share: doublePrecision("share").notNull().default(1),
  dismemberment: text("dismemberment").notNull().default("pleine"),
  usufructBirthDate: text("usufruct_birth_date"),
  usufructEnd: text("usufruct_end"),
  depreciation: doublePrecision("depreciation"),
  quickSaleDiscount: doublePrecision("quick_sale_discount"),
  saleDelayMonths: bigint("sale_delay_months", { mode: "number" }),
  loanPrincipalCents: bigint("loan_principal_cents", { mode: "number" }),
  loanRate: doublePrecision("loan_rate"),
  loanTermMonths: bigint("loan_term_months", { mode: "number" }),
  loanFirstPayment: text("loan_first_payment"),
  classId: text("class_id"),
  inAllocation: boolean("in_allocation"),
  comment: text("comment").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  ...timestamps,
});

/** Estimations passées d'un autre bien (la dernière est sur le bien). */
export const otherAssetValues = pgTable(
  "other_asset_values",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => otherAssets.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    valueCents: bigint("value_cents", { mode: "number" }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("other_asset_values_asset_date_uq").on(t.assetId, t.date)],
);
