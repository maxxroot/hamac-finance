import { accountTaxDetails, cryptoTax, dispenseOutlook, fiscalRulesFor, LAST_VERIFIED_INCOME_YEAR, netYields, nextDeclarationYear, withdrawalTaxes, yearEndChecklist, yearlyTaxes, type YearEndKey } from "@hamac/core";
import { cents, loadEngine, type Call } from "../../engine";
import { READ_ONLY } from "../fields";
import type { ToolRegistrar } from "../registrar";

/** Estimation des impôts, liste de fin d'année et paramètres fiscaux : le même calcul que la page Impôts. */

const DISCLAIMER = "Estimations calculées avec les taux de Paramètres › Plan › Fiscalité, sans valeur officielle : à comparer avec la déclaration préremplie et l'avis d'impôt.";

export function registerTaxEstimateTools(tool: ToolRegistrar, call: Call): void {
  tool(
    "get_tax_estimate",
    {
      title: "Estimation des impôts",
      description:
        "Impôts liés à l'épargne, estimés par Hamac : ce qui reste à payer à la prochaine déclaration compte par compte (impôt non retenu par l'établissement ; négatif = remboursement attendu), ce que coûterait un retrait total aujourd'hui (impôt, valeur nette, régime appliqué), le rendement net d'impôts de chaque placement, et les impôts de chaque année depuis la première opération.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const { data, state, today, ws } = await loadEngine(call);
      const crypto = cryptoTax(data, today);
      const names = new Map(ws.accounts.map((a) => [a.id, a.name]));
      const livret = (t: string) => ws.accounts.find((a) => !a.archived && a.livretType === t)?.rate ?? null;
      const details = accountTaxDetails(data, state, crypto);
      return {
        date: today,
        disclaimer: DISCLAIMER,
        nextDeclaration: {
          incomeYear: nextDeclarationYear(today),
          accounts: details
            .filter((d) => d.nextDeclaration !== 0 || d.toPay !== 0)
            .map((d) => ({ account: names.get(d.accountId) ?? d.accountId, accountId: d.accountId, dueAtNextDeclaration: cents(d.nextDeclaration), notYetAssessed: cents(d.toPay), alreadyPaid: cents(d.paid), notes: d.notes })),
        },
        accountFacts: details.filter((d) => d.facts.length).map((d) => ({ account: names.get(d.accountId) ?? d.accountId, facts: d.facts })),
        ifEverythingWithdrawnToday: withdrawalTaxes(data, state, crypto).map((r) => ({ account: r.label, accountId: r.accountId, value: cents(r.value), gain: cents(r.gain), tax: cents(r.tax), net: cents(r.value - r.tax), regime: r.regime })),
        netYields: netYields(data.params, today, { lep: livret("LEP"), ldds: livret("LDDS") ?? livret("LIVRET_A") }),
        byYear: yearlyTaxes(data, crypto, today, state.disposals).map((y) => Object.fromEntries(Object.entries(y).map(([k, v]) => [k, typeof v === "number" && k !== "year" ? cents(v) : v]))),
      };
    },
  );

  tool(
    "get_year_end_checklist",
    {
      title: "À faire avant la fin de l'année",
      description:
        "Liste de fin d'année de Hamac, chiffrée : moins-values à réaliser, abattement de l'assurance-vie, versements sur le PER, plafonds des livrets et du PEA, dispense d'acompte à demander avant le 30 novembre (établissement par établissement), préparation de la déclaration. Indique les points déjà cochés par l'utilisateur cette année.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const { data, state, today } = await loadEngine(call);
      const done = ((await call("settings.get", { key: "taxes.yearEnd" })) ?? {}) as Record<string, YearEndKey[]>;
      const ticked = new Set(done[today.slice(0, 4)] ?? []);
      const dispense = dispenseOutlook(data, state);
      return {
        date: today,
        items: yearEndChecklist(data, state).map((i) => ({ key: i.key, title: i.title, done: ticked.has(i.key), estimatedSaving: i.saving == null ? null : cents(i.saving), detail: i.detail, lines: i.lines })),
        withholdingDispense: { forYear: dispense.year, ceiling: dispense.ceiling, interest: cents(dispense.interest), advanceAvoided: cents(dispense.advance), institutions: dispense.institutions.map((i) => ({ id: i.id, name: i.name, interest: cents(i.interest), advance: cents(i.advance), alreadyRequested: i.dispensed })) },
      };
    },
  );

  tool(
    "get_tax_settings",
    {
      title: "Paramètres fiscaux",
      description:
        "Paramètres fiscaux du foyer utilisés par Hamac (tranche marginale, couple, taux du prélèvement forfaitaire et des prélèvements sociaux, assurance-vie, PEA, plafond PER, dispenses d'acompte, régimes de la location) et les règles de l'année de revenus (cases vérifiées ou non, source, seuil d'exonération crypto). En lecture seule : ils se modifient dans Paramètres › Plan › Fiscalité.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const { ws, today } = await loadEngine(call);
      const year = Number(today.slice(0, 4)) - 1;
      const rules = fiscalRulesFor(year);
      return {
        household: { couple: ws.params.profile.couple, netMonthlyIncome: ws.params.profile.netMonthlyIncome },
        tax: ws.params.tax,
        rental: ws.params.rental,
        crypto: ws.params.crypto,
        rulesForLastYear: { incomeYear: rules.incomeYear, verified: rules.covered, verifiedOn: rules.verifiedOn, source: rules.source, cryptoExemptionThreshold: rules.cryptoExemptionThreshold, lossCarryYears: rules.lossCarryYears },
        lastVerifiedIncomeYear: LAST_VERIFIED_INCOME_YEAR,
      };
    },
  );
}
