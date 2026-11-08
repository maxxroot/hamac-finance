import type { DataDump } from "@hamac/api";
import { RpcError } from "@hamac/api";
import type { BackendContext } from "./context";
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
  "checklist_items",
  "account_rates",
] as const;

export function exportDump(ctx: BackendContext): DataDump {
  const tables: DataDump["tables"] = {};
  for (const t of TABLES) tables[t] = ctx.raw.prepare(`SELECT * FROM ${t}`).all() as Array<Record<string, unknown>>;
  // Les clés d'API personnelles ne partent jamais dans un fichier de sauvegarde.
  tables.settings = (tables.settings ?? []).filter((r) => r.key !== MARKET_SECRETS_KEY);
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
  // La clé d'API reste celle de cette installation, quel que soit le fichier restauré.
  const secrets = ctx.raw.prepare("SELECT key, value, updated_at FROM settings WHERE key = ?").get(MARKET_SECRETS_KEY) as { key: string; value: string; updated_at: string } | undefined;
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
    ctx.raw.prepare("DELETE FROM settings WHERE key = ?").run(MARKET_SECRETS_KEY);
    if (secrets) ctx.raw.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)").run(secrets.key, secrets.value, secrets.updated_at);
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
