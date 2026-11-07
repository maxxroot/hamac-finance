import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Schéma de la base. Toute modification se fait ici, puis :
 *   pnpm --filter @hamac/backend db:generate
 * qui produit la migration SQL et l'embarque dans migrations.generated.ts.
 */

/** Réglages clé → valeur JSON (préférences d'interface, etc.). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
