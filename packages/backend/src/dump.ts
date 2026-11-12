import type { DataDump } from "@hamac/api";
import { RpcError } from "@hamac/api";
import type { BackendContext } from "./context";
import type { SqlValue } from "./db/driver";
import { upgradeLegacyDump, upgradeLegacyRentExceptions } from "./dumpUpgrade";
import { MARKET_SECRETS_KEY } from "./market/config";

/** Tables exportées, dans l'ordre d'insertion (clés étrangères). */
const TABLES = [
  "settings",
  "institutions",
  "tax_statement_amounts",
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
  "companies",
  "other_assets",
  "other_asset_values",
  "properties",
  "lots",
  "renters",
  "leases",
  "lease_renters",
  "lease_guarantees",
  "lease_rents",
  "rent_payments",
  "rent_waivers",
  "rent_notices",
  "property_expenses",
  "property_values",
  "property_incomes",
  "property_documents",
  "property_reminders",
  "crowd_projects",
  "loans",
  "loan_prepayments",
  "account_rates",
  "gifts",
  "goals",
  "goal_allocations",
] as const;

export async function exportDump(ctx: Pick<BackendContext, "raw" | "schemaVersion" | "appVersion">): Promise<DataDump> {
  const tables: DataDump["tables"] = {};
  for (const t of TABLES) if ((await ctx.raw.columns(t)).length) tables[t] = await ctx.raw.all(`SELECT * FROM ${t}`);
  // Les clés d'API personnelles ne partent jamais dans un fichier de sauvegarde.
  tables.settings = (tables.settings ?? []).filter((r) => r.key !== MARKET_SECRETS_KEY);
  return { format: "hamac", version: 1, engine: "postgres", schemaVersion: ctx.schemaVersion, exportedAt: new Date().toISOString(), appVersion: ctx.appVersion, tables };
}

/** Remplace TOUTES les données par celles de la sauvegarde, en une transaction (tout ou rien). */
export async function importDump(ctx: BackendContext, dump: unknown): Promise<Record<string, number>> {
  const d = dump as Partial<DataDump> | null;
  if (!d || d.format !== "hamac" || d.version !== 1 || typeof d.tables !== "object" || !d.tables) {
    throw new RpcError("VALIDATION", "Ce fichier n'est pas une sauvegarde Hamac.");
  }
  // Les versions de schéma ne se comparent qu'entre sauvegardes PostgreSQL : l'ancien bureau numérotait à part.
  if (d.engine === "postgres" && d.schemaVersion && d.schemaVersion > ctx.schemaVersion) {
    throw new RpcError("VALIDATION", "Cette sauvegarde vient d'une version plus récente de Hamac : mettez l'application à jour.");
  }
  const counts: Record<string, number> = {};
  upgradeLegacyDump(d.tables as Parameters<typeof upgradeLegacyDump>[0]);
  upgradeLegacyRentExceptions(d.tables as Parameters<typeof upgradeLegacyRentExceptions>[0]);
  try {
    await ctx.raw.transaction(async () => {
      for (const t of [...TABLES].reverse()) await ctx.raw.exec(`DELETE FROM ${t}`);
      for (const t of TABLES) {
        const rows = (d.tables as Record<string, unknown[]>)[t] ?? [];
        if (!Array.isArray(rows)) throw new RpcError("VALIDATION", `Table ${t} invalide.`);
        const types = new Map((await ctx.raw.columns(t)).map((c) => [c.name, c.type]));
        for (const row of rows as Array<Record<string, SqlValue>>) {
          const cols = Object.keys(row).filter((c) => types.has(c));
          if (!cols.length) continue;
          // Les sauvegardes du bureau notent les booléens 0 ou 1.
          const values = cols.map((c) => (types.get(c) === "boolean" && typeof row[c] === "number" ? row[c] !== 0 : row[c]!));
          await ctx.raw.run(`INSERT INTO ${t} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, values);
        }
        counts[t] = rows.length;
      }
      await ctx.raw.run("DELETE FROM settings WHERE key = ?", [MARKET_SECRETS_KEY]);
    });
  } catch (e) {
    throw e instanceof RpcError ? e : new RpcError("VALIDATION", `Import impossible : ${(e as Error).message}`);
  }
  return counts;
}
