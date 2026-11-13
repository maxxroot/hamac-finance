import { z } from "zod";
import { TX_TYPES } from "@hamac/core";
import { id, isoDate, month, money, text } from "../common";

/** Entrées validées : journal des opérations et versements programmés. */

export const TransactionInput = z.object({
  id: id.optional(),
  date: isoDate,
  type: z.enum(TX_TYPES),
  accountId: id,
  assetId: id.nullable().default(null),
  counterAccountId: id.nullable().default(null),
  /** Transfert vers un contrat : fonds euros d'arrivée ; null = son support par défaut. */
  counterAssetId: id.nullable().default(null),
  amount: money,
  quantity: z.number().positive().nullable().default(null),
  /** Arbitrage : quantité reçue du support d'arrivée. */
  counterQuantity: z.number().positive().nullable().default(null),
  fee: money.min(0).nullable().default(null),
  /** Obligation : coupon couru saisi à la main ; null = calculé d'après la date. */
  accrued: money.min(0).nullable().default(null),
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
