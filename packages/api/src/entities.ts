import { z } from "zod";
import { ACCOUNT_KINDS, ASSET_KINDS, DISMEMBERMENTS, GOAL_ALLOCATION_MODES, GIFT_DIRECTIONS, GIFT_KINDS, GIFT_RELATIONS, OTHER_ASSET_KINDS, BOND_KINDS, CROWD_REPAYMENTS, CROWD_STATUSES, INSTITUTION_KINDS, InstitutionProtection, InstitutionTax, LIVRET_TYPES, LOAN_INSURANCE_MODES, LOAN_KINDS, Offers, PRICE_PROVIDERS, PRICE_SOURCES, PROPERTY_KINDS, PROPERTY_OWNERSHIPS, PROPERTY_TYPES, ENERGY_LETTERS, LEASE_KINDS, LEASE_NOTICE_BY, LEASE_GUARANTEE_KINDS, LOT_KINDS, RENTAL_MODES, PAYMENT_METHODS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, DOCUMENT_KINDS, LOAN_DEFERRED_KINDS, LOAN_PREPAYMENT_MODES, TX_TYPES, isIsoDate } from "@hamac/core";

const id = z.string().min(1);
const isoDate = z.string().refine(isIsoDate, "Date invalide (AAAA-MM-JJ)");
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mois invalide (AAAA-MM)");
const money = z.number().finite();
const rate = z.number().min(-1).max(1);
const text = (max = 500) => z.string().trim().max(max);

export const AccountInput = z.object({
  id: id.optional(),
  kind: z.enum(ACCOUNT_KINDS),
  livretType: z.enum(LIVRET_TYPES).nullable().default(null),
  name: text(80).min(1, "Nom requis"),
  institutionId: id.nullable().default(null),
  openedOn: isoDate.nullable().default(null),
  depositCeiling: money.min(0).nullable().default(null),
  rate: rate.nullable().default(null),
  /** Date à partir de laquelle `rate` s'applique (livrets) ; aujourd'hui par défaut. */
  rateFrom: isoDate.nullable().default(null),
  role: text(200).default(""),
  beneficiaryClause: z.boolean().default(false),
  entryFeeRate: rate.nullable().default(null),
  managementFeeRate: rate.nullable().default(null),
  monthsToInvest: z.number().int().min(1).max(240).nullable().default(null),
  inAllocation: z.boolean().nullable().default(null),
  /** Part détenue d'un compte joint ; 1 pour un compte individuel. */
  share: z.number().gt(0, "Part détenue requise").max(1).default(1),
  sortOrder: z.number().int().default(0),
  archived: z.boolean().default(false),
});
export type AccountInput = z.input<typeof AccountInput>;

export const MarketSeriesInput = z
  .object({
    kind: z.enum(["etf", "action", "fonds", "crypto"]),
    isin: z.string().trim().toUpperCase().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, "ISIN invalide").nullable().default(null),
    symbol: text(40).nullable().default(null),
  })
  .refine((a) => a.isin != null || a.symbol != null, { path: ["isin"], message: "ISIN ou symbole requis." });
export type MarketSeriesInput = z.input<typeof MarketSeriesInput>;

export const AssetInput = z.object({
  id: id.optional(),
  kind: z.enum(ASSET_KINDS),
  name: text(120).min(1, "Nom requis"),
  isin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, "ISIN invalide (12 caractères, ex. FR0011871128)")
    .nullable()
    .default(null),
  symbol: text(40).nullable().default(null),
  priceSource: z.enum(PRICE_SOURCES).default("manuel"),
  priceProvider: z.enum(PRICE_PROVIDERS).nullable().default(null),
  priceUrl: z.string().trim().url("Adresse invalide").max(500).nullable().default(null),
  pricePath: text(200).nullable().default(null),
  classId: id.nullable().default(null),
  inAllocation: z.boolean().nullable().default(null),
  manualPrice: money.min(0).nullable().default(null),
  manualPriceDate: isoDate.nullable().default(null),
  targetWeight: z.number().min(0).max(1).nullable().default(null),
  ter: rate.nullable().default(null),
  couponRate: rate.nullable().default(null),
  maturityDate: isoDate.nullable().default(null),
  couponFrequency: z.number().int().min(1).max(12).nullable().default(null),
  nextCouponDate: isoDate.nullable().default(null),
  issuer: text(80).nullable().default(null),
  bondKind: z.enum(BOND_KINDS).nullable().default(null),
  archived: z.boolean().default(false),
});
export type AssetInput = z.input<typeof AssetInput>;

export const TransactionInput = z.object({
  id: id.optional(),
  date: isoDate,
  type: z.enum(TX_TYPES),
  accountId: id,
  assetId: id.nullable().default(null),
  counterAccountId: id.nullable().default(null),
  amount: money,
  quantity: z.number().positive().nullable().default(null),
  fee: money.min(0).nullable().default(null),
  comment: text(500).default(""),
  gross: money.min(0).nullable().default(null),
  withheldIncomeTax: money.min(0).nullable().default(null),
  withheldSocial: money.min(0).nullable().default(null),
  withheldForeign: money.min(0).nullable().default(null),
});
export type TransactionInput = z.input<typeof TransactionInput>;

export const PlanInput = z.object({
  accountId: id,
  fromMonth: month,
  amount: money.min(0),
  comment: text(200).default(""),
});
export const SkipInput = z.object({
  id: id.optional(),
  accountId: id,
  month,
  amount: money.positive(),
  comment: text(200).default(""),
});
export const BondPlanInput = z.object({
  id: id.optional(),
  accountId: id.nullable().default(null),
  label: text(120).min(1),
  targetYear: z.number().int().min(2000).max(2150),
  nominal: money.positive(),
  comment: text(200).default(""),
});
export const FundRateInput = z.object({
  accountId: id,
  year: z.number().int().min(1990).max(2150),
  rate,
  comment: text(200).default(""),
});
export const StatementInput = z.object({
  id: id.optional(),
  accountId: id,
  date: isoDate,
  value: money,
  comment: text(200).default(""),
});
export const PlannedExpenseInput = z.object({
  id: id.optional(),
  year: z.number().int().min(2000).max(2200),
  amount: money.positive(),
  label: text(120).min(1),
  accountId: id.nullable().default(null),
});
export const CrowdProjectInput = z.object({
  id: id.optional(),
  accountId: id,
  name: text(160).min(1, "Nom requis"),
  amount: money.positive("Montant investi requis"),
  rate: z.number().min(0).max(1).nullable().default(null),
  startDate: isoDate,
  termMonths: z.number().int().min(1).max(600).nullable().default(null),
  repayment: z.enum(CROWD_REPAYMENTS).default("in_fine"),
  status: z.enum(CROWD_STATUSES).default("en_cours"),
  statusDate: isoDate.nullable().default(null),
  extendedTo: isoDate.nullable().default(null),
  repaidCapital: money.min(0).nullable().default(null),
  expectedRecovery: money.min(0).nullable().default(null),
  inAllocation: z.boolean().nullable().default(null),
  comment: text(500).default(""),
});
export type CrowdProjectInput = z.input<typeof CrowdProjectInput>;

/** Résultat validé d'un import de plateforme, appliqué en une seule fois. */
export const CrowdImportInput = z.object({
  accountId: id,
  transactions: z
    .array(z.object({ action: z.enum(["nouveau", "modifie", "retire"]), id: id.nullable(), externalId: text(200).min(1), date: isoDate, type: z.enum(TX_TYPES), amount: money, comment: text(500) }))
    .max(20_000),
  projects: z
    .array(z.object({ action: z.enum(["nouveau", "modifie"]), id: id.nullable(), externalId: text(300).min(1), name: text(160).min(1), amount: money.positive(), startDate: isoDate, repaidCapital: money.min(0), status: z.enum(CROWD_STATUSES), statusDate: isoDate.nullable(), comment: text(500) }))
    .max(5_000),
});
export type CrowdImportInput = z.input<typeof CrowdImportInput>;

export const PropertyInput = z.object({
  id: id.optional(),
  kind: z.enum(PROPERTY_KINDS),
  ownership: z.enum(PROPERTY_OWNERSHIPS).default("nom_propre"),
  name: text(120).min(1, "Nom requis"),
  value: money.min(0),
  valueDate: isoDate.nullable().default(null),
  purchasePrice: money.min(0).nullable().default(null),
  purchaseDate: isoDate.nullable().default(null),
  newBuild: z.boolean().default(false),
  notaryFees: money.min(0).default(0),
  agencyFees: money.min(0).default(0),
  initialWorks: money.min(0).default(0),
  otherFees: money.min(0).default(0),
  propertyType: z.enum(PROPERTY_TYPES).nullable().default(null),
  address: text(200).default(""),
  postalCode: text(10).default(""),
  city: text(120).default(""),
  surface: z.number().positive("Surface invalide").max(1_000_000).nullable().default(null),
  rooms: z.number().int().min(0).max(999).nullable().default(null),
  bedrooms: z.number().int().min(0).max(999).nullable().default(null),
  floor: z.number().int().min(-10).max(300).nullable().default(null),
  buildYear: z.number().int().min(1000).max(2200).nullable().default(null),
  outdoor: text(120).default(""),
  parking: z.boolean().default(false),
  cellar: z.boolean().default(false),
  heating: text(120).default(""),
  coOwnership: z.boolean().default(false),
  syndic: text(120).default(""),
  dpe: z.enum(ENERGY_LETTERS).nullable().default(null),
  ges: z.enum(ENERGY_LETTERS).nullable().default(null),
  dpeDate: isoDate.nullable().default(null),
  dpeReminders: z.boolean().default(true),
  rentalMode: z.enum(RENTAL_MODES).default("vide"),
  share: z.number().gt(0, "Part détenue requise").max(1).default(1),
  companyId: id.nullable().default(null),
  dismemberment: z.enum(DISMEMBERMENTS).default("pleine"),
  usufructBirthDate: isoDate.nullable().default(null),
  usufructEnd: isoDate.nullable().default(null),
  inAllocation: z.boolean().nullable().default(null),
  classId: id.nullable().default(null),
  comment: text(500).default(""),
  archived: z.boolean().default(false),
})
  .refine((p) => p.dismemberment === "pleine" || p.usufructBirthDate != null || p.usufructEnd != null, { path: ["usufructBirthDate"], message: "Indiquez la date de naissance de l'usufruitier, ou la fin de l'usufruit s'il est à durée fixe." });
export type PropertyInput = z.input<typeof PropertyInput>;

export const PropertySaleInput = z.object({
  id,
  saleDate: isoDate,
  salePrice: money.min(0),
  saleFees: money.min(0).default(0),
  closeLoans: z.boolean().default(true),
});

export const PropertyValueInput = z.object({
  propertyId: id,
  date: isoDate,
  value: money.min(0),
});

export const LotInput = z.object({
  id: id.optional(),
  propertyId: id,
  name: text(80).min(1, "Nom requis"),
  kind: z.enum(LOT_KINDS),
  surface: z.number().positive("Surface invalide").max(100_000).nullable().default(null),
  targetRent: money.min(0).nullable().default(null),
  comment: text(500).default(""),
  archived: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export type LotInput = z.input<typeof LotInput>;

export const RenterInput = z
  .object({
    id: id.optional(),
    firstName: text(80).default(""),
    lastName: text(120).default(""),
    email: text(200).default(""),
    phone: text(40).default(""),
    forwardingAddress: text(300).default(""),
    comment: text(500).default(""),
  })
  .refine((r) => r.firstName !== "" || r.lastName !== "", { path: ["lastName"], message: "Indiquez le nom du locataire." });
export type RenterInput = z.input<typeof RenterInput>;

export const LeaseGuaranteeInput = z.object({
  id: id.optional(),
  kind: z.enum(LEASE_GUARANTEE_KINDS),
  name: text(120).default(""),
  contact: text(300).default(""),
  amount: money.min(0).nullable().default(null),
  until: isoDate.nullable().default(null),
  comment: text(300).default(""),
});
export type LeaseGuaranteeInput = z.input<typeof LeaseGuaranteeInput>;

export const LeaseInput = z
  .object({
    id: id.optional(),
    propertyId: id,
    /** Lot loué ; null = le seul lot du bien, créé au besoin. */
    lotId: id.nullable().default(null),
    kind: z.enum(LEASE_KINDS),
    /** Locataires du bail, dans l'ordre : créés, mis à jour ou repris par leur id. */
    renters: z.array(RenterInput).max(12).default([]),
    guarantees: z.array(LeaseGuaranteeInput).max(12).default([]),
    startDate: isoDate,
    durationMonths: z.number().int().min(1).max(600),
    rent: money.min(0),
    charges: money.min(0).default(0),
    deposit: money.min(0).default(0),
    noticeBy: z.enum(LEASE_NOTICE_BY).nullable().default(null),
    noticeDate: isoDate.nullable().default(null),
    noticeMonths: z.number().int().min(1).max(24).nullable().default(null),
    actualEnd: isoDate.nullable().default(null),
    comment: text(500).default(""),
    reminders: z.boolean().default(true),
    depositReturned: money.min(0).nullable().default(null),
    depositReturnedOn: isoDate.nullable().default(null),
    depositReason: text(200).default(""),
    landlord: text(120).default(""),
    tenantInsuranceUntil: isoDate.nullable().default(null),
    revisable: z.boolean().default(true),
    irlQuarter: z.number().int().min(1).max(4).nullable().default(null),
    landlordAddress: text(300).default(""),
    dueDay: z.number().int().min(1).max(31).default(1),
  })
  .refine((l) => (l.noticeBy == null) === (l.noticeDate == null), { path: ["noticeDate"], message: "Indiquez qui donne congé et à quelle date." })
  .refine((l) => (l.depositReturned == null) === (l.depositReturnedOn == null), { path: ["depositReturnedOn"], message: "Indiquez le montant rendu et sa date." });
export type LeaseInput = z.input<typeof LeaseInput>;

const quarter = z.string().regex(/^\d{4}-Q[1-4]$/, "Trimestre invalide");

export const LeaseRentInput = z.object({
  id: id.optional(),
  leaseId: id,
  fromMonth: month,
  rent: money.min(0),
  charges: money.min(0).default(0),
  revision: z
    .object({ anniversary: isoDate, demandDate: isoDate, previousRent: money.positive(), quarterNew: quarter, quarterOld: quarter, indexNew: z.number().positive(), indexOld: z.number().positive() })
    .nullable()
    .default(null),
});
export type LeaseRentInput = z.input<typeof LeaseRentInput>;

export const RentPaymentInput = z.object({
  id: id.optional(),
  leaseId: id,
  month,
  date: isoDate,
  amount: money.positive("Montant requis"),
  method: z.enum(PAYMENT_METHODS).default("virement"),
  comment: text(200).default(""),
});
export type RentPaymentInput = z.input<typeof RentPaymentInput>;

export const RentPaymentsInput = z.object({ payments: z.array(RentPaymentInput.omit({ id: true })).min(1).max(2_000) });
export type RentPaymentsInput = z.input<typeof RentPaymentsInput>;

export const RentWaiverInput = z.object({ leaseId: id, month, comment: text(200).default("") });
export type RentWaiverInput = z.input<typeof RentWaiverInput>;

export const PropertyExpenseInput = z.object({
  id: id.optional(),
  propertyId: id,
  date: isoDate,
  category: z.enum(EXPENSE_CATEGORIES),
  amount: money.positive("Montant requis"),
  label: text(120).default(""),
  yearly: z.boolean().default(false),
  untilYear: z.number().int().min(1900).max(2200).nullable().default(null),
  improvement: z.boolean().default(false),
});
export type PropertyExpenseInput = z.input<typeof PropertyExpenseInput>;

export const PropertyReminderInput = z.object({
  id: id.optional(),
  propertyId: id,
  lotId: id.nullable().default(null),
  date: isoDate,
  yearly: z.boolean().default(false),
  label: text(160).min(1, "Indiquez de quoi il s'agit"),
  comment: text(500).default(""),
  doneOn: isoDate.nullable().default(null),
});
export type PropertyReminderInput = z.input<typeof PropertyReminderInput>;

export const PropertyIncomeInput = z.object({
  id: id.optional(),
  propertyId: id,
  date: isoDate,
  category: z.enum(INCOME_CATEGORIES),
  amount: money.positive("Montant requis"),
  label: text(120).default(""),
});
export type PropertyIncomeInput = z.input<typeof PropertyIncomeInput>;

export const LoanInput = z
  .object({
    id: id.optional(),
    kind: z.enum(LOAN_KINDS).default("immobilier"),
    name: text(120).min(1, "Nom requis"),
    propertyId: id.nullable().default(null),
    share: z.number().gt(0, "Part à charge requise").max(1).default(1),
    principal: money.positive("Montant emprunté requis"),
    rate: z.number().min(0).max(1),
    termMonths: z.number().int().min(1).max(600),
    firstPayment: isoDate,
    insuranceMode: z.enum(LOAN_INSURANCE_MODES).default("montant"),
    insurance: money.min(0).default(0),
    insuranceRate: z.number().min(0).max(1).default(0),
    manualPayment: money.positive().nullable().default(null),
    manualBalance: money.min(0).nullable().default(null),
    manualBalanceDate: isoDate.nullable().default(null),
    archived: z.boolean().default(false),
    deferredMonths: z.number().int().min(0).max(240).default(0),
    deferredKind: z.enum(LOAN_DEFERRED_KINDS).default("partiel"),
  })
  .refine((l) => l.deferredMonths < l.termMonths, { path: ["deferredMonths"], message: "Le différé doit être plus court que le crédit." })
  .refine((l) => (l.manualBalance == null) === (l.manualBalanceDate == null), { path: ["manualBalanceDate"], message: "Indiquez le capital restant dû et sa date." });
export type LoanInput = z.input<typeof LoanInput>;

export const LoanPrepaymentInput = z.object({
  id: id.optional(),
  loanId: id,
  date: isoDate,
  amount: money.positive("Montant requis"),
  fee: money.min(0).default(0),
  mode: z.enum(LOAN_PREPAYMENT_MODES).default("duree"),
});
export type LoanPrepaymentInput = z.input<typeof LoanPrepaymentInput>;

export const PropertyDocumentInput = z.object({
  id: id.optional(),
  propertyId: id,
  kind: z.enum(DOCUMENT_KINDS),
  label: text(120).min(1, "Nom requis"),
  date: isoDate.nullable().default(null),
  expiresOn: isoDate.nullable().default(null),
  location: text(300).default(""),
});
export type PropertyDocumentInput = z.input<typeof PropertyDocumentInput>;

export const OtherAssetInput = z
  .object({
    id: id.optional(),
    kind: z.enum(OTHER_ASSET_KINDS),
    name: text(120).min(1, "Nom requis"),
    value: money.min(0),
    valueDate: isoDate.nullable().default(null),
    purchasePrice: money.min(0).nullable().default(null),
    purchaseDate: isoDate.nullable().default(null),
    share: z.number().gt(0, "Part détenue requise").max(1).default(1),
    dismemberment: z.enum(DISMEMBERMENTS).default("pleine"),
    usufructBirthDate: isoDate.nullable().default(null),
    usufructEnd: isoDate.nullable().default(null),
    depreciation: z.number().min(0).max(0.9).nullable().default(null),
    quickSaleDiscount: z.number().min(0).max(1).nullable().default(null),
    saleDelayMonths: z.number().int().min(0).max(600).nullable().default(null),
    loanPrincipal: money.positive().nullable().default(null),
    loanRate: z.number().min(0).max(0.5).nullable().default(null),
    loanTermMonths: z.number().int().min(1).max(600).nullable().default(null),
    loanFirstPayment: isoDate.nullable().default(null),
    classId: id.nullable().default(null),
    inAllocation: z.boolean().nullable().default(null),
    comment: text(500).default(""),
    archived: z.boolean().default(false),
  })
  .refine((a) => a.kind !== "societe" || a.dismemberment === "pleine" || a.usufructBirthDate != null || a.usufructEnd != null, { path: ["usufructBirthDate"], message: "Indiquez la date de naissance de l'usufruitier, ou la fin de l'usufruit s'il est à durée fixe." });
export type OtherAssetInput = z.input<typeof OtherAssetInput>;

export const OtherAssetValueInput = z.object({
  assetId: id,
  date: isoDate,
  value: money.min(0),
});

export const GoalInput = z
  .object({
    id: id.optional(),
    name: text(120).min(1, "Nom requis"),
    target: money.positive("Montant requis"),
    targetDate: isoDate,
    startDate: isoDate,
    rate: z.number().min(-0.5).max(0.5).default(0),
    allocations: z
      .array(z.object({ accountId: id, mode: z.enum(GOAL_ALLOCATION_MODES), value: z.number().min(0).max(1e12) }))
      .max(50)
      .default([])
      .refine((list) => list.every((a) => a.mode !== "pourcentage" || a.value <= 1), "Un pourcentage ne peut pas dépasser 100 %.")
      .refine((list) => new Set(list.map((a) => a.accountId)).size === list.length, "Un compte ne peut servir qu'une fois par projet."),
    comment: text(500).default(""),
    archived: z.boolean().default(false),
  })
  .refine((g) => g.startDate <= g.targetDate, { path: ["targetDate"], message: "La date du projet doit suivre son début." });
export type GoalInput = z.input<typeof GoalInput>;

export const GiftInput = z.object({
  id: id.optional(),
  date: isoDate,
  direction: z.enum(GIFT_DIRECTIONS),
  kind: z.enum(GIFT_KINDS).default("donation"),
  person: text(120).min(1, "Indiquez la personne"),
  relation: z.enum(GIFT_RELATIONS),
  amount: money.positive("Montant requis"),
  comment: text(500).default(""),
});
export type GiftInput = z.input<typeof GiftInput>;

export const CompanyInput = z.object({
  id: id.optional(),
  name: text(120).min(1, "Nom requis"),
  share: z.number().gt(0, "Part des parts requise").max(1).default(1),
  comment: text(500).default(""),
  archived: z.boolean().default(false),
});
export type CompanyInput = z.input<typeof CompanyInput>;

export const InstitutionInput = z.object({
  id: id.optional(),
  name: text(80).min(1, "Nom requis"),
  kind: z.enum(INSTITUTION_KINDS),
  website: text(200).default(""),
  score: z.number().min(0).max(10).nullable().default(null),
  comment: text(1000).default(""),
  offers: Offers.default({}),
  tax: InstitutionTax.default({ report: false, withholds: null, withheldIncomeTax: null, withheldSocial: null }),
  protection: InstitutionProtection.default({ guarantor: "", country: "france" }),
});
export type InstitutionInput = z.input<typeof InstitutionInput>;
export const AccountRateInput = z.object({
  accountId: id,
  fromDate: isoDate,
  rate,
  comment: text(200).default(""),
});
export const ManualPriceInput = z.object({ assetId: id, date: isoDate, price: money.positive() });
