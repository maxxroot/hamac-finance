import { bigint, boolean, doublePrecision, index, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { timestamps } from "./_columns";

/** Immobilier : sociétés, biens, lots, locataires, baux, loyers, charges, revenus, documents et rappels. */

/** Sociétés (SCI) qui détiennent des biens : l'utilisateur en détient une part des parts. */
export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  share: doublePrecision("share").notNull().default(1),
  comment: text("comment").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  ...timestamps,
});

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
  /** Mode de location : vide, meublé, colocation à bail unique ou par chambre. */
  rentalMode: text("rental_mode").notNull().default("vide"),
  saleDate: text("sale_date"),
  salePriceCents: bigint("sale_price_cents", { mode: "number" }),
  saleFeesCents: bigint("sale_fees_cents", { mode: "number" }).notNull().default(0),
  share: doublePrecision("share").notNull().default(1),
  companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
  /** Pleine propriété, usufruit ou nue-propriété, et ce qui sert à les évaluer (barème fiscal). */
  dismemberment: text("dismemberment").notNull().default("pleine"),
  usufructBirthDate: text("usufruct_birth_date"),
  usufructEnd: text("usufruct_end"),
  /** Provisions du cashflow prévu : un taux du loyer ou un montant par an, ou rien pour la valeur des réglages. */
  vacancyRate: doublePrecision("vacancy_rate"),
  vacancyAmountCents: bigint("vacancy_amount_cents", { mode: "number" }),
  worksRate: doublePrecision("works_rate"),
  worksAmountCents: bigint("works_amount_cents", { mode: "number" }),
  inAllocation: boolean("in_allocation"),
  classId: text("class_id"),
  comment: text("comment").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  ...timestamps,
});

/** Ce qui se loue dans un bien : logement entier, chambre, parking… */
export const lots = pgTable(
  "lots",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    surface: doublePrecision("surface"),
    targetRentCents: bigint("target_rent_cents", { mode: "number" }),
    comment: text("comment").notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    sortOrder: bigint("sort_order", { mode: "number" }).notNull().default(0),
    ...timestamps,
  },
  (t) => [index("lots_property_idx").on(t.propertyId)],
);

/** Locataires, qui peuvent avoir plusieurs baux successifs. */
export const renters = pgTable("renters", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  forwardingAddress: text("forwarding_address").notNull().default(""),
  comment: text("comment").notNull().default(""),
  ...timestamps,
});

/** Baux d'un lot : un seul à la fois par lot, avec des baux successifs possibles. */
export const leases = pgTable(
  "leases",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    lotId: text("lot_id")
      .notNull()
      .references(() => lots.id),
    kind: text("kind").notNull(),
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
    tenantInsuranceUntil: text("tenant_insurance_until"),
    revisable: boolean("revisable").notNull().default(true),
    irlQuarter: bigint("irl_quarter", { mode: "number" }),
    landlordAddress: text("landlord_address").notNull().default(""),
    /** Jour du mois où le loyer est dû. */
    dueDay: bigint("due_day", { mode: "number" }).notNull().default(1),
    ...timestamps,
  },
  (t) => [index("leases_property_idx").on(t.propertyId), index("leases_lot_idx").on(t.lotId)],
);

/** Locataires de chaque bail, dans l'ordre de saisie. */
export const leaseRenters = pgTable(
  "lease_renters",
  {
    leaseId: text("lease_id")
      .notNull()
      .references(() => leases.id, { onDelete: "cascade" }),
    renterId: text("renter_id")
      .notNull()
      .references(() => renters.id, { onDelete: "cascade" }),
    sortOrder: bigint("sort_order", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.leaseId, t.renterId] }), index("lease_renters_renter_idx").on(t.renterId)],
);

/** Garanties d'un bail : caution, Visale, assurance loyers impayés… */
export const leaseGuarantees = pgTable(
  "lease_guarantees",
  {
    id: text("id").primaryKey(),
    leaseId: text("lease_id")
      .notNull()
      .references(() => leases.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    name: text("name").notNull().default(""),
    contact: text("contact").notNull().default(""),
    amountCents: bigint("amount_cents", { mode: "number" }),
    until: text("until"),
    comment: text("comment").notNull().default(""),
    sortOrder: bigint("sort_order", { mode: "number" }).notNull().default(0),
    ...timestamps,
  },
  (t) => [index("lease_guarantees_lease_idx").on(t.leaseId)],
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

/** Rappels saisis à la main sur un bien : assemblée générale, entretien de la chaudière… */
export const propertyReminders = pgTable(
  "property_reminders",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    lotId: text("lot_id").references(() => lots.id, { onDelete: "set null" }),
    date: text("date").notNull(),
    yearly: boolean("yearly").notNull().default(false),
    label: text("label").notNull(),
    comment: text("comment").notNull().default(""),
    doneOn: text("done_on"),
    ...timestamps,
  },
  (t) => [index("property_reminders_property_idx").on(t.propertyId)],
);

/** Sommes reçues pour le loyer et les charges d'un mois : suivi strict, un loyer n'est reçu que pointé ici. */
export const rentPayments = pgTable(
  "rent_payments",
  {
    id: text("id").primaryKey(),
    leaseId: text("lease_id")
      .notNull()
      .references(() => leases.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    date: text("date").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    method: text("method").notNull().default("virement"),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("rent_payments_lease_idx").on(t.leaseId)],
);

/** Courriers de relance envoyés pour des loyers non reçus. */
export const rentNotices = pgTable(
  "rent_notices",
  {
    id: text("id").primaryKey(),
    leaseId: text("lease_id")
      .notNull()
      .references(() => leases.id, { onDelete: "cascade" }),
    level: text("level").notNull(),
    sentOn: text("sent_on").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("rent_notices_lease_idx").on(t.leaseId)],
);

/** Mois remis au locataire : rien n'est dû. */
export const rentWaivers = pgTable(
  "rent_waivers",
  {
    id: text("id").primaryKey(),
    leaseId: text("lease_id")
      .notNull()
      .references(() => leases.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("rent_waivers_lease_month_uq").on(t.leaseId, t.month)],
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
    /** Part récupérable sur le locataire, de 0 à 1. */
    recoverableRate: doublePrecision("recoverable_rate").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("property_expenses_property_idx").on(t.propertyId)],
);
