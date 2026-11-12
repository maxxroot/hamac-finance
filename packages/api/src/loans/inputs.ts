import { z } from "zod";
import { LOAN_DEFERRED_KINDS, LOAN_INSURANCE_MODES, LOAN_KINDS, LOAN_PREPAYMENT_MODES } from "@hamac/core";
import { id, isoDate, money, text } from "../common";

/** Entrées validées : crédits et remboursements anticipés. */

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
