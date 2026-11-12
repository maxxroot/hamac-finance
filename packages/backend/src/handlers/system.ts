import { eq, sql } from "drizzle-orm";
import { one } from "../db/driver";
import { AccountInput, RpcError, type ProcInput, type systemProcedures } from "@hamac/api";
import { LIVRET_LEGAL_CEILINGS, PlanParamsInput } from "@hamac/core";
import { exportDump, importDump } from "../backup/dump";
import * as t from "../db/schema";
import { loadWorkspace, saveParams } from "../repo";
import { nowIso } from "../db/units";
import { OK, type DomainHandlers } from "./_types";
import { count } from "./_shared";
import { accountsHandlers } from "./accounts";

/** Système, réglages, chargement de l'espace de travail, paramètres du plan, export et import des données. */

export const systemHandlers: DomainHandlers<typeof systemProcedures> = {
  async "system.info"(_input, ctx) {
    return {
      appVersion: ctx.appVersion,
      databasePath: ctx.displayPath,
      schemaVersion: ctx.schemaVersion,
      databaseVersion: await ctx.raw.version(),
      backupsDir: ctx.backupsDir ? "Copie sur le serveur avant chaque migration" : null,
    };
  },

  async "settings.get"({ key }, ctx) {
    const row = await ctx.db.select().from(t.settings).where(eq(t.settings.key, key)).limit(1).then(one);
    return row ? JSON.parse(row.value) : null;
  },

  async "settings.set"({ key, value }, ctx) {
    const json = JSON.stringify(value ?? null);
    const updatedAt = nowIso();
    await ctx.db
      .insert(t.settings)
      .values({ key, value: json, updatedAt })
      .onConflictDoUpdate({ target: t.settings.key, set: { value: json, updatedAt } });
  },

  async "workspace.load"(_input, ctx) {
    return loadWorkspace(ctx.db, ctx.market);
  },

  async "workspace.createStarter"(_input, ctx) {
    const existing = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.accounts).limit(1).then(one));
    if (existing > 0) throw new RpcError("CONFLICT", "Des comptes existent déjà : la structure type n'est proposée que sur une base vide.");
    const starter: Array<ProcInput<"accounts.upsert">> = [
      { kind: "livret", livretType: "LEP", name: "LEP", depositCeiling: LIVRET_LEGAL_CEILINGS.LEP, rate: 0.025, role: "Matelas de sécurité, à garder plein", sortOrder: 1 },
      { kind: "livret", livretType: "LDDS", name: "LDDS", depositCeiling: LIVRET_LEGAL_CEILINGS.LDDS, rate: 0.017, role: "Voiture, maison, imprévus", sortOrder: 2 },
      { kind: "livret", livretType: "LIVRET_A", name: "Livret A", depositCeiling: LIVRET_LEGAL_CEILINGS.LIVRET_A, rate: 0.017, role: "Débordement si le LDDS est plein", sortOrder: 3 },
      { kind: "assurance_vie", name: "Assurance-vie", role: "Amortisseur, capital garanti (fonds euros)", sortOrder: 4 },
      { kind: "cto", name: "Compte-titres", role: "Obligations à taux fixe, gardées jusqu'à l'échéance", sortOrder: 5 },
      { kind: "pea", name: "PEA", role: "Long terme, jamais vendu dans une baisse", monthsToInvest: 12, sortOrder: 6 },
      { kind: "crypto", name: "Crypto", role: "Hors allocation : petite part, peut perdre 80 %", sortOrder: 7 },
    ];
    for (const a of starter) await accountsHandlers["accounts.upsert"](AccountInput.parse(a), ctx);
    return OK;
  },

  async "params.update"(input, ctx) {
    const params = PlanParamsInput.parse(input);
    await saveParams(ctx.db, params);
    return params;
  },

  async "data.export"(_input, ctx) {
    return await exportDump(ctx);
  },

  async "data.import"({ dump }, ctx) {
    return { tables: await importDump(ctx, dump) };
  },
};
