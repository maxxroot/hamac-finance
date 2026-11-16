import { z } from "zod";
import { ASSET_KINDS, BOND_KINDS, isSovereignCountry, PRICE_PROVIDERS, PRICE_SOURCES } from "@hamac/core";
import { id, isoDate, money, rate, text } from "../common";

/** Entrées validées : titres, cours et sources de prix. */

export const MarketSeriesInput = z
  .object({
    kind: z.enum(["etf", "etc", "action", "fonds", "crypto"]),
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
  /** Obligation d'État : pays de l'émetteur (ISO 3166-1, « BE »). */
  issuerCountry: z
    .string()
    .refine((c) => isSovereignCountry(c), "Pays inconnu")
    .nullable()
    .default(null),
  archived: z.boolean().default(false),
});
export type AssetInput = z.input<typeof AssetInput>;

export const ManualPriceInput = z.object({ assetId: id, date: isoDate, price: money.positive() });
