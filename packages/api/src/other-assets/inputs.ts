import { z } from "zod";
import { DISMEMBERMENTS, OTHER_ASSET_KINDS } from "@hamac/core";
import { id, isoDate, money, text } from "../common";

/** Entrées validées : autres biens : or, objets, véhicules, parts de société, argent prêté. */

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
