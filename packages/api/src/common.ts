import { z } from "zod";
import { isIsoDate } from "@hamac/core";

/** Briques de schémas partagées par les entrées et les procédures. Interne au paquet : non exporté par index.ts. */

export const id = z.string().min(1);
export const isoDate = z.string().refine(isIsoDate, "Date invalide (AAAA-MM-JJ)");
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mois invalide (AAAA-MM)");
export const money = z.number().finite();
export const rate = z.number().min(-1).max(1);
export const text = (max = 500) => z.string().trim().max(max);
export const ok = z.object({ ok: z.literal(true) });
export const isin = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/, "ISIN invalide (12 caractères, ex. IE00B4L5Y983)");
export const byId = z.object({ id: z.string().min(1) });
// Les sorties d'entités sont construites par le backend à partir de lignes déjà validées.
export const entity = <T>() => z.custom<T>(() => true);
