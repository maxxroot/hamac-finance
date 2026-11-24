import { z } from "zod";
import { TX_LABELS, TX_TYPES, type Transaction } from "@hamac/core";
import { ToolError, type Call } from "../engine";
import { AFTER_CONSENT, found, isoDate, isoMonth, merge, READ_ONLY, WRITE } from "./fields";
import type { ToolRegistrar } from "./registrar";

/** Journal des opérations et versements programmés. Pour un lot tiré d'un document, prepare_import reste la voie. */

const money = z.number().finite();

export function registerJournalTools(tool: ToolRegistrar, call: Call, canWrite: boolean): void {
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
          ...(t.fxRate != null ? { fxRate: t.fxRate } : {}),
          comment: t.comment,
        })),
      };
    },
  );

  if (!canWrite) return;

  tool(
    "save_transaction",
    {
      title: "Saisir ou corriger une opération",
      description: `Sans id : ajoute UNE opération au journal (date, type, accountId, amount requis). Avec id : corrige seulement les champs donnés. Montant toujours positif, le type donne le sens (seule une correction peut être négative). Achat ou vente : assetId et quantity (nominal dans la devise du titre pour une obligation) ; transfert : counterAccountId ; intérêts ou dividendes : montant reçu net, avec au besoin le brut et les retenues. Hamac valide l'opération avec les règles de l'application. Pour plusieurs opérations lues dans un document, utilisez prepare_import. ${AFTER_CONSENT}`,
      inputSchema: {
        id: z.string().optional().describe("Identifiant de list_transactions, pour une correction."),
        date: isoDate.optional(),
        type: z.enum(TX_TYPES).optional(),
        accountId: z.string().optional(),
        assetId: z.string().nullable().optional(),
        counterAccountId: z.string().nullable().optional().describe("Transfert : compte d'arrivée."),
        counterAssetId: z.string().nullable().optional().describe("Arbitrage ou transfert vers un contrat : support d'arrivée."),
        amount: money.optional().describe("En euros, positif."),
        quantity: z.number().positive().nullable().optional(),
        counterQuantity: z.number().positive().nullable().optional().describe("Arbitrage : parts reçues du support d'arrivée."),
        fee: z.number().min(0).nullable().optional().describe("Frais compris dans le montant."),
        accrued: z.number().min(0).nullable().optional().describe("Obligation : coupon couru payé ou reçu."),
        gross: z.number().min(0).nullable().optional().describe("Revenu : montant brut avant retenues."),
        withheldIncomeTax: z.number().min(0).nullable().optional().describe("Revenu : acompte d'impôt retenu."),
        withheldSocial: z.number().min(0).nullable().optional().describe("Revenu : prélèvements sociaux retenus."),
        withheldForeign: z.number().min(0).nullable().optional().describe("Revenu : retenue à la source étrangère."),
        fxRate: z.number().positive().nullable().optional().describe("Titre en devise (voir currency dans list_assets) : taux de change appliqué par l'établissement, en unités de la devise pour 1 € (ex. 1.0832 USD pour 1 €). Tous les montants restent en euros : montant en devise = amount × fxRate. Absent : taux de la BCE du jour."),
        comment: z.string().trim().max(500).optional(),
      },
      annotations: WRITE,
    },
    async ({ id, ...fields }) => {
      const existing: Transaction | undefined = id ? found((await call("workspace.load")).transactions, id, "Opération", "list_transactions") : undefined;
      if (!existing && (!fields.date || !fields.type || !fields.accountId || fields.amount == null)) throw new ToolError("Pour ajouter une opération, donnez au moins date, type, accountId et amount.");
      const saved = await call("transactions.upsert", merge(existing, fields) as never);
      return { created: !existing, id: saved.id, date: saved.date, type: saved.type, typeLabel: TX_LABELS[saved.type], accountId: saved.accountId, assetId: saved.assetId, amount: saved.amount, quantity: saved.quantity };
    },
  );

  tool(
    "set_contribution_plan",
    {
      title: "Versement programmé",
      description: `Fixe le versement mensuel programmé d'un compte à partir d'un mois (0 pour l'arrêter). Hamac compte ces versements sans qu'il faille les saisir, et les écarte d'un import comme « programme ». Un nouveau montant à partir d'un autre mois garde l'historique des montants précédents. ${AFTER_CONSENT}`,
      inputSchema: { accountId: z.string(), fromMonth: isoMonth, amount: z.number().min(0).describe("Montant mensuel, en euros."), comment: z.string().trim().max(200).default("") },
      annotations: WRITE,
    },
    async (input) => {
      const saved = await call("plans.set", input);
      return { id: saved.id, accountId: saved.accountId, fromMonth: saved.fromMonth, amount: saved.amount };
    },
  );

  tool(
    "save_contribution_skip",
    {
      title: "Versement programmé non versé",
      description: `Pour un mois donné, retire tout ou partie du versement programmé d'un compte (versement sauté ou réduit). Avec id : modifie cette exception. Un versement plus élevé que prévu se saisit en opération avec save_transaction. ${AFTER_CONSENT}`,
      inputSchema: { id: z.string().optional(), accountId: z.string(), month: isoMonth, amount: z.number().positive().describe("Montant NON versé ce mois-là (le montant programmé entier pour un mois sauté)."), comment: z.string().trim().max(200).default("") },
      annotations: WRITE,
    },
    async (input) => {
      const saved = await call("skips.upsert", input);
      return { id: saved.id, accountId: saved.accountId, month: saved.month, amount: saved.amount };
    },
  );
}
