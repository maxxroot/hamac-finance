import { z } from "zod";
import { computePortfolio } from "@hamac/core";
import { cents, loadEngine, ToolError, type Call } from "../engine";
import { AFTER_CONSENT, isoDate, READ_ONLY, WRITE } from "./fields";
import type { ToolRegistrar } from "./registrar";

/**
 * Relevés de situation : comparer l'encours d'un relevé au calcul de Hamac, puis l'enregistrer
 * pour que check_data signale les écarts.
 */

export function registerStatementTools(tool: ToolRegistrar, call: Call, canWrite: boolean): void {
  tool(
    "compare_statement",
    {
      title: "Comparer un relevé de situation",
      description: "Compare l'encours d'un compte lu sur un relevé de situation (assureur, courtier, banque) à l'encours que Hamac calcule à la même date, sans rien enregistrer. Un écart signale en général une opération manquante (versement, coupons perçus, frais, arbitrage) ou un cours ancien.",
      inputSchema: { accountId: z.string(), date: isoDate, value: z.number().finite().describe("Encours du relevé, en euros.") },
      annotations: READ_ONLY,
    },
    async ({ accountId, date, value }) => {
      const { data } = await loadEngine(call);
      const a = computePortfolio(data, date).accountById.get(accountId);
      if (!a) throw new ToolError("Compte introuvable : appelez list_accounts pour obtenir les identifiants.");
      return {
        account: a.account.name,
        date,
        statementValue: value,
        hamacValue: cents(a.value),
        gap: cents(value - a.value),
        positions: a.positions.map((p) => ({ name: p.asset.name, quantity: p.quantity, price: p.price, priceDate: p.priceDate, value: cents(p.value) })),
        cash: cents(a.cash),
        note: "Les cours conservés pour le passé sont ceux de fin de mois : un écart de quelques euros sur une date en milieu de mois peut venir du cours.",
      };
    },
  );

  if (!canWrite) return;

  tool(
    "record_statement",
    {
      title: "Enregistrer un relevé de situation",
      description: `Enregistre l'encours d'un compte à une date, lu sur un relevé de situation. Hamac le compare ensuite à son calcul (check_data signale les écarts). ${AFTER_CONSENT}`,
      inputSchema: { accountId: z.string(), date: isoDate, value: z.number().finite().min(0), comment: z.string().max(200).default("") },
      annotations: WRITE,
    },
    async ({ accountId, date, value, comment }) => {
      const saved = await call("statements.upsert", { accountId, date, value, comment });
      return { id: saved.id, accountId: saved.accountId, date: saved.date, value: saved.value };
    },
  );
}
