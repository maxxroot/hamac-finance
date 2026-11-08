#!/usr/bin/env node
// Exporte une base de l'ancienne application de bureau vers une sauvegarde JSON Hamac,
// à restaurer ensuite dans Paramètres › Application. La base d'origine est ouverte en lecture seule.
//
//   node apps/server/scripts/export-desktop.mjs [base.sqlite] [sortie.json]
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SOURCE = process.argv[2] ?? join(homedir(), "Library/Application Support/@hamac/hamac.sqlite");
const TARGET = process.argv[3] ?? "hamac-export-bureau.json";
const SECRETS = "market.secrets";
const TABLES = ["settings", "institutions", "accounts", "assets", "transactions", "contribution_plans", "contribution_skips", "bond_plans", "fund_rates", "statements", "prices", "planned_expenses", "properties", "crowd_projects", "loans", "account_rates"];

const db = new DatabaseSync(SOURCE, { readOnly: true });
const tables = {};
for (const t of TABLES) tables[t] = db.prepare(`SELECT * FROM ${t}`).all();
// Les clés d'API ne partent jamais dans une sauvegarde.
tables.settings = tables.settings.filter((r) => r.key !== SECRETS);
const { tag } = db.prepare("SELECT MAX(tag) AS tag FROM _hamac_migrations").get();
db.close();

const dump = { format: "hamac", version: 1, engine: "sqlite", schemaVersion: tag, exportedAt: new Date().toISOString(), appVersion: "bureau", tables };
writeFileSync(TARGET, JSON.stringify(dump), { mode: 0o600 });
console.log(`Sauvegarde écrite dans ${TARGET} (${Object.values(tables).reduce((n, r) => n + r.length, 0)} lignes).`);
