import { z } from "zod";
import { ACCOUNT_KINDS, ASSET_KINDS, BOND_KINDS, CROWD_REPAYMENTS, CROWD_STATUSES, INSTITUTION_KINDS, LIVRET_TYPES, LOAN_KINDS, Offers, PRICE_PROVIDERS, PRICE_SOURCES, PROPERTY_KINDS, TX_TYPES, isIsoDate } from "@hamac/core";

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
  sortOrder: z.number().int().default(0),
  archived: z.boolean().default(false),
});
export type AccountInput = z.input<typeof AccountInput>;

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
  rate: z.number().min(0).max(1),
  startDate: isoDate,
  termMonths: z.number().int().min(1).max(600),
  repayment: z.enum(CROWD_REPAYMENTS).default("in_fine"),
  status: z.enum(CROWD_STATUSES).default("en_cours"),
  statusDate: isoDate.nullable().default(null),
  repaidCapital: money.min(0).nullable().default(null),
  expectedRecovery: money.min(0).nullable().default(null),
  inAllocation: z.boolean().nullable().default(null),
  comment: text(500).default(""),
});
export type CrowdProjectInput = z.input<typeof CrowdProjectInput>;

export const PropertyInput = z.object({
  id: id.optional(),
  kind: z.enum(PROPERTY_KINDS),
  name: text(120).min(1, "Nom requis"),
  value: money.min(0),
  valueDate: isoDate.nullable().default(null),
  purchasePrice: money.min(0).nullable().default(null),
  purchaseDate: isoDate.nullable().default(null),
  share: z.number().gt(0, "Part détenue requise").max(1).default(1),
  inAllocation: z.boolean().default(false),
  classId: id.nullable().default(null),
  comment: text(500).default(""),
  archived: z.boolean().default(false),
});
export type PropertyInput = z.input<typeof PropertyInput>;

export const LoanInput = z
  .object({
    id: id.optional(),
    kind: z.enum(LOAN_KINDS).default("immobilier"),
    name: text(120).min(1, "Nom requis"),
    propertyId: id.nullable().default(null),
    principal: money.positive("Montant emprunté requis"),
    rate: z.number().min(0).max(1),
    termMonths: z.number().int().min(1).max(600),
    firstPayment: isoDate,
    insurance: money.min(0).default(0),
    manualPayment: money.positive().nullable().default(null),
    manualBalance: money.min(0).nullable().default(null),
    manualBalanceDate: isoDate.nullable().default(null),
    archived: z.boolean().default(false),
  })
  .refine((l) => (l.manualBalance == null) === (l.manualBalanceDate == null), { path: ["manualBalanceDate"], message: "Indiquez le capital restant dû et sa date." });
export type LoanInput = z.input<typeof LoanInput>;

export const InstitutionInput = z.object({
  id: id.optional(),
  name: text(80).min(1, "Nom requis"),
  kind: z.enum(INSTITUTION_KINDS),
  website: text(200).default(""),
  score: z.number().min(0).max(10).nullable().default(null),
  comment: text(1000).default(""),
  offers: Offers.default({}),
});
export type InstitutionInput = z.input<typeof InstitutionInput>;
export const AccountRateInput = z.object({
  accountId: id,
  fromDate: isoDate,
  rate,
  comment: text(200).default(""),
});
export const ManualPriceInput = z.object({ assetId: id, date: isoDate, price: money.positive() });
