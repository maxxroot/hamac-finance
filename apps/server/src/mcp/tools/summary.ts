import { ACCOUNT_KIND_LABELS, computeAlerts } from "@hamac/core";
import { cents, loadEngine, type Call } from "../engine";
import { READ_ONLY, round4 } from "./fields";
import type { ToolRegistrar } from "./registrar";

/** Vue d'ensemble : patrimoine net, allocation, alertes. */

export function registerSummaryTools(tool: ToolRegistrar, call: Call): void {
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
        allocation: state.allocation.rows.map((r) => ({ class: r.label, value: cents(r.value), share: round4(r.share), target: round4(r.target), drift: round4(r.drift), action: r.action })),
        accounts: state.accounts.filter((a) => !a.account.archived).map((a) => ({ id: a.account.id, name: a.account.name, kind: ACCOUNT_KIND_LABELS[a.account.kind], value: cents(a.value) })),
        alerts: { critical: alerts.filter((a) => a.level === "critique").length, warning: alerts.filter((a) => a.level === "attention").length, info: alerts.filter((a) => a.level === "info").length },
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
