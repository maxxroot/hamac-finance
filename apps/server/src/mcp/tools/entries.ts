import { z } from "zod";
import { computePortfolio } from "@hamac/core";
import { cents, loadEngine, ToolError, type Call } from "../engine";
import type { ToolRegistrar } from "./registrar";

/**
 * Saisies unitaires utiles à un import et à son contrôle : un titre inconnu, l'encours d'un relevé de situation.
 * `compare_statement` ne fait que lire ; les deux autres écrivent un seul objet, décrit en entier par leurs paramètres.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ");
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
/** Les autres natures (obligation, fonds euros) demandent des caractéristiques qui se saisissent dans l'interface. */
const SIMPLE_KINDS = ["etf", "action", "fonds", "crypto", "scpi"] as const;

export function registerStatementCheck(tool: ToolRegistrar, call: Call): void {
  tool(
    "compare_statement",
    {
      title: "Comparer un relevé de situation",
      description: "Compare l'encours d'un compte lu sur un relevé de situation (assureur, courtier, banque) à l'encours que Hamac calcule à la même date, sans rien enregistrer. Un écart signale en général une opération manquante (versement, coupons perçus, frais, arbitrage) ou un cours ancien.",
      inputSchema: { accountId: z.string(), date: isoDate, value: z.number().finite().describe("Encours du relevé, en euros.") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ accountId, date, value }) => {
      const { data } = await loadEngine(call);
      const a = computePortfolio(data, date).accountById.get(accountId);
      if (!a) throw new ToolError("Compte introuvable : appelez list_accounts pour obtenir les identifiants.");
      const gap = cents(value - a.value);
      return {
        account: a.account.name,
        date,
        statementValue: value,
        hamacValue: cents(a.value),
        gap,
        positions: a.positions.map((p) => ({ name: p.asset.name, quantity: p.quantity, price: p.price, priceDate: p.priceDate, value: cents(p.value) })),
        cash: cents(a.cash),
        note: "Les cours conservés pour le passé sont ceux de fin de mois : un écart de quelques euros sur une date en milieu de mois peut venir du cours.",
      };
    },
  );
}

export function registerEntryTools(tool: ToolRegistrar, call: Call): void {
  tool(
    "record_statement",
    {
      title: "Enregistrer un relevé de situation",
      description: "Enregistre l'encours d'un compte à une date, lu sur un relevé de situation. Hamac le compare ensuite à son calcul (check_data signale les écarts). Après accord de l'utilisateur.",
      inputSchema: { accountId: z.string(), date: isoDate, value: z.number().finite().min(0), comment: z.string().max(200).default("") },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ accountId, date, value, comment }) => {
      const saved = await call("statements.upsert", { accountId, date, value, comment });
      return { id: saved.id, accountId: saved.accountId, date: saved.date, value: saved.value };
    },
  );

  tool(
    "create_asset",
    {
      title: "Créer un titre",
      description: "Ajoute à Hamac un titre absent de list_assets (ETF, action, fonds, crypto, SCPI), pour pouvoir importer ses opérations. Si l'ISIN est déjà connu, renvoie le titre existant sans rien créer. Les cours sont récupérés automatiquement, sauf pour une SCPI ou une action sans symbole (prix saisi dans Hamac). Après accord de l'utilisateur.",
      inputSchema: {
        kind: z.enum(SIMPLE_KINDS),
        name: z.string().trim().min(1).max(120),
        isin: z.string().trim().toUpperCase().regex(ISIN, "ISIN invalide (12 caractères, ex. FR0011871128)").optional(),
        symbol: z.string().trim().max(40).optional().describe("Symbole de cotation, si connu (ex. CW8 pour un ETF, BTC pour une crypto)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ kind, name, isin, symbol }) => {
      if (isin) {
        const known = (await call("workspace.load")).assets.find((a) => a.isin === isin);
        if (known) return { created: false, id: known.id, name: known.name, kind: known.kind, isin: known.isin };
      }
      // Même choix de source que la fenêtre de création de titre de l'interface.
      const priceSource = kind === "scpi" || (kind === "action" && !symbol) ? "manuel" : "auto";
      const asset = await call("assets.upsert", { kind, name, isin: isin ?? null, symbol: symbol ?? null, priceSource });
      return { created: true, id: asset.id, name: asset.name, kind: asset.kind, isin: asset.isin };
    },
  );
}
