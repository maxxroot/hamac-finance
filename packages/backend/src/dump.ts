import type { DataDump } from "@hamac/api";
import { RpcError } from "@hamac/api";
import type { BackendContext } from "./context";

/** Tables exportées, dans l'ordre d'insertion (clés étrangères). */
const TABLES = [
  "settings",
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
  "checklist_items",
  "comparisons",
] as const;

export function exportDump(ctx: BackendContext): DataDump {
  const tables: DataDump["tables"] = {};
  for (const t of TABLES) tables[t] = ctx.raw.prepare(`SELECT * FROM ${t}`).all() as Array<Record<string, unknown>>;
  return { format: "hamac", version: 1, schemaVersion: ctx.schemaVersion, exportedAt: new Date().toISOString(), appVersion: ctx.appVersion, tables };
}

/** Remplace TOUTES les données par celles de la sauvegarde, en une transaction (tout ou rien). */
export function importDump(ctx: BackendContext, dump: unknown): Record<string, number> {
  const d = dump as Partial<DataDump> | null;
  if (!d || d.format !== "hamac" || d.version !== 1 || typeof d.tables !== "object" || !d.tables) {
    throw new RpcError("VALIDATION", "Ce fichier n'est pas une sauvegarde Hamac.");
  }
  if (d.schemaVersion && d.schemaVersion > ctx.schemaVersion) {
    throw new RpcError("VALIDATION", "Cette sauvegarde vient d'une version plus récente de Hamac : mettez l'application à jour.");
  }
  const counts: Record<string, number> = {};
  ctx.raw.exec("PRAGMA foreign_keys = OFF");
  ctx.raw.exec("BEGIN IMMEDIATE");
  try {
    for (const t of [...TABLES].reverse()) ctx.raw.exec(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      const rows = (d.tables as Record<string, unknown[]>)[t] ?? [];
      if (!Array.isArray(rows)) throw new RpcError("VALIDATION", `Table ${t} invalide.`);
      const known = new Set((ctx.raw.prepare(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>).map((c) => c.name));
      for (const row of rows as Array<Record<string, unknown>>) {
        const cols = Object.keys(row).filter((c) => known.has(c));
        if (!cols.length) continue;
        ctx.raw.prepare(`INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map((c) => row[c] as never));
      }
      counts[t] = rows.length;
    }
    const broken = ctx.raw.prepare("PRAGMA foreign_key_check").all();
    if (broken.length) throw new RpcError("VALIDATION", "Sauvegarde incohérente (références cassées).");
    ctx.raw.exec("COMMIT");
  } catch (e) {
    ctx.raw.exec("ROLLBACK");
    throw e instanceof RpcError ? e : new RpcError("VALIDATION", `Import impossible : ${(e as Error).message}`);
  } finally {
    ctx.raw.exec("PRAGMA foreign_keys = ON");
  }
  return counts;
}
