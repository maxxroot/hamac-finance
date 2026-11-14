import { z } from "zod";
import { ACCOUNT_KINDS, INSTITUTION_KINDS, InstitutionProtection, InstitutionTax, LIVRET_TYPES, Offers, PER_KINDS } from "@hamac/core";
import { id, isoDate, money, rate, text } from "../common";

/** Entrées validées : comptes, établissements, taux datés, relevés et documents fiscaux des établissements. */

export const AccountInput = z.object({
  id: id.optional(),
  kind: z.enum(ACCOUNT_KINDS),
  livretType: z.enum(LIVRET_TYPES).nullable().default(null),
  /** PER : assurantiel (par défaut) ou bancaire. */
  perKind: z.enum(PER_KINDS).nullable().default(null),
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
  /**
   * Assurance-vie et PER : fonds euros par défaut du contrat. Absent = inchangé (et, pour un nouveau contrat,
   * un fonds euros à son nom est créé) ; null = aucun, l'argent du contrat reste en espèces.
   */
  defaultAssetId: id.nullable().optional(),
  /** Part détenue d'un compte joint ; 1 pour un compte individuel. */
  share: z.number().gt(0, "Part détenue requise").max(1).default(1),
  sortOrder: z.number().int().default(0),
  archived: z.boolean().default(false),
});
export type AccountInput = z.input<typeof AccountInput>;

export const FundRateInput = z.object({
  accountId: id,
  /** Fonds euros du contrat. */
  assetId: id,
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

export const InstitutionInput = z.object({
  id: id.optional(),
  name: text(80).min(1, "Nom requis"),
  kind: z.enum(INSTITUTION_KINDS),
  website: text(200).default(""),
  score: z.number().min(0).max(10).nullable().default(null),
  comment: text(1000).default(""),
  offers: Offers.default({}),
  tax: InstitutionTax.default({ report: false, withholds: null, withheldIncomeTax: null, withheldSocial: null, crowdInstrument: "prets" }),
  protection: InstitutionProtection.default({ guarantor: "", country: "france" }),
});
export type InstitutionInput = z.input<typeof InstitutionInput>;

export const AccountRateInput = z.object({
  accountId: id,
  fromDate: isoDate,
  rate,
  comment: text(200).default(""),
});
