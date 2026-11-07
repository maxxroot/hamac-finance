import { eq } from "drizzle-orm";
import type { ProcInput, ProcName, ProcOutput } from "@hamac/api";
import { settings } from "./db/schema";
import type { BackendContext } from "./context";

type Handlers = { [N in ProcName]: (input: ProcInput<N>, ctx: BackendContext) => Promise<ProcOutput<N>> };

export const handlers: Handlers = {
  async "system.info"(_input, ctx) {
    const { sqlite_version } = ctx.raw.prepare("SELECT sqlite_version() AS sqlite_version").get() as {
      sqlite_version: string;
    };
    return {
      appVersion: ctx.appVersion,
      mode: ctx.mode,
      databasePath: ctx.databasePath,
      schemaVersion: ctx.schemaVersion,
      sqliteVersion: sqlite_version,
      backupsDir: ctx.backupsDir,
    };
  },

  async "settings.get"({ key }, ctx) {
    const row = await ctx.db.select().from(settings).where(eq(settings.key, key)).get();
    return row ? JSON.parse(row.value) : null;
  },

  async "settings.set"({ key, value }, ctx) {
    const json = JSON.stringify(value ?? null);
    const updatedAt = new Date().toISOString();
    await ctx.db
      .insert(settings)
      .values({ key, value: json, updatedAt })
      .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt } });
  },
};
