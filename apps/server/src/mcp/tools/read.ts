import { z } from "zod";
import { ACCOUNT_KIND_LABELS, ALLOWED_TYPES, ASSET_KIND_LABELS, computeAlerts, TX_LABELS, TX_TYPES } from "@hamac/core";
import { cents, loadEngine, ToolError, type Call } from "../engine";
import type { ToolRegistrar } from "./registrar";

/** Outils de lecture : encours calculés par `@hamac/core`, comptes, titres, opérations, contrôles. */

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ");

export function registerReadTools(tool: ToolRegistrar, call: Call): void {
  tool(
    "get_summary",
    {
      title: "Synthèse du patrimoine",
      description: "Patrimoine net (financier, immobilier, autres biens, dettes), encours des placements, versements nets et plus-values, répartition par classe d'actifs avec les cibles du plan, encours de chaque compte, nombre d'alertes. Montants en euros, calculés à la date du jour.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const { state, data, ws, today } = await loadEngine(call);
      const alerts = computeAlerts(data, state, { priceErrors: ws.priceStatus?.errors });
      return {
        date: today,
        netWorth: { financial: cents(state.netWorth.financial), realEstate: cents(state.netWorth.realEstate), otherAssets: cents(state.netWorth.otherAssets), debts: cents(state.netWorth.debts), net: cents(state.netWorth.net), monthlyLoanPayments: cents(state.netWorth.monthlyLoans) },
        investments: { value: cents(state.totals.value), netContributions: cents(state.totals.netContrib), gain: cents(state.totals.gain), cash: cents(state.totals.cash), monthlyContributions: cents(state.totals.monthly) },
        allocation: state.allocation.rows.map((r) => ({ class: r.label, value: cents(r.value), share: round(r.share), target: round(r.target), drift: round(r.drift), action: r.action })),
        accounts: state.accounts.filter((a) => !a.account.archived).map((a) => ({ id: a.account.id, name: a.account.name, kind: ACCOUNT_KIND_LABELS[a.account.kind], value: cents(a.value) })),
        alerts: { critical: alerts.filter((a) => a.level === "critique").length, warning: alerts.filter((a) => a.level === "attention").length, info: alerts.filter((a) => a.level === "info").length },
      };
    },
  );

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
      description: "Détail d'un compte : espèces, lignes détenues (quantité, prix de revient unitaire, dernier cours et sa date, valorisation, plus-value latente), intérêts, dividendes, frais et impôts cumulés, dernier relevé de situation.",
      inputSchema: { accountId: z.string().describe("Identifiant renvoyé par list_accounts.") },
      annotations: READ_ONLY,
    },
    async ({ accountId }) => {
      const { state } = await loadEngine(call);
      const a = state.accountById.get(accountId);
      if (!a) throw new ToolError("Compte introuvable : appelez list_accounts pour obtenir les identifiants.");
      return {
        id: a.account.id,
        name: a.account.name,
        kind: ACCOUNT_KIND_LABELS[a.account.kind],
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
      };
    },
  );

  tool(
    "list_assets",
    {
      title: "Titres et supports",
      description: "Liste les titres et supports connus de Hamac (ETF, actions, fonds, obligations, crypto, SCPI, fonds euros) avec leur identifiant et leur ISIN. À consulter avant un import, pour rattacher chaque ligne au bon titre.",
      inputSchema: {
        query: z.string().max(80).optional().describe("Filtre sur le nom, l'ISIN ou le symbole."),
        includeArchived: z.boolean().default(false),
      },
      annotations: READ_ONLY,
    },
    async ({ query, includeArchived }) => {
      const ws = await call("workspace.load");
      const q = query?.trim().toUpperCase();
      return ws.assets
        .filter((a) => (includeArchived || !a.archived) && (!q || a.name.toUpperCase().includes(q) || a.isin === q || a.symbol?.toUpperCase() === q))
        .map((a) => ({ id: a.id, name: a.name, kind: a.kind, kindLabel: ASSET_KIND_LABELS[a.kind], isin: a.isin, symbol: a.symbol, archived: a.archived }));
    },
  );

  tool(
    "list_transactions",
    {
      title: "Opérations du journal",
      description: "Opérations du journal, les plus récentes d'abord, filtrées par compte, période ou type. Montants en euros, toujours positifs sauf pour une correction.",
      inputSchema: {
        accountId: z.string().optional(),
        from: isoDate.optional().describe("Date de début incluse."),
        to: isoDate.optional().describe("Date de fin incluse."),
        type: z.enum(TX_TYPES).optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      },
      annotations: READ_ONLY,
    },
    async ({ accountId, from, to, type, limit }) => {
      const ws = await call("workspace.load");
      const accounts = new Map(ws.accounts.map((a) => [a.id, a.name]));
      const assets = new Map(ws.assets.map((a) => [a.id, a.name]));
      const matching = ws.transactions
        .filter((t) => (!accountId || t.accountId === accountId || t.counterAccountId === accountId) && (!from || t.date >= from) && (!to || t.date <= to) && (!type || t.type === type))
        .sort((a, b) => b.date.localeCompare(a.date));
      return {
        total: matching.length,
        transactions: matching.slice(0, limit).map((t) => ({
          id: t.id,
          date: t.date,
          type: t.type,
          typeLabel: TX_LABELS[t.type],
          account: accounts.get(t.accountId) ?? t.accountId,
          accountId: t.accountId,
          counterAccount: t.counterAccountId ? (accounts.get(t.counterAccountId) ?? t.counterAccountId) : null,
          asset: t.assetId ? (assets.get(t.assetId) ?? t.assetId) : null,
          assetId: t.assetId,
          amount: t.amount,
          quantity: t.quantity,
          fee: t.fee,
          comment: t.comment,
        })),
      };
    },
  );

  tool(
    "check_data",
    {
      title: "Contrôle des données",
      description: "Contrôles de Hamac : incohérences du journal (vente de plus de parts que détenues, solde négatif…), écarts entre l'encours calculé et le dernier relevé de situation saisi, cours en échec, livrets hors fourchette, allocation qui s'écarte de la cible, échéances de la gestion locative. Niveaux : critique, attention, info.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const { state, data, ws } = await loadEngine(call);
      return computeAlerts(data, state, { priceErrors: ws.priceStatus?.errors })
        .filter((a) => a.level !== "ok")
        .map((a) => ({ level: a.level, title: a.title, detail: a.detail ?? null }));
    },
  );
}

const round = (v: number) => Math.round(v * 10_000) / 10_000;
