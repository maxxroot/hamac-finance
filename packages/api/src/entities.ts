import { z } from "zod";
import { ACCOUNT_KINDS, ASSET_KINDS, LIVRET_TYPES, PRICE_SOURCES, TX_TYPES, isIsoDate } from "@hamac/core";

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
  institution: text(80).default(""),
  openedOn: isoDate.nullable().default(null),
  depositCeiling: money.min(0).nullable().default(null),
  rate: rate.nullable().default(null),
  role: text(200).default(""),
  beneficiaryClause: z.boolean().default(false),
  entryFeeRate: rate.nullable().default(null),
  managementFeeRate: rate.nullable().default(null),
  monthsToInvest: z.number().int().min(1).max(240).nullable().default(null),
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
  manualPrice: money.min(0).nullable().default(null),
  manualPriceDate: isoDate.nullable().default(null),
  targetWeight: z.number().min(0).max(1).nullable().default(null),
  ter: rate.nullable().default(null),
  couponRate: rate.nullable().default(null),
  maturityDate: isoDate.nullable().default(null),
  couponFrequency: z.number().int().min(1).max(12).nullable().default(null),
  issuer: text(80).nullable().default(null),
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
export const ManualPriceInput = z.object({ assetId: id, date: isoDate, price: money.positive() });
