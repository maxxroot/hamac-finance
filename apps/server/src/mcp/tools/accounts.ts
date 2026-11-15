import { z } from "zod";
import { ACCOUNT_KIND_LABELS, ACCOUNT_KINDS, ALLOWED_TYPES, LIVRET_TYPES, PER_KINDS, type Account } from "@hamac/core";
import { cents, loadEngine, ToolError, type Call } from "../engine";
import { AFTER_CONSENT, found, isoDate, merge, rate, READ_ONLY, WRITE } from "./fields";
import type { ToolRegistrar } from "./registrar";

/** Comptes et contrats : lecture des encours, création, réglages, taux des livrets et taux servis des fonds euros. */

const UNKNOWN_ACCOUNT = "Compte introuvable : appelez list_accounts pour obtenir les identifiants.";

export function registerAccountTools(tool: ToolRegistrar, call: Call, canWrite: boolean): void {
  tool(
    "list_accounts",
    {
      title: "Comptes et contrats",
      description: "Liste les comptes (livrets, assurance-vie, PEA, CTO, PER, crypto…) avec leur identifiant, leur établissement, leur encours, leurs versements nets, le dernier relevé de situation saisi et les types d'opérations qu'ils acceptent. L'identifiant sert aux autres outils.",
      inputSchema: { includeArchived: z.boolean().default(false).describe("Inclure les comptes clos ou archivés.") },
      annotations: READ_ONLY,
    },
    async ({ includeArchived }) => {
      const { state, ws } = await loadEngine(call);
      const institutions = new Map(ws.institutions.map((i) => [i.id, i.name]));
      return state.accounts
        .filter((a) => includeArchived || !a.account.archived)
        .map((a) => ({
          id: a.account.id,
          name: a.account.name,
          kind: a.account.kind,
          kindLabel: ACCOUNT_KIND_LABELS[a.account.kind],
          institutionId: a.account.institutionId,
          institution: a.account.institutionId ? (institutions.get(a.account.institutionId) ?? null) : null,
          archived: a.account.archived,
          value: cents(a.value),
          cash: cents(a.cash),
          netContributions: cents(a.netContrib),
          gain: cents(a.gain),
          lastStatement: a.lastStatement ? { date: a.lastStatement.date, value: a.lastStatement.value } : null,
          allowedTypes: ALLOWED_TYPES[a.account.kind],
        }));
    },
  );

  tool(
    "get_account",
    {
      title: "Détail d'un compte",
      description: "Détail d'un compte : espèces, lignes détenues (quantité, prix de revient unitaire, dernier cours et sa date, valorisation, plus-value latente), intérêts, dividendes, frais et impôts cumulés, dernier relevé de situation, réglages (établissement, ouverture, plafond, taux, frais, part détenue), versements programmés, taux datés du livret et taux servis du fonds euros.",
      inputSchema: { accountId: z.string().describe("Identifiant renvoyé par list_accounts.") },
      annotations: READ_ONLY,
    },
    async ({ accountId }) => {
      const { state, ws } = await loadEngine(call);
      const a = state.accountById.get(accountId);
      if (!a) throw new ToolError(UNKNOWN_ACCOUNT);
      const { id, name, kind, archived, ...settings } = a.account;
      return {
        id,
        name,
        kind: ACCOUNT_KIND_LABELS[kind],
        archived,
        value: cents(a.value),
        cash: cents(a.cash),
        netContributions: cents(a.netContrib),
        gain: cents(a.gain),
        interests: cents(a.interests),
        dividends: cents(a.dividends),
        fees: cents(a.fees),
        taxes: cents(a.taxes),
        realizedGain: cents(a.realizedGain),
        lastStatement: a.lastStatement ? { date: a.lastStatement.date, value: a.lastStatement.value } : null,
        positions: a.positions.map((p) => ({ assetId: p.asset.id, name: p.asset.name, isin: p.asset.isin, quantity: p.quantity, unitCost: cents(p.pru), price: p.price, priceDate: p.priceDate, value: cents(p.value), gain: cents(p.gain) })),
        settings,
        contributionPlans: ws.plans.filter((p) => p.accountId === id).map((p) => ({ id: p.id, fromMonth: p.fromMonth, amount: p.amount, comment: p.comment })),
        contributionSkips: ws.skips.filter((s) => s.accountId === id).map((s) => ({ id: s.id, month: s.month, amount: s.amount, comment: s.comment })),
        rates: ws.accountRates.filter((r) => r.accountId === id).map((r) => ({ id: r.id, fromDate: r.fromDate, rate: r.rate })),
        fundRates: ws.fundRates.filter((r) => r.accountId === id).map((r) => ({ assetId: r.assetId, year: r.year, rate: r.rate })),
      };
    },
  );

  if (!canWrite) return;

  tool(
    "save_account",
    {
      title: "Créer ou modifier un compte",
      description: `Sans id : ouvre un compte ou un contrat (kind et name requis ; une assurance-vie ou un PER assurantiel reçoit son fonds euros). Avec id : modifie seulement les champs donnés. Archiver (archived: true) clôt un compte en gardant son historique et arrête ses versements programmés. Un seul PEA, LEP, LDDS et Livret A par personne. ${AFTER_CONSENT}`,
      inputSchema: {
        id: z.string().optional().describe("Identifiant de list_accounts, pour une modification."),
        kind: z.enum(ACCOUNT_KINDS).optional(),
        name: z.string().trim().min(1).max(80).optional(),
        institutionId: z.string().nullable().optional().describe("Établissement de list_institutions ; null pour le détacher."),
        livretType: z.enum(LIVRET_TYPES).nullable().optional().describe("Livret : LEP, LDDS, LIVRET_A ou AUTRE."),
        perKind: z.enum(PER_KINDS).nullable().optional().describe("PER : assurantiel (par défaut) ou bancaire."),
        openedOn: isoDate.nullable().optional().describe("Date d'ouverture (compte l'ancienneté fiscale d'un PEA ou d'une assurance-vie)."),
        depositCeiling: z.number().min(0).nullable().optional().describe("Plafond de versements, en euros."),
        rate: rate.nullable().optional().describe("Livret : taux actuel. Enregistré comme taux daté à partir de rateFrom."),
        rateFrom: isoDate.nullable().optional(),
        role: z.string().trim().max(200).optional().describe("Rôle du compte dans le plan, en une phrase."),
        beneficiaryClause: z.boolean().optional().describe("Assurance-vie : clause bénéficiaire rédigée."),
        entryFeeRate: rate.nullable().optional().describe("Frais sur versement."),
        managementFeeRate: rate.nullable().optional().describe("Frais de gestion annuels."),
        monthsToInvest: z.number().int().min(1).max(240).nullable().optional().describe("Durée prévue pour investir les espèces, en mois."),
        inAllocation: z.boolean().nullable().optional().describe("Compté dans l'allocation cible ; null = selon le type."),
        defaultAssetId: z.string().nullable().optional().describe("Assurance-vie, PER : fonds euros par défaut (titre de list_assets)."),
        share: z.number().gt(0).max(1).optional().describe("Part détenue d'un compte joint (0.5 pour moitié)."),
        archived: z.boolean().optional(),
      },
      annotations: WRITE,
    },
    async ({ id, ...fields }) => {
      const ws = id ? await call("workspace.load") : null;
      const existing: Account | undefined = id && ws ? found(ws.accounts, id, "Compte", "list_accounts") : undefined;
      if (!existing && (!fields.kind || !fields.name)) throw new ToolError("Pour ouvrir un compte, donnez au moins kind et name.");
      const saved = await call("accounts.upsert", merge(existing, fields) as never);
      return { created: !existing, id: saved.id, name: saved.name, kind: saved.kind, institutionId: saved.institutionId, defaultAssetId: saved.defaultAssetId ?? null, archived: saved.archived };
    },
  );

  tool(
    "set_account_rate",
    {
      title: "Taux d'un livret à partir d'une date",
      description: `Enregistre le taux d'un livret à partir d'une date (changement de taux réglementé, taux promotionnel). Les intérêts sont recalculés avec l'historique des taux. ${AFTER_CONSENT}`,
      inputSchema: { accountId: z.string(), fromDate: isoDate, rate, comment: z.string().trim().max(200).default("") },
      annotations: WRITE,
    },
    async (input) => {
      await call("accountRates.set", input);
      return { ok: true, accountId: input.accountId, fromDate: input.fromDate, rate: input.rate };
    },
  );

  tool(
    "set_fund_rate",
    {
      title: "Taux servi d'un fonds euros",
      description: `Enregistre le taux servi par un fonds euros pour une année, net de frais de gestion, tel qu'annoncé par l'assureur. Sans assetId : le fonds euros par défaut du contrat. ${AFTER_CONSENT}`,
      inputSchema: { accountId: z.string(), assetId: z.string().optional(), year: z.number().int().min(1990).max(2150), rate, comment: z.string().trim().max(200).default("") },
      annotations: WRITE,
    },
    async ({ accountId, assetId, ...rest }) => {
      const account = found((await call("workspace.load")).accounts, accountId, "Compte", "list_accounts");
      const fund = assetId ?? account.defaultAssetId;
      if (!fund) throw new ToolError("Ce contrat n'a pas de fonds euros par défaut : précisez assetId.");
      const saved = await call("fundRates.set", { accountId, assetId: fund, ...rest });
      return { ok: true, accountId, assetId: saved.assetId, year: saved.year, rate: saved.rate };
    },
  );
}
