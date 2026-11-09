import type { Account, Asset, Transaction } from "./domain";
import { computePortfolio, type Disposal, type EngineData } from "./engine";
import { fiscalRulesFor, LAST_VERIFIED_INCOME_YEAR, socialRateFor, type FiscalYearRules, type TaxBoxKey, type TaxBoxRule } from "./fiscalRules";
import { crowdTaxOf, grossFromNet, NO_INSTITUTION_TAX, type Institution } from "./institutions";
import { roundCents } from "./money";
import { securitiesGains, type SecuritiesYear } from "./securitiesGains";
import { type CryptoSale, type CryptoTaxReport, type CryptoYear } from "./taxes";

/**
 * Récapitulatif fiscal : un seul calcul, deux vues (une fiche par établissement, un total).
 * Il dit quoi reporter, où et d'après quelles opérations ; il ne calcule pas l'impôt final.
 * Document d'aide : il ne remplace ni l'IFU de l'établissement ni la notice officielle.
 */

export type TaxStatus = "calcule" | "a_verifier" | "manquant";
/** À saisir : rien n'a été transmis au fisc. À contrôler : l'IFU de l'établissement fait foi. */
export type SheetMode = "a_saisir" | "a_controler";

const WORST: readonly TaxStatus[] = ["manquant", "a_verifier", "calcule"];
export function worstStatus(list: readonly TaxStatus[]): TaxStatus {
  return WORST.find((s) => list.includes(s)) ?? "calcule";
}

export const TAX_DISCLAIMER = "Document d'aide établi à partir de vos saisies. Il ne remplace ni l'IFU de l'établissement ni la notice officielle, et vous restez responsable de votre déclaration.";

export interface ResolvedIncome {
  gross: number;
  incomeTax: number;
  social: number;
  foreign: number;
  status: TaxStatus;
  note: string | null;
}

/** Brut et retenues d'un dividende ou d'intérêts : ce qui est saisi, sinon ce que permet de déduire l'établissement. */
export function resolveIncome(tx: Transaction, account: Pick<Account, "kind" | "institutionId">, data: Pick<EngineData, "params" | "institutions">): ResolvedIncome {
  if (tx.gross != null) {
    const incomeTax = tx.withheldIncomeTax ?? 0;
    const social = tx.withheldSocial ?? 0;
    const foreign = tx.withheldForeign ?? 0;
    const coherent = Math.abs(tx.gross - incomeTax - social - foreign - tx.amount) < 0.02;
    return { gross: tx.gross, incomeTax, social, foreign, status: coherent ? "calcule" : "a_verifier", note: coherent ? null : "Le brut moins les retenues ne correspond pas au montant reçu." };
  }
  if (account.kind === "crowdlending") {
    const { withheld, rate } = crowdTaxOf(data, account);
    if (!withheld) return { gross: tx.amount, incomeTax: 0, social: 0, foreign: 0, status: "calcule", note: null };
    const gross = roundCents(tx.amount / (1 - rate));
    const incomeTax = roundCents(gross * Math.min(rate, data.params.tax.pfuIncomeTax));
    return { gross, incomeTax, social: roundCents(gross - tx.amount - incomeTax), foreign: 0, status: "calcule", note: null };
  }
  const tax = data.institutions?.find((i) => i.id === account.institutionId)?.tax ?? NO_INSTITUTION_TAX;
  const fromRates = grossFromNet(tx.amount, tax);
  if (fromRates) return { ...fromRates, foreign: 0, status: "calcule", note: "Déduit des retenues réglées sur l'établissement." };
  if (tax.report) return { gross: tx.amount, incomeTax: 0, social: 0, foreign: 0, status: "manquant", note: "Brut non renseigné : le montant reçu est repris tel quel." };
  const year = +tx.date.slice(0, 4);
  const rate = data.params.tax.withholdingDispense ? 0 : data.params.tax.pfuIncomeTax;
  const socialRate = socialRateFor(year, "placement", data.params);
  const gross = roundCents(tx.amount / (1 - socialRate - rate));
  return { gross, incomeTax: roundCents(gross * rate), social: roundCents(gross * socialRate), foreign: 0, status: "a_verifier", note: "Hypothèse d'une retenue française, à contrôler avec l'IFU de l'établissement." };
}

/** Cessions relevant des valeurs mobilières : les parts de SCPI suivent le régime des plus-values immobilières. */
export function securityDisposals(disposals: readonly Disposal[], assets: readonly Asset[]): Disposal[] {
  const scpi = new Set(assets.filter((a) => a.kind === "scpi").map((a) => a.id));
  return disposals.filter((d) => !scpi.has(d.assetId));
}

export interface TaxLine {
  key: TaxBoxKey;
  rule: TaxBoxRule;
  amount: number;
  status: TaxStatus;
  notes: string[];
  transactionIds: string[];
}

export interface IncomeDetail extends ResolvedIncome {
  tx: Transaction;
  accountName: string;
  assetName: string | null;
}

export interface DisposalDetail extends Disposal {
  accountName: string;
  assetName: string;
  status: TaxStatus;
  note: string | null;
}

export interface CryptoSaleDetail {
  sale: CryptoSale;
  accountName: string;
  assetName: string;
  status: TaxStatus;
}

export interface TaxSheet {
  key: string;
  institutionId: string | null;
  name: string;
  mode: SheetMode;
  accounts: Account[];
  lines: TaxLine[];
  incomes: IncomeDetail[];
  disposals: DisposalDetail[];
  /** Résultat des cessions de cet établissement, avant compensation avec les autres. */
  securities: { gains: number; losses: number; net: number };
  cryptoSales: CryptoSaleDetail[];
  /** Contribution aux totaux crypto ; le gain imposable ne se calcule que sur le portefeuille global. */
  crypto: { proceeds: number; gain: number };
}

export interface ConsolidatedLine {
  key: TaxBoxKey;
  rule: TaxBoxRule;
  total: number;
  /** Part à saisir (fiches rédigées par Hamac) et part à contrôler avec un IFU ; null pour un montant global. */
  toEnter: number | null;
  toCheck: number | null;
  status: TaxStatus;
  notes: string[];
}

export interface OtherAccount {
  account: Account;
  reason: string;
}

export interface TaxReport {
  year: number;
  rules: FiscalYearRules;
  sheets: TaxSheet[];
  lines: ConsolidatedLine[];
  securities: SecuritiesYear | null;
  crypto: CryptoYear | null;
  others: OtherAccount[];
  reminders: string[];
}

const ADDITIVE: readonly TaxBoxKey[] = ["dividendes", "interets", "crowdlending", "psDejaPreleves", "acompte", "creditImpot"];
const NO_ESTABLISHMENT = "sans-etablissement";
const COVERED_KINDS: readonly Account["kind"][] = ["cto", "crowdlending", "crypto"];

function sum<T>(list: readonly T[], f: (x: T) => number): number {
  return roundCents(list.reduce((s, x) => s + f(x), 0));
}

function line(rules: FiscalYearRules, key: TaxBoxKey, items: ReadonlyArray<{ amount: number; status: TaxStatus; id: string }>, notes: string[] = [], force?: TaxStatus): TaxLine | null {
  const amount = sum(items, (x) => x.amount);
  if (amount === 0) return null;
  return { key, rule: rules.boxes[key], amount, status: force ?? worstStatus(items.map((x) => x.status)), notes, transactionIds: items.filter((x) => x.amount !== 0).map((x) => x.id) };
}

function disposalStatus(d: Disposal, asset: Asset | undefined): { status: TaxStatus; note: string | null } {
  if (d.oversold) return { status: "manquant", note: "Quantité vendue supérieure à la quantité détenue : il manque un achat." };
  if (d.cost <= 0 && d.proceeds > 0) return { status: "manquant", note: "Aucun prix de revient connu pour cette cession." };
  if (asset?.kind === "obligation") return { status: "a_verifier", note: d.kind === "remboursement" ? "Remboursement à l'échéance : traitement de la prime à vérifier." : "Obligation : traitement du coupon couru à vérifier." };
  return { status: "calcule", note: null };
}

function otherReason(a: Account): string {
  switch (a.kind) {
    case "livret":
      return "Livret : intérêts exonérés si le livret est réglementé. Sinon, voir l'IFU de la banque.";
    case "pea":
    case "pea_pme":
      return "Rien à déclarer sans retrait. En cas de retrait ou de clôture, voir l'IFU de l'établissement.";
    case "assurance_vie":
      return "Intérêts et rachats : voir l'IFU de l'assureur.";
    default:
      return "Non calculé ici : voir l'IFU de l'établissement.";
  }
}

export function buildTaxReport(data: EngineData, disposals: readonly Disposal[], crypto: CryptoTaxReport, year: number): TaxReport {
  const rules = fiscalRulesFor(year);
  const prefix = `${year}-`;
  const assets = new Map(data.assets.map((a) => [a.id, a]));
  const institutions = new Map<string, Institution>((data.institutions ?? []).map((i) => [i.id, i]));
  const accountsById = new Map(data.accounts.map((a) => [a.id, a]));
  const covered = data.accounts.filter((a) => COVERED_KINDS.includes(a.kind));
  const groups = new Map<string, Account[]>();
  for (const a of covered) {
    const key = a.institutionId && institutions.has(a.institutionId) ? a.institutionId : NO_ESTABLISHMENT;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  const securityRows = securityDisposals(disposals, data.assets);
  const sheets: TaxSheet[] = [];
  for (const [key, accounts] of groups) {
    const institution = institutions.get(key);
    const ids = new Set(accounts.map((a) => a.id));
    const incomes: IncomeDetail[] = data.transactions
      .filter((t) => ids.has(t.accountId) && t.date.startsWith(prefix) && (t.type === "dividende" || t.type === "interets") && accountsById.get(t.accountId)!.kind !== "crypto")
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((tx) => {
        const account = accountsById.get(tx.accountId)!;
        return { ...resolveIncome(tx, account, data), tx, accountName: account.name, assetName: tx.assetId ? (assets.get(tx.assetId)?.name ?? null) : null };
      });
    const details: DisposalDetail[] = securityRows
      .filter((d) => ids.has(d.accountId) && accountsById.get(d.accountId)!.kind === "cto" && d.date.startsWith(prefix))
      .map((d) => {
        const asset = assets.get(d.assetId);
        return { ...d, ...disposalStatus(d, asset), accountName: accountsById.get(d.accountId)!.name, assetName: asset?.name ?? "Titre inconnu" };
      });
    const cryptoSales: CryptoSaleDetail[] = crypto.sales
      .filter((s) => s.year === year && ids.has(s.tx.accountId))
      .map((sale) => ({ sale, accountName: accountsById.get(sale.tx.accountId)!.name, assetName: assets.get(sale.tx.assetId!)?.name ?? "Actif inconnu", status: sale.portfolioValue <= 0 ? "manquant" : sale.estimatedValue ? "a_verifier" : "calcule" }));

    const report = institution?.tax?.report ?? false;
    if (!report && incomes.length === 0 && details.length === 0 && cryptoSales.length === 0) continue;

    const isCrowd = (x: IncomeDetail) => accountsById.get(x.tx.accountId)!.kind === "crowdlending";
    const dividends = incomes.filter((x) => x.tx.type === "dividende");
    const interests = incomes.filter((x) => x.tx.type === "interets" && !isCrowd(x));
    const crowd = incomes.filter(isCrowd);
    const fund = dividends.some((x) => {
      const kind = x.tx.assetId ? assets.get(x.tx.assetId)?.kind : undefined;
      return kind === "etf" || kind === "fonds";
    });
    const item = (x: IncomeDetail, amount: number) => ({ amount, status: x.status, id: x.tx.id });
    const lines = [
      line(rules, "dividendes", dividends.map((x) => item(x, x.gross)), fund ? ["Distributions d'ETF ou de fonds : vérifiez sur le relevé la répartition entre cette case et les intérêts."] : [], fund ? "a_verifier" : undefined),
      line(rules, "interets", interests.map((x) => item(x, x.gross))),
      line(rules, "crowdlending", crowd.map((x) => item(x, x.gross)), ["Case réservée aux prêts participatifs et aux minibons. Obligations et bons de caisse : case des intérêts."]),
      line(rules, "psDejaPreleves", incomes.filter((x) => x.social > 0).map((x) => item(x, x.gross)), ["Revenus sur lesquels les prélèvements sociaux ont déjà été retenus."]),
      line(rules, "acompte", incomes.map((x) => item(x, x.incomeTax))),
      line(rules, "creditImpot", incomes.map((x) => item(x, x.foreign)), ["Retenue à l'étranger : le crédit d'impôt dépend de la convention fiscale du pays, à vérifier."], "a_verifier"),
    ].filter((l): l is TaxLine => l !== null);

    const gains = sum(details, (d) => Math.max(0, d.gain));
    const losses = sum(details, (d) => Math.max(0, -d.gain));
    sheets.push({
      key,
      institutionId: institution?.id ?? null,
      name: institution?.name ?? "Comptes sans établissement",
      mode: report ? "a_saisir" : "a_controler",
      accounts,
      lines,
      incomes,
      disposals: details,
      securities: { gains, losses, net: roundCents(gains - losses) },
      cryptoSales,
      crypto: { proceeds: sum(cryptoSales, (s) => s.sale.gross), gain: sum(cryptoSales, (s) => s.sale.gain) },
    });
  }
  sheets.sort((a, b) => (a.mode === b.mode ? a.name.localeCompare(b.name, "fr") : a.mode === "a_saisir" ? -1 : 1));

  const lines: ConsolidatedLine[] = [];
  for (const key of ADDITIVE) {
    const of = (mode: SheetMode) => sum(sheets.filter((s) => s.mode === mode), (s) => s.lines.find((l) => l.key === key)?.amount ?? 0);
    const present = sheets.flatMap((s) => s.lines.filter((l) => l.key === key));
    if (present.length === 0) continue;
    const toEnter = of("a_saisir");
    const toCheck = of("a_controler");
    lines.push({ key, rule: rules.boxes[key], total: roundCents(toEnter + toCheck), toEnter, toCheck, status: worstStatus(present.map((l) => l.status)), notes: [...new Set(present.flatMap((l) => l.notes))] });
  }

  const securities = securitiesGains(securityRows, data.accounts, year, rules.lossCarryYears).find((r) => r.year === year) ?? null;
  const cryptoYear = crypto.years.find((y) => y.year === year) ?? null;
  const allDisposals = sheets.flatMap((s) => s.disposals);
  const global = (key: TaxBoxKey, total: number, status: TaxStatus, notes: string[] = []) => {
    if (total > 0) lines.push({ key, rule: rules.boxes[key], total, toEnter: null, toCheck: null, status, notes });
  };
  if (securities) {
    const status = worstStatus(allDisposals.map((d) => d.status));
    global("plusValue", securities.taxableGain, status, securities.usedCarry.length ? ["Après imputation des moins-values antérieures, à détailler sur la 2074."] : []);
    global("moinsValue", securities.yearLoss, status, ["Moins-value de l'année seulement, sans les moins-values antérieures."]);
  }
  if (cryptoYear) {
    const status = worstStatus(sheets.flatMap((s) => s.cryptoSales.map((c) => c.status)));
    global("cryptoPlusValue", cryptoYear.exempt ? 0 : Math.max(0, cryptoYear.netGain), status);
    global("cryptoMoinsValue", Math.max(0, -cryptoYear.netGain), status);
  }

  const others = data.accounts.filter((a) => !COVERED_KINDS.includes(a.kind) && !a.archived).map((account) => ({ account, reason: otherReason(account) }));

  const reminders: string[] = [];
  if (sheets.some((s) => s.mode === "a_saisir" && s.disposals.length > 0)) reminders.push("Quand l'établissement n'a pas calculé toutes vos plus ou moins-values, la 2074 est à souscrire.");
  if (cryptoYear) reminders.push(cryptoYear.exempt ? `Cessions d'actifs numériques sous ${rules.cryptoExemptionThreshold} € : plus-value exonérée, mais la 2086 reste à joindre.` : "La 2086 est à joindre à la déclaration, avec le détail de chaque cession.");
  if (sheets.some((s) => s.mode === "a_saisir" && s.incomes.length > 0)) reminders.push("Si l'établissement payeur est établi à l'étranger, reportez d'abord ces revenus sur la 2047.");
  reminders.push("Tout compte ouvert, détenu, utilisé ou clos à l'étranger se déclare chaque année sur la 3916 ou la 3916-bis, même sans revenu.");
  reminders.push("L'option pour le barème (case 2OP) porte sur l'ensemble des revenus de capitaux mobiliers et des plus-values. Celle des actifs numériques (case 3CN) en est indépendante.");

  return { year, rules, sheets, lines, securities, crypto: cryptoYear, others, reminders };
}

/** Années proposées : de la première opération concernée à l'année en cours. */
export function taxReportYears(data: Pick<EngineData, "accounts" | "transactions">, asOf: string): number[] {
  const covered = new Set(data.accounts.filter((a) => COVERED_KINDS.includes(a.kind)).map((a) => a.id));
  const last = +asOf.slice(0, 4);
  const first = Math.min(last, ...data.transactions.filter((t) => covered.has(t.accountId)).map((t) => +t.date.slice(0, 4)));
  const years: number[] = [];
  for (let y = last; y >= first; y--) years.push(y);
  return years;
}

/** Année de validité, affichée sur chaque document. */
export function rulesValidityLabel(rules: FiscalYearRules, lastVerifiedYear = LAST_VERIFIED_INCOME_YEAR): string {
  if (!rules.covered) return `Aucune règle vérifiée pour les revenus ${rules.incomeYear} : numéros de case repris des revenus ${lastVerifiedYear}, à titre indicatif.`;
  const [y, m, d] = rules.verifiedOn!.split("-");
  return `Règles vérifiées le ${d}/${m}/${y} d'après : ${rules.source}.`;
}

export const STATUS_LABELS: Record<TaxStatus, string> = { calcule: "Calculé", a_verifier: "À vérifier", manquant: "Donnée manquante" };
export const MODE_LABELS: Record<SheetMode, string> = { a_saisir: "À saisir", a_controler: "À contrôler avec l'IFU" };

/** Détail des opérations, pour un tableur. */
export function taxReportCsvRows(report: TaxReport): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = [["Établissement", "Traitement", "Compte", "Date", "Nature", "Titre", "Reçu ou prix de cession", "Brut", "Acompte retenu", "Prélèvements sociaux retenus", "Retenue étrangère", "Prix de revient", "Gain", "Statut", "Remarque"]];
  for (const s of report.sheets) {
    const mode = MODE_LABELS[s.mode];
    for (const i of s.incomes) rows.push([s.name, mode, i.accountName, i.tx.date, i.tx.type === "dividende" ? "Dividende" : "Intérêts", i.assetName, i.tx.amount, i.gross, i.incomeTax, i.social, i.foreign, null, null, STATUS_LABELS[i.status], i.note]);
    for (const d of s.disposals) rows.push([s.name, mode, d.accountName, d.date, d.kind === "vente" ? "Vente" : "Remboursement", d.assetName, d.proceeds, null, null, null, null, d.cost, d.gain, STATUS_LABELS[d.status], d.note]);
    for (const c of s.cryptoSales) rows.push([s.name, mode, c.accountName, c.sale.date, "Cession crypto", c.assetName, c.sale.net, null, null, null, null, c.sale.attributed, c.sale.gain, STATUS_LABELS[c.status], null]);
  }
  return rows;
}

// ——— Contrôles de cohérence ———

export interface TaxAlert {
  level: "erreur" | "attention";
  message: string;
  /** Fiche concernée ; null pour le récapitulatif complet. */
  sheetKey: string | null;
}

/** Montant lu sur le document de l'établissement, pour une case. */
export interface TaxStatementAmount {
  institutionId: string;
  year: number;
  box: string;
  amount: number;
}

export interface StatementComparison {
  key: TaxBoxKey;
  rule: TaxBoxRule;
  hamac: number;
  /** Montant du document ; null tant qu'il n'est pas saisi. */
  official: number | null;
  gap: number | null;
}

const COMPARED_KEYS: Record<"cto" | "crowdlending", readonly TaxBoxKey[]> = {
  cto: ["dividendes", "interets", "psDejaPreleves", "acompte", "creditImpot", "plusValue", "moinsValue"],
  crowdlending: ["crowdlending", "psDejaPreleves", "acompte"],
};

/** Compare une fiche à ce qui est écrit sur le document de l'établissement, case par case. */
export function compareWithStatement(sheet: TaxSheet, rules: FiscalYearRules, official: ReadonlyMap<string, number>): StatementComparison[] {
  const keys = [...new Set(sheet.accounts.flatMap((a) => (a.kind === "cto" || a.kind === "crowdlending" ? COMPARED_KEYS[a.kind] : [])))];
  return keys.map((key) => {
    const rule = rules.boxes[key];
    const hamac = key === "plusValue" ? Math.max(0, sheet.securities.net) : key === "moinsValue" ? Math.max(0, -sheet.securities.net) : (sheet.lines.find((l) => l.key === key)?.amount ?? 0);
    const value = official.get(rule.box) ?? null;
    return { key, rule, hamac, official: value, gap: value == null ? null : roundCents(hamac - value) };
  });
}

/** Écarts entre le récapitulatif et la somme des fiches : toujours vide, sauf anomalie de calcul. */
export function reportTotalsMismatches(report: TaxReport): string[] {
  const out: string[] = [];
  for (const l of report.lines) {
    if (l.toEnter === null) continue;
    const sum = report.sheets.reduce((t, s) => t + (s.lines.find((x) => x.key === l.key)?.amount ?? 0), 0);
    if (Math.abs(sum - l.total) >= 0.01) out.push(l.rule.box);
  }
  if (report.securities && Math.abs(report.sheets.reduce((t, s) => t + s.securities.net, 0) - report.securities.net) >= 0.01) out.push(report.rules.boxes.plusValue.box);
  if (report.crypto && Math.abs(report.sheets.reduce((t, s) => t + s.crypto.gain, 0) - report.crypto.netGain) >= 0.02) out.push(report.rules.boxes.cryptoPlusValue.box);
  return out;
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export function taxReportAlerts(report: TaxReport, data: EngineData, disposals: readonly Disposal[], statements: readonly TaxStatementAmount[] = []): TaxAlert[] {
  const alerts: TaxAlert[] = [];
  const { year, rules, sheets } = report;
  const prefix = `${year}-`;
  const assets = new Map(data.assets.map((a) => [a.id, a]));
  if (!rules.covered) alerts.push({ level: "attention", message: `Les cases des revenus ${year} ne sont pas encore vérifiées : comparez-les à la notice de l'année.`, sheetKey: null });
  const mismatches = reportTotalsMismatches(report);
  if (mismatches.length) alerts.push({ level: "erreur", message: `La somme des fiches ne correspond pas au récapitulatif (${mismatches.join(", ")}).`, sheetKey: null });

  for (const s of sheets) {
    const missing = s.incomes.filter((i) => i.status === "manquant").length;
    if (missing) alerts.push({ level: "erreur", message: `${s.name} : ${missing} ${plural(missing, "revenu", "revenus")} sans brut ni retenues. Complétez les opérations au Journal, ou réglez les retenues sur l'établissement.`, sheetKey: s.key });
    const incoherent = s.incomes.filter((i) => i.tx.gross != null && i.status === "a_verifier").length;
    if (incoherent) alerts.push({ level: "attention", message: `${s.name} : ${incoherent} ${plural(incoherent, "revenu dont", "revenus dont")} le brut moins les retenues diffère du montant reçu.`, sheetKey: s.key });
    for (const d of s.disposals.filter((x) => x.status === "manquant")) alerts.push({ level: "erreur", message: `${s.name} : ${d.assetName}, cession du ${d.date}. ${d.note}`, sheetKey: s.key });
    const bonds = s.disposals.filter((x) => x.status === "a_verifier").length;
    if (bonds) alerts.push({ level: "attention", message: `${s.name} : ${bonds} ${plural(bonds, "cession d'obligation", "cessions d'obligations")} à vérifier.`, sheetKey: s.key });
    for (const c of s.cryptoSales.filter((x) => x.status !== "calcule")) alerts.push({ level: c.status === "manquant" ? "erreur" : "attention", message: `${s.name} : cession du ${c.sale.date}, valeur globale du portefeuille ${c.status === "manquant" ? "inconnue" : "estimée faute de cours récent pour un autre actif"}.`, sheetKey: s.key });
    if (s.institutionId === null) alerts.push({ level: "attention", message: "Des comptes n'ont pas d'établissement : rattachez-les pour savoir si leurs montants sont à saisir ou à contrôler.", sheetKey: s.key });
    if (s.institutionId) {
      const own = new Map(statements.filter((x) => x.institutionId === s.institutionId && x.year === year).map((x) => [x.box, x.amount]));
      for (const c of compareWithStatement(s, rules, own)) {
        if (c.gap != null && Math.abs(c.gap) >= 1) alerts.push({ level: "attention", message: `${s.name} : écart sur la case ${c.rule.box} entre Hamac et le document de l'établissement.`, sheetKey: s.key });
      }
    }
  }

  const covered = new Set(sheets.flatMap((s) => s.accounts.map((a) => a.id)));
  const accounts = new Map(data.accounts.map((a) => [a.id, a]));
  const ofYear = disposals.filter((d) => d.date.startsWith(prefix));
  for (const d of ofYear.filter((x) => assets.get(x.assetId)?.kind === "scpi" && accounts.get(x.accountId)?.kind === "cto")) {
    alerts.push({ level: "attention", message: `Cession de ${assets.get(d.assetId)!.name} le ${d.date} : les parts de SCPI relèvent des plus-values immobilières et ne sont pas reprises ici.`, sheetKey: null });
  }
  const multiple = new Set<string>();
  for (const assetId of new Set(ofYear.filter((d) => accounts.get(d.accountId)?.kind === "cto").map((d) => d.assetId))) {
    const holders = new Set(data.transactions.filter((t) => t.assetId === assetId && t.type === "achat" && accounts.get(t.accountId)?.kind === "cto").map((t) => t.accountId));
    if (holders.size > 1) multiple.add(assets.get(assetId)?.name ?? assetId);
  }
  for (const name of multiple) alerts.push({ level: "attention", message: `${name} est détenu sur plusieurs comptes-titres : le prix de revient est calculé compte par compte, à vérifier.`, sheetKey: null });

  for (const a of data.accounts.filter((x) => !covered.has(x.id))) {
    if (["pea", "pea_pme", "assurance_vie", "per"].includes(a.kind) && data.transactions.some((t) => t.accountId === a.id && t.type === "retrait" && t.date.startsWith(prefix))) {
      alerts.push({ level: "attention", message: `Retrait en ${year} sur ${a.name} : non calculé ici, reportez-vous à l'IFU de l'établissement.`, sheetKey: null });
    }
  }
  for (const a of data.accounts.filter((x) => x.kind === "crypto")) {
    if (data.transactions.some((t) => t.accountId === a.id && t.type === "interets" && t.date.startsWith(prefix))) alerts.push({ level: "attention", message: `Intérêts ${year} sur ${a.name} : les revenus de placement de crypto ne sont pas repris ici.`, sheetKey: null });
  }

  const statesByDate = new Map<string, ReturnType<typeof computePortfolio>>();
  for (const s of sheets) {
    for (const a of s.accounts) {
      const last = (data.statements ?? []).filter((x) => x.accountId === a.id && x.date.startsWith(prefix)).sort((x, y) => y.date.localeCompare(x.date))[0];
      if (!last) continue;
      const state = statesByDate.get(last.date) ?? computePortfolio(data, last.date);
      statesByDate.set(last.date, state);
      const gap = state.accountById.get(a.id)?.statementGap ?? 0;
      if (Math.abs(gap) > Math.max(10, Math.abs(last.value) * 0.01)) alerts.push({ level: "attention", message: `${a.name} : le relevé du ${last.date} s'écarte de la valeur calculée. Une opération manque peut-être au Journal.`, sheetKey: s.key });
    }
  }
  return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "erreur" ? -1 : 1));
}

