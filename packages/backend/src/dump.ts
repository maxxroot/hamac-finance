import type { DataDump } from "@hamac/api";
import { RpcError } from "@hamac/api";
import type { BackendContext } from "./context";
import type { SqlValue } from "./db/driver";
import { MARKET_SECRETS_KEY } from "./market/config";

/** Tables exportées, dans l'ordre d'insertion (clés étrangères). */
const TABLES = [
  "settings",
  "institutions",
  "accounts",
  "assets",
  "transactions",
  "contribution_plans",
  "contribution_skips",
  "bond_plans",
  "fund_rates",
  "statements",
  "prices",
  "planned_expenses",
  "properties",
  "crowd_projects",
  "loans",
  "account_rates",
] as const;

export async function exportDump(ctx: BackendContext): Promise<DataDump> {
  const tables: DataDump["tables"] = {};
  for (const t of TABLES) tables[t] = await ctx.raw.all(`SELECT * FROM ${t}`);
  // Les clés d'API personnelles ne partent jamais dans un fichier de sauvegarde.
  tables.settings = (tables.settings ?? []).filter((r) => r.key !== MARKET_SECRETS_KEY);
  return { format: "hamac", version: 1, schemaVersion: ctx.schemaVersion, exportedAt: new Date().toISOString(), appVersion: ctx.appVersion, tables };
}

/** Remplace TOUTES les données par celles de la sauvegarde, en une transaction (tout ou rien). */
export async function importDump(ctx: BackendContext, dump: unknown): Promise<Record<string, number>> {
  const d = dump as Partial<DataDump> | null;
  if (!d || d.format !== "hamac" || d.version !== 1 || typeof d.tables !== "object" || !d.tables) {
    throw new RpcError("VALIDATION", "Ce fichier n'est pas une sauvegarde Hamac.");
  }
  if (d.schemaVersion && d.schemaVersion > ctx.schemaVersion) {
    throw new RpcError("VALIDATION", "Cette sauvegarde vient d'une version plus récente de Hamac : mettez l'application à jour.");
  }
  const counts: Record<string, number> = {};
  // La clé d'API reste celle de cette installation, quel que soit le fichier restauré.
  const secrets = await ctx.raw.get<{ key: string; value: string; updated_at: string }>("SELECT key, value, updated_at FROM settings WHERE key = ?", [MARKET_SECRETS_KEY]);
  try {
    await ctx.raw.replaceAll(async () => {
      for (const t of [...TABLES].reverse()) await ctx.raw.exec(`DELETE FROM ${t}`);
      for (const t of TABLES) {
        const rows = (d.tables as Record<string, unknown[]>)[t] ?? [];
        if (!Array.isArray(rows)) throw new RpcError("VALIDATION", `Table ${t} invalide.`);
        const known = new Set(await ctx.raw.columns(t));
        for (const row of rows as Array<Record<string, SqlValue>>) {
          const cols = Object.keys(row).filter((c) => known.has(c));
          if (!cols.length) continue;
          await ctx.raw.run(`INSERT INTO ${t} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((c) => row[c]!));
        }
        counts[t] = rows.length;
      }
      await ctx.raw.run("DELETE FROM settings WHERE key = ?", [MARKET_SECRETS_KEY]);
      if (secrets) await ctx.raw.run("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)", [secrets.key, secrets.value, secrets.updated_at]);
      if (await ctx.raw.brokenReferences()) throw new RpcError("VALIDATION", "Sauvegarde incohérente (références cassées).");
    });
  } catch (e) {
    throw e instanceof RpcError ? e : new RpcError("VALIDATION", `Import impossible : ${(e as Error).message}`);
  }
  return counts;
}
