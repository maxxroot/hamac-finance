import { z } from "zod";
import { GIFT_DIRECTIONS, GIFT_KINDS, GIFT_RELATIONS, GOAL_ALLOCATION_MODES } from "@hamac/core";
import { id, isoDate, money, text } from "../common";

/** Entrées validées : projets, donations et dépenses prévues. */

export const PlannedExpenseInput = z.object({
  id: id.optional(),
  year: z.number().int().min(2000).max(2200),
  amount: money.positive(),
  label: text(120).min(1),
  accountId: id.nullable().default(null),
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
