import { z } from "zod";
import { CROWD_REPAYMENTS, CROWD_STATUSES, TX_TYPES } from "@hamac/core";
import { id, isoDate, money, text } from "../common";

/** Entrées validées : obligations gardées jusqu'à l'échéance et crowdlending. */

export const BondPlanInput = z.object({
  id: id.optional(),
  accountId: id.nullable().default(null),
  label: text(120).min(1),
  targetYear: z.number().int().min(2000).max(2150),
  nominal: money.positive(),
  comment: text(200).default(""),
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
