import { one } from "../db/driver";
import { normalizeParams, type PlanParams } from "@hamac/core";
import { eq } from "drizzle-orm";
import * as t from "../db/schema";
import type { Db } from "../db/postgres";
import { nowIso } from "../db/units";

/** Paramètres du plan et état des cours, rangés dans la table des réglages. */

export const PARAMS_KEY = "plan.parameters";

export const PRICE_STATUS_KEY = "prices.status";

export async function loadParams(db: Db): Promise<PlanParams> {
  const row = await db.select().from(t.settings).where(eq(t.settings.key, PARAMS_KEY)).limit(1).then(one);
  return normalizeParams(row ? JSON.parse(row.value) : null);
}

export async function saveParams(db: Db, params: PlanParams): Promise<void> {
  const value = JSON.stringify(params);
  const updatedAt = nowIso();
  await db
    .insert(t.settings)
    .values({ key: PARAMS_KEY, value, updatedAt })
    .onConflictDoUpdate({ target: t.settings.key, set: { value, updatedAt } });
}
