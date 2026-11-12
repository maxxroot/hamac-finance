import { pgTable, text } from "drizzle-orm/pg-core";

/** Réglages du tenant. */

/** Réglages clé → valeur JSON (paramètres du plan, préférences d'interface…). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
