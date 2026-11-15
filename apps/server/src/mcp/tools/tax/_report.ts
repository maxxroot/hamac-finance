import { z } from "zod";
import { buildTaxReport, compareWithStatement, cryptoTax, MODE_LABELS, reportTotalsMismatches, TAX_DISCLAIMER, taxReportAlerts, taxReportYears, type TaxReport, type TaxSheet } from "@hamac/core";
import { cents, loadEngine, ToolError, type Call, type Engine } from "../../engine";
import { READ_ONLY } from "../fields";
import type { ToolRegistrar } from "../registrar";

/** Récapitulatif fiscal d'une année : le même calcul que la page Aide à la déclaration. */

const STATUS_HELP = { calcule: "Hamac a toutes les données", a_verifier: "une hypothèse a été faite, voir notes", manquant: "il manque une donnée, voir notes" };

/** Le récapitulatif d'une année, avec ses contrôles. Partagé avec la saisie de l'IFU. */
export function taxReportFor(engine: Engine, year: number) {
  const crypto = cryptoTax(engine.data, engine.today);
  const report = buildTaxReport(engine.data, engine.state.disposals, crypto, year);
  const alerts = taxReportAlerts(report, engine.data, engine.state.disposals, engine.ws.taxStatements);
  return { report, alerts };
}

/** Montants du document de l'établissement déjà saisis pour une année. */
export function savedStatement(engine: Engine, institutionId: string, year: number): Map<string, number> {
  return new Map(engine.ws.taxStatements.filter((x) => x.institutionId === institutionId && x.year === year).map((x) => [x.box, x.amount]));
}

export function comparison(sheet: TaxSheet, report: TaxReport, official: ReadonlyMap<string, number>) {
  return compareWithStatement(sheet, report.rules, official).map((c) => ({ box: c.rule.box, form: c.rule.form, label: c.rule.label, hamac: cents(c.hamac), statement: c.official, gap: c.gap }));
}

const sheetSummary = (s: TaxSheet) => ({
  key: s.key,
  institutionId: s.institutionId,
  name: s.name,
  mode: MODE_LABELS[s.mode],
  accounts: s.accounts.map((a) => a.name),
  boxes: s.lines.map((l) => ({ box: l.rule.box, form: l.rule.form, label: l.rule.label, amount: l.amount, status: l.status, notes: l.notes })),
  securities: s.securities,
  crypto: s.crypto,
});

function sheetDetail(s: TaxSheet, report: TaxReport, engine: Engine) {
  return {
    ...sheetSummary(s),
    incomes: s.incomes.map((i) => ({ date: i.tx.date, type: i.tx.type, account: i.accountName, asset: i.assetName, received: i.tx.amount, gross: cents(i.gross), incomeTax: cents(i.incomeTax), social: cents(i.social), foreign: cents(i.foreign), status: i.status, note: i.note })),
    disposals: s.disposals.map((d) => ({ date: d.date, kind: d.kind, account: d.accountName, asset: d.assetName, quantity: d.quantity, proceeds: cents(d.proceeds), cost: cents(d.cost), gain: cents(d.gain), status: d.status, note: d.note })),
    cryptoSales: s.cryptoSales.map((c) => ({ date: c.sale.date, account: c.accountName, asset: c.assetName, gross: cents(c.sale.gross), fee: cents(c.sale.fee), portfolioValue: cents(c.sale.portfolioValue), attributedCost: cents(c.sale.attributed), gain: cents(c.sale.gain), status: c.status })),
    statementComparison: s.institutionId ? comparison(s, report, savedStatement(engine, s.institutionId, report.year)) : [],
  };
}

export function registerTaxReportTool(tool: ToolRegistrar, call: Call): void {
  tool(
    "get_tax_report",
    {
      title: "Récapitulatif fiscal (aide à la déclaration)",
      description:
        "Pour une année de revenus : les cases à reporter sur la déclaration (2042, 2042 C), avec la part à saisir et la part à contrôler avec l'IFU, les fiches par établissement, les plus et moins-values de valeurs mobilières (2074), les cessions d'actifs numériques (2086), les comptes non couverts et pourquoi, les rappels et les points à contrôler. Avec institutionId : le détail de la fiche de cet établissement (chaque revenu, chaque cession) et la comparaison avec les montants de son IFU déjà saisis. Couvre les comptes-titres, le crowdlending et la crypto ; ne calcule pas l'impôt final (voir get_tax_estimate).",
      inputSchema: {
        year: z.number().int().min(2000).max(2100).optional().describe("Année de revenus ; par défaut l'an dernier, celle qui se déclare au printemps."),
        institutionId: z.string().optional().describe("Établissement de list_institutions : détail de sa fiche."),
      },
      annotations: READ_ONLY,
    },
    async ({ year, institutionId }) => {
      const engine = await loadEngine(call);
      const incomeYear = year ?? Number(engine.today.slice(0, 4)) - 1;
      const { report, alerts } = taxReportFor(engine, incomeYear);
      const base = {
        year: report.year,
        declarationYear: report.rules.declarationYear,
        rules: { verified: report.rules.covered, verifiedOn: report.rules.verifiedOn, source: report.rules.source },
        disclaimer: TAX_DISCLAIMER,
        availableYears: taxReportYears(engine.data, engine.today),
        statusHelp: STATUS_HELP,
        alerts: alerts.map((a) => ({ level: a.level, message: a.message, sheet: a.sheetKey })),
      };
      if (institutionId) {
        const sheet = report.sheets.find((s) => s.institutionId === institutionId);
        if (!sheet) throw new ToolError(`Aucune fiche pour cet établissement en ${incomeYear} : Hamac ne rédige de fiche que pour les comptes-titres, le crowdlending et la crypto (les autres comptes figurent dans otherAccounts du récapitulatif complet).`);
        return { ...base, alerts: base.alerts.filter((a) => a.sheet === sheet.key || a.sheet === null), sheet: sheetDetail(sheet, report, engine) };
      }
      return {
        ...base,
        consistent: reportTotalsMismatches(report).length === 0,
        boxes: report.lines.map((l) => ({ box: l.rule.box, form: l.rule.form, label: l.rule.label, total: l.total, toEnter: l.toEnter, toCheck: l.toCheck, status: l.status, notes: l.notes })),
        sheets: report.sheets.map(sheetSummary),
        securities: report.securities,
        crypto: report.crypto,
        otherAccounts: report.others.map((o) => ({ account: o.account.name, kind: o.account.kind, reason: o.reason })),
        reminders: report.reminders,
      };
    },
  );
}
