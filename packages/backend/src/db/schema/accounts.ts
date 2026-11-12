import { bigint, boolean, doublePrecision, pgTable, primaryKey, text, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { timestamps } from "./_columns";

/** Établissements, comptes, taux datés, relevés, taux servis et documents fiscaux. */

/** Banques, courtiers, assureurs, plateformes crypto, avec leurs grilles de frais par type de compte. */
export const institutions = pgTable("institutions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  website: text("website").notNull().default(""),
  score: doublePrecision("score"),
  comment: text("comment").notNull().default(""),
  /** Offres par type de compte (JSON validé par Offers dans @hamac/core). */
  offers: text("offers").notNull().default("{}"),
  /** Récapitulatif fiscal et retenues habituelles (JSON validé par InstitutionTax dans @hamac/core). */
  tax: text("tax").notNull().default("{}"),
  /** Établissement garant et pays (JSON validé par InstitutionProtection dans @hamac/core). */
  protection: text("protection").notNull().default("{}"),
  ...timestamps,
});

/** Montants lus sur le document fiscal d'un établissement, pour les comparer au récapitulatif. */
export const taxStatementAmounts = pgTable(
  "tax_statement_amounts",
  {
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    year: bigint("year", { mode: "number" }).notNull(),
    box: text("box").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.institutionId, t.year, t.box] })],
);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  livretType: text("livret_type"),
  /** PER : « assurantiel » ou « bancaire » ; null pour les autres comptes. */
  perKind: text("per_kind"),
  name: text("name").notNull(),
  institutionId: text("institution_id").references(() => institutions.id, { onDelete: "set null" }),
  openedOn: text("opened_on"),
  depositCeilingCents: bigint("deposit_ceiling_cents", { mode: "number" }),
  rate: doublePrecision("rate"),
  role: text("role").notNull().default(""),
  beneficiaryClause: boolean("beneficiary_clause").notNull().default(false),
  entryFeeRate: doublePrecision("entry_fee_rate"),
  managementFeeRate: doublePrecision("management_fee_rate"),
  monthsToInvest: bigint("months_to_invest", { mode: "number" }),
  inAllocation: boolean("in_allocation"),
  /** Assurance-vie et PER : fonds euros qui reçoit l'argent du contrat sans support précisé. */
  defaultAssetId: text("default_asset_id").references((): AnyPgColumn => assets.id, { onDelete: "set null" }),
  /** Part détenue d'un compte joint (fraction). */
  share: doublePrecision("share").notNull().default(1),
  sortOrder: bigint("sort_order", { mode: "number" }).notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  ...timestamps,
});

export const fundRates = pgTable(
  "fund_rates",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /** Fonds euros du contrat dont c'est le taux servi. */
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    year: bigint("year", { mode: "number" }).notNull(),
    rate: doublePrecision("rate").notNull(),
    comment: text("comment").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.assetId, t.year] })],
);

export const statements = pgTable("statements", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  valueCents: bigint("value_cents", { mode: "number" }).notNull(),
  comment: text("comment").notNull().default(""),
  ...timestamps,
});

/** Historique des taux d'un compte (livrets) : taux en vigueur à partir d'une date. */
export const accountRates = pgTable(
  "account_rates",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    fromDate: text("from_date").notNull(),
    rate: doublePrecision("rate").notNull(),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("account_rates_account_date_uq").on(t.accountId, t.fromDate)],
);
