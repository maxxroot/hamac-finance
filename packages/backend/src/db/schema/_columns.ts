import { sql } from "drizzle-orm";
import { text } from "drizzle-orm/pg-core";

/** Colonnes d'horodatage communes à la plupart des tables. */
export const timestamps = {
  createdAt: text("created_at").notNull().default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
  updatedAt: text("updated_at").notNull().default(sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`),
};
