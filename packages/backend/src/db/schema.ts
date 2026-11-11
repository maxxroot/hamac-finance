import { sql } from "drizzle-orm";
import { bigint, boolean, doublePrecision, index, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Schéma de la base. Toute modification se fait ici, puis :
 *   pnpm --filter @hamac/backend db:generate
 * qui produit la migration SQL et l'embarque dans migrations.generated.ts.
 *
 * Conventions : identifiants texte (UUID), montants en CENTIMES entiers (*_cents),
 * dates « AAAA-MM-JJ » et mois « AAAA-MM » en texte (les calculs travaillent sur ces chaînes).
 */

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
  updatedAt: text("updated_at").notNull().default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
};

/** Réglages clé → valeur JSON (paramètres du plan, préférences d'interface…). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

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
  /** Part détenue d'un compte joint (fraction). */
  share: doublePrecision("share").notNull().default(1),
  sortOrder: bigint("sort_order", { mode: "number" }).notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  ...timestamps,
});

export const assets = pgTable(
  "assets",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    isin: text("isin"),
    symbol: text("symbol"),
    priceSource: text("price_source").notNull().default("manuel"),
    priceProvider: text("price_provider"),
    priceUrl: text("price_url"),
    pricePath: text("price_path"),
    classId: text("class_id"),
    inAllocation: boolean("in_allocation"),
    manualPrice: doublePrecision("manual_price"),
    manualPriceDate: text("manual_price_date"),
    targetWeight: doublePrecision("target_weight"),
    ter: doublePrecision("ter"),
    couponRate: doublePrecision("coupon_rate"),
    maturityDate: text("maturity_date"),
    couponFrequency: bigint("coupon_frequency", { mode: "number" }),
    nextCouponDate: text("next_coupon_date"),
    issuer: text("issuer"),
    bondKind: text("bond_kind"),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("assets_isin_idx").on(t.isin)],
);

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
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    quantity: doublePrecision("quantity"),
    feeCents: bigint("fee_cents", { mode: "number" }),
    comment: text("comment").notNull().default(""),
    externalId: text("external_id"),
    /** Dividendes et intérêts : brut et retenues, facultatifs ; `amount_cents` reste le net crédité. */
    grossCents: bigint("gross_cents", { mode: "number" }),
    withheldIncomeTaxCents: bigint("withheld_income_tax_cents", { mode: "number" }),
    withheldSocialCents: bigint("withheld_social_cents", { mode: "number" }),
    withheldForeignCents: bigint("withheld_foreign_cents", { mode: "number" }),
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

export const bondPlans = pgTable("bond_plans", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  label: text("label").notNull(),
  targetYear: bigint("target_year", { mode: "number" }).notNull(),
  nominalCents: bigint("nominal_cents", { mode: "number" }).notNull(),
  comment: text("comment").notNull().default(""),
  ...timestamps,
});

export const fundRates = pgTable(
  "fund_rates",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    year: bigint("year", { mode: "number" }).notNull(),
    rate: doublePrecision("rate").notNull(),
    comment: text("comment").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.year] })],
);

export const statements = pgTable("statements", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  valueCents: bigint("value_cents", { mode: "number" }).notNull(),
  /** Espèces relevées ; null si non relevées. */
  cashCents: bigint("cash_cents", { mode: "number" }),
  comment: text("comment").notNull().default(""),
  ...timestamps,
});

/** Quantités relevées titre par titre, pour les rapprocher du calcul. */
export const statementPositions = pgTable(
  "statement_positions",
  {
    statementId: text("statement_id")
      .notNull()
      .references(() => statements.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    quantity: doublePrecision("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.statementId, t.assetId] })],
);

export const prices = pgTable(
  "prices",
  {
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    price: doublePrecision("price").notNull(),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.date] })],
);

export const plannedExpenses = pgTable("planned_expenses", {
  id: text("id").primaryKey(),
  year: bigint("year", { mode: "number" }).notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  label: text("label").notNull(),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
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

/** Sociétés (SCI) qui détiennent des biens : l'utilisateur en détient une part des parts. */
export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  share: doublePrecision("share").notNull().default(1),
  comment: text("comment").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  ...timestamps,
});

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

export const properties = pgTable("properties", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  ownership: text("ownership").notNull().default("nom_propre"),
  name: text("name").notNull(),
  valueCents: bigint("value_cents", { mode: "number" }).notNull(),
  valueDate: text("value_date"),
  purchasePriceCents: bigint("purchase_price_cents", { mode: "number" }),
  purchaseDate: text("purchase_date"),
  newBuild: boolean("new_build").notNull().default(false),
  notaryFeesCents: bigint("notary_fees_cents", { mode: "number" }).notNull().default(0),
  agencyFeesCents: bigint("agency_fees_cents", { mode: "number" }).notNull().default(0),
  initialWorksCents: bigint("initial_works_cents", { mode: "number" }).notNull().default(0),
  otherFeesCents: bigint("other_fees_cents", { mode: "number" }).notNull().default(0),
  propertyType: text("property_type"),
  address: text("address").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  city: text("city").notNull().default(""),
  surface: doublePrecision("surface"),
  rooms: bigint("rooms", { mode: "number" }),
  bedrooms: bigint("bedrooms", { mode: "number" }),
  floor: bigint("floor", { mode: "number" }),
  buildYear: bigint("build_year", { mode: "number" }),
  outdoor: text("outdoor").notNull().default(""),
  parking: boolean("parking").notNull().default(false),
  cellar: boolean("cellar").notNull().default(false),
  heating: text("heating").notNull().default(""),
  coOwnership: boolean("co_ownership").notNull().default(false),
  syndic: text("syndic").notNull().default(""),
  dpe: text("dpe"),
  ges: text("ges"),
  dpeDate: text("dpe_date"),
  dpeReminders: boolean("dpe_reminders").notNull().default(true),
  saleDate: text("sale_date"),
  salePriceCents: bigint("sale_price_cents", { mode: "number" }),
  saleFeesCents: bigint("sale_fees_cents", { mode: "number" }).notNull().default(0),
  share: doublePrecision("share").notNull().default(1),
  companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
  /** Pleine propriété, usufruit ou nue-propriété, et ce qui sert à les évaluer (barème fiscal). */
  dismemberment: text("dismemberment").notNull().default("pleine"),
  usufructBirthDate: text("usufruct_birth_date"),
  usufructEnd: text("usufruct_end"),
  inAllocation: boolean("in_allocation"),
  classId: text("class_id"),
  comment: text("comment").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  ...timestamps,
});

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

/** Baux d'un bien en location : une seule location à la fois, avec des baux successifs possibles. */
export const leases = pgTable(
  "leases",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    tenant: text("tenant").notNull().default(""),
    startDate: text("start_date").notNull(),
    durationMonths: bigint("duration_months", { mode: "number" }).notNull(),
    rentCents: bigint("rent_cents", { mode: "number" }).notNull(),
    chargesCents: bigint("charges_cents", { mode: "number" }).notNull().default(0),
    depositCents: bigint("deposit_cents", { mode: "number" }).notNull().default(0),
    noticeBy: text("notice_by"),
    noticeDate: text("notice_date"),
    noticeMonths: bigint("notice_months", { mode: "number" }),
    actualEnd: text("actual_end"),
    comment: text("comment").notNull().default(""),
    reminders: boolean("reminders").notNull().default(true),
    depositReturnedCents: bigint("deposit_returned_cents", { mode: "number" }),
    depositReturnedOn: text("deposit_returned_on"),
    depositReason: text("deposit_reason").notNull().default(""),
    landlord: text("landlord").notNull().default(""),
    guarantor: text("guarantor").notNull().default(""),
    tenantInsuranceUntil: text("tenant_insurance_until"),
    revisable: boolean("revisable").notNull().default(true),
    irlQuarter: bigint("irl_quarter", { mode: "number" }),
    landlordAddress: text("landlord_address").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("leases_property_idx").on(t.propertyId)],
);

/** Nouveaux loyers d'un bail, en vigueur à partir d'un mois. */
export const leaseRents = pgTable(
  "lease_rents",
  {
    id: text("id").primaryKey(),
    leaseId: text("lease_id")
      .notNull()
      .references(() => leases.id, { onDelete: "cascade" }),
    fromMonth: text("from_month").notNull(),
    rentCents: bigint("rent_cents", { mode: "number" }).notNull(),
    chargesCents: bigint("charges_cents", { mode: "number" }).notNull().default(0),
    revisionAnniversary: text("revision_anniversary"),
    revisionDemandDate: text("revision_demand_date"),
    revisionPreviousRentCents: bigint("revision_previous_rent_cents", { mode: "number" }),
    revisionQuarterNew: text("revision_quarter_new"),
    revisionQuarterOld: text("revision_quarter_old"),
    revisionIndexNew: doublePrecision("revision_index_new"),
    revisionIndexOld: doublePrecision("revision_index_old"),
    ...timestamps,
  },
  (t) => [uniqueIndex("lease_rents_lease_month_uq").on(t.leaseId, t.fromMonth)],
);

/** Anciennes estimations d'un bien ; la plus récente reste sur le bien lui-même. */
export const propertyValues = pgTable(
  "property_values",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    valueCents: bigint("value_cents", { mode: "number" }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("property_values_property_date_uq").on(t.propertyId, t.date)],
);

/** Recettes d'un bien hors loyer : régularisations de charges, indemnités. */
export const propertyIncomes = pgTable(
  "property_incomes",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    category: text("category").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    label: text("label").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("property_incomes_property_idx").on(t.propertyId)],
);

/** Registre des documents d'un bien : leur emplacement, pas les fichiers. */
export const propertyDocuments = pgTable(
  "property_documents",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    date: text("date"),
    expiresOn: text("expires_on"),
    location: text("location").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("property_documents_property_idx").on(t.propertyId)],
);

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

/** Écarts signalés sur les loyers : sans ligne ici, le loyer prévu du mois est réputé perçu. */
export const rentExceptions = pgTable(
  "rent_exceptions",
  {
    id: text("id").primaryKey(),
    leaseId: text("lease_id")
      .notNull()
      .references(() => leases.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    kind: text("kind").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("rent_exceptions_lease_month_uq").on(t.leaseId, t.month)],
);

/** Dépenses d'un bien en location, pour le bien entier ; `yearly` les répète à la même date chaque année. */
export const propertyExpenses = pgTable(
  "property_expenses",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    category: text("category").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    label: text("label").notNull().default(""),
    yearly: boolean("yearly").notNull().default(false),
    untilYear: bigint("until_year", { mode: "number" }),
    improvement: boolean("improvement").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("property_expenses_property_idx").on(t.propertyId)],
);

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
