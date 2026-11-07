import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Schéma de la base. Toute modification se fait ici, puis :
 *   pnpm --filter @hamac/backend db:generate
 * qui produit la migration SQL et l'embarque dans migrations.generated.ts.
 *
 * Conventions : identifiants texte (UUID), montants en CENTIMES entiers (*_cents),
 * dates « AAAA-MM-JJ », mois « AAAA-MM », booléens en 0/1.
 */

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
};

/** Réglages clé → valeur JSON (paramètres du plan, préférences d'interface…). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Banques, courtiers, assureurs, plateformes crypto, avec leurs grilles de frais par type de compte. */
export const institutions = sqliteTable("institutions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  website: text("website").notNull().default(""),
  score: real("score"),
  comment: text("comment").notNull().default(""),
  /** Offres par type de compte (JSON validé par Offers dans @hamac/core). */
  offers: text("offers").notNull().default("{}"),
  ...timestamps,
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  livretType: text("livret_type"),
  name: text("name").notNull(),
  institutionId: text("institution_id").references(() => institutions.id, { onDelete: "set null" }),
  openedOn: text("opened_on"),
  depositCeilingCents: integer("deposit_ceiling_cents"),
  rate: real("rate"),
  role: text("role").notNull().default(""),
  beneficiaryClause: integer("beneficiary_clause", { mode: "boolean" }).notNull().default(false),
  entryFeeRate: real("entry_fee_rate"),
  managementFeeRate: real("management_fee_rate"),
  monthsToInvest: integer("months_to_invest"),
  sortOrder: integer("sort_order").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    isin: text("isin"),
    symbol: text("symbol"),
    priceSource: text("price_source").notNull().default("manuel"),
    manualPrice: real("manual_price"),
    manualPriceDate: text("manual_price_date"),
    targetWeight: real("target_weight"),
    ter: real("ter"),
    couponRate: real("coupon_rate"),
    maturityDate: text("maturity_date"),
    couponFrequency: integer("coupon_frequency"),
    issuer: text("issuer"),
    bondKind: text("bond_kind"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index("assets_isin_idx").on(t.isin)],
);

export const transactions = sqliteTable(
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
    amountCents: integer("amount_cents").notNull(),
    quantity: real("quantity"),
    feeCents: integer("fee_cents"),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [
    index("tx_date_idx").on(t.date),
    index("tx_account_idx").on(t.accountId),
    index("tx_asset_idx").on(t.assetId),
    index("tx_counter_idx").on(t.counterAccountId),
  ],
);

export const contributionPlans = sqliteTable(
  "contribution_plans",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    fromMonth: text("from_month").notNull(),
    amountCents: integer("amount_cents").notNull(),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("plan_account_month_uq").on(t.accountId, t.fromMonth)],
);

export const contributionSkips = sqliteTable(
  "contribution_skips",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    amountCents: integer("amount_cents").notNull(),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("skip_account_month_idx").on(t.accountId, t.month)],
);

export const bondPlans = sqliteTable("bond_plans", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  label: text("label").notNull(),
  targetYear: integer("target_year").notNull(),
  nominalCents: integer("nominal_cents").notNull(),
  comment: text("comment").notNull().default(""),
  ...timestamps,
});

export const fundRates = sqliteTable(
  "fund_rates",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    rate: real("rate").notNull(),
    comment: text("comment").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.year] })],
);

export const statements = sqliteTable("statements", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  valueCents: integer("value_cents").notNull(),
  comment: text("comment").notNull().default(""),
  ...timestamps,
});

export const prices = sqliteTable(
  "prices",
  {
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    price: real("price").notNull(),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.date] })],
);

export const plannedExpenses = sqliteTable("planned_expenses", {
  id: text("id").primaryKey(),
  year: integer("year").notNull(),
  amountCents: integer("amount_cents").notNull(),
  label: text("label").notNull(),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  ...timestamps,
});

/** Liste des démarches à faire (cases à cocher). */
export const checklistItems = sqliteTable("checklist_items", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  note: text("note").notNull().default(""),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  doneAt: text("done_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

/** Historique des taux d'un compte (livrets) : taux en vigueur à partir d'une date. */
export const accountRates = sqliteTable(
  "account_rates",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    fromDate: text("from_date").notNull(),
    rate: real("rate").notNull(),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("account_rates_account_date_uq").on(t.accountId, t.fromDate)],
);
