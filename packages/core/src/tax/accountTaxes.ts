import { addMonths, formatEur, roundCents } from "../base";
import { securitiesGains, type AccountState, type EngineData, type PortfolioState } from "../portfolio";
import { socialRateFor } from "./fiscalRules";
import { crowdTaxOf, incomeTaxRate } from "../model";
import { accountWithholds, resolveIncome, securityDisposals } from "./taxReport";
import type { CryptoTaxReport } from "./cryptoTax";

/**
 * Impôts compte par compte : ce qui a été retenu à la source, ce qui passe par la déclaration, ce qui reste à payer.
 * Mêmes règles que « Impôts de chaque année » (`yearlyTaxes`) : la somme des comptes retombe sur le total de chaque année.
 * La plus-value des comptes-titres et celle des cryptos se calculent tous comptes confondus : l'impôt de l'année est
 * réparti entre les comptes au prorata de leur plus-value.
 */

export interface AccountTaxYear {
  year: number;
  /** Revenus bruts : intérêts, coupons, dividendes. */
  income: number;
  /** Plus ou moins-value réalisée sur le compte (ventes, remboursements). */
  realizedGain: number;
  /** Retenu par l'établissement au versement des revenus. */
  atSource: number;
  /** Réglé avec l'avis d'impôt de l'année suivante, estimé d'après Paramètres › Plan ; négatif = remboursement. */
  atDeclaration: number;
  /** L'avis d'impôt de ces revenus est sorti. */
  settled: boolean;
  total: number;
}

export interface AccountTaxFact {
  label: string;
  amount?: number;
  pct?: number;
  text?: string;
  date?: string;
  /** La date est une échéance fiscale (8 ans d'une assurance-vie, 5 ans d'un PEA). */
  milestone?: boolean;
  hint?: string;
}

export interface AccountTaxDetail {
  accountId: string;
  /** Années où il s'est passé quelque chose, la plus récente d'abord. */
  years: AccountTaxYear[];
  /** Retenu à la source, plus les avis d'impôt déjà sortis. */
  paid: number;
  /** Avis d'impôt pas encore sortis (estimation). */
  toPay: number;
  /** Part de `toPay` à payer avec la prochaine déclaration (revenus de `nextDeclarationYear`). */
  nextDeclaration: number;
  facts: AccountTaxFact[];
  notes: string[];
}

/**
 * L'impôt sur les revenus de l'année N compte comme payé dès la sortie de l'avis d'impôt, mis en ligne entre fin juillet
 * et début août N+1 (impots.gouv.fr, calendrier de la déclaration des revenus) : retenu ici au 1er août. Le solde n'est
 * prélevé qu'à partir de fin septembre, mais le montant est alors connu et définitif.
 */
export const TAX_NOTICE_DAY = "08-01";
export function declarationSettled(incomeYear: number, asOf: string): boolean {
  return asOf >= `${incomeYear + 1}-${TAX_NOTICE_DAY}`;
}

/** Année de revenus de la prochaine déclaration : la plus ancienne dont l'avis n'est pas encore sorti. */
export function nextDeclarationYear(asOf: string): number {
  const year = +asOf.slice(0, 4);
  return declarationSettled(year - 1, asOf) ? year : year - 1;
}

/** Comptes dont Hamac calcule les retenues quand l'établissement prélève : leurs opérations « Impôts » servent alors de contrôle, pas d'ajout. */
const WITHHOLDING_COMPUTED: ReadonlySet<string> = new Set(["assurance_vie", "cto", "crowdlending"]);

interface YearAcc {
  income: number;
  realizedGain: number;
  atSource: number;
  atDeclaration: number;
}

const pct = (r: number) => `${(Math.round(r * 1000) / 10).toString().replace(".", ",")} %`;

export function accountTaxDetails(data: EngineData, state: PortfolioState, crypto: CryptoTaxReport): AccountTaxDetail[] {
  const p = data.params;
  const ir = incomeTaxRate(p);
  const asOf = state.asOf;
  const currentYear = +asOf.slice(0, 4);
  const nextYear = nextDeclarationYear(asOf);
  const accounts = new Map(data.accounts.map((a) => [a.id, a]));

  // Plus-values des comptes-titres : imposables après compensation entre comptes et moins-values reportables.
  const ctoDisposals = securityDisposals(state.disposals, data.assets).filter((d) => accounts.get(d.accountId)?.kind === "cto");
  const securitiesYears = securitiesGains(ctoDisposals, data.accounts, currentYear);
  const share = (byAccount: Map<string, number>, id: string) => {
    const positive = [...byAccount.values()].reduce((s, v) => s + Math.max(0, v), 0);
    return positive > 0 ? Math.max(0, byAccount.get(id) ?? 0) / positive : 0;
  };
  const netByYear = (rows: ReadonlyArray<{ year: number; accountId: string; gain: number }>) => {
    const out = new Map<number, Map<string, number>>();
    for (const r of rows) {
      const m = out.get(r.year) ?? new Map<string, number>();
      m.set(r.accountId, (m.get(r.accountId) ?? 0) + r.gain);
      out.set(r.year, m);
    }
    return out;
  };
  const ctoNet = netByYear(ctoDisposals.map((d) => ({ year: +d.date.slice(0, 4), accountId: d.accountId, gain: d.gain })));
  const cryptoNet = netByYear(crypto.sales.map((s) => ({ year: s.year, accountId: s.tx.accountId, gain: s.gain })));

  const shown = state.accounts.filter((s) => !s.account.archived || s.value !== 0);
  return shown.map((s) => {
    const a = s.account;
    const years = new Map<number, YearAcc>();
    const at = (y: number) => {
      let r = years.get(y);
      if (!r) years.set(y, (r = { income: 0, realizedGain: 0, atSource: 0, atDeclaration: 0 }));
      return r;
    };
    let foreign = 0;
    let journalTaxes = 0;
    let avSocial = 0;
    const withholds = accountWithholds(a, data);
    // Crowdlending : ses opérations « Impôts » sont toujours les débits des retenues notées sur les intérêts.
    const computed = a.kind === "crowdlending" || (WITHHOLDING_COMPUTED.has(a.kind) && withholds);

    for (const t of data.transactions) {
      if (t.accountId !== a.id || t.date > asOf) continue;
      const year = +t.date.slice(0, 4);
      const socialDue = socialRateFor(year, "patrimoine", p);
      if (t.type === "impots") {
        journalTaxes += t.amount;
        if (!computed) at(year).atSource += t.amount;
        continue;
      }
      if (t.type !== "interets" && t.type !== "dividende") continue;
      const y = at(year);
      if (a.kind === "assurance_vie" && t.type === "interets") {
        if (withholds) {
          // Intérêts du fonds euros saisis nets : l'assureur a retenu les prélèvements sociaux.
          const ps = (t.amount * p.tax.socialAv) / (1 - p.tax.socialAv);
          y.income += t.amount + ps;
          y.atSource += ps;
          avSocial += ps;
        } else {
          // Assureur qui ne prélève rien : intérêts saisis bruts, prélèvements sociaux à la déclaration.
          y.income += t.amount;
          y.atDeclaration += t.amount * p.tax.socialAv;
        }
      } else if (a.kind === "cto") {
        const r = resolveIncome(t, a, data);
        y.income += r.gross;
        y.atSource += (r.social > 0 ? r.social : 0) + r.incomeTax;
        // Impôt définitif et prélèvements sociaux non retenus à la source, moins l'acompte déjà versé.
        y.atDeclaration += (r.social > 0 ? 0 : r.gross * socialDue) + r.gross * ir - r.incomeTax;
        foreign += r.foreign;
      } else if (a.kind === "crowdlending" && t.type === "interets") {
        const r = resolveIncome(t, a, data);
        const withheld = r.incomeTax + r.social + r.foreign;
        y.income += r.gross;
        if (withheld > 0) y.atSource += withheld;
        else y.atDeclaration += r.gross * (ir + socialDue);
      } else {
        y.income += t.amount;
      }
    }

    if (a.kind === "cto") {
      for (const d of ctoDisposals.filter((x) => x.accountId === a.id)) at(+d.date.slice(0, 4)).realizedGain += d.gain;
      for (const sy of securitiesYears) {
        if (sy.taxableGain <= 0) continue;
        const part = share(ctoNet.get(sy.year) ?? new Map(), a.id);
        if (part > 0) at(sy.year).atDeclaration += sy.taxableGain * (ir + socialRateFor(sy.year, "patrimoine", p)) * part;
      }
    } else if (a.kind === "crypto") {
      for (const sale of crypto.sales.filter((x) => x.tx.accountId === a.id)) at(sale.year).realizedGain += sale.gain;
      for (const cy of crypto.years) {
        if (cy.total <= 0) continue;
        const part = share(cryptoNet.get(cy.year) ?? new Map(), a.id);
        if (part > 0) at(cy.year).atDeclaration += cy.total * part;
      }
    } else {
      for (const d of state.disposals.filter((x) => x.accountId === a.id)) at(+d.date.slice(0, 4)).realizedGain += d.gain;
    }

    const rows: AccountTaxYear[] = [...years.entries()]
      .map(([year, r]) => {
        const atSource = roundCents(r.atSource);
        const atDeclaration = roundCents(r.atDeclaration);
        return { year, income: roundCents(r.income), realizedGain: roundCents(r.realizedGain), atSource, atDeclaration, settled: declarationSettled(year, asOf), total: roundCents(atSource + atDeclaration) };
      })
      .filter((r) => r.income !== 0 || r.realizedGain !== 0 || r.total !== 0)
      .sort((x, y) => y.year - x.year);
    const paid = roundCents(rows.reduce((t, r) => t + r.atSource + (r.settled ? r.atDeclaration : 0), 0));
    const toPay = roundCents(rows.reduce((t, r) => t + (r.settled ? 0 : r.atDeclaration), 0));
    const nextDeclaration = rows.find((r) => r.year === nextYear)?.atDeclaration ?? 0;
    const withheldTotal = roundCents(rows.reduce((t, r) => t + r.atSource, 0));
    const { facts, notes } = kindFacts(s, data, crypto, { currentYear, asOf, foreign: roundCents(foreign), journalTaxes: roundCents(journalTaxes), avSocial: roundCents(avSocial), withheldTotal, securitiesYears, income: roundCents(rows.reduce((t, r) => t + r.income, 0)) });
    if (a.openedOn) facts.unshift({ label: "Ouvert le", date: a.openedOn });
    return { accountId: a.id, years: rows, paid, toPay, nextDeclaration, facts, notes };
  });
}

interface Ctx {
  currentYear: number;
  asOf: string;
  foreign: number;
  journalTaxes: number;
  avSocial: number;
  withheldTotal: number;
  income: number;
  securitiesYears: ReturnType<typeof securitiesGains>;
}

function kindFacts(s: AccountState, data: EngineData, crypto: CryptoTaxReport, c: Ctx): { facts: AccountTaxFact[]; notes: string[] } {
  const p = data.params;
  const a = s.account;
  const facts: AccountTaxFact[] = [];
  const notes: string[] = [];
  const milestone = (months: number, label: string, after: string, before: string) => {
    if (!a.openedOn) {
      notes.push("Date d'ouverture non renseignée : renseignez-la sur le compte pour connaître l'échéance fiscale.");
      return;
    }
    const date = addMonths(a.openedOn, months);
    facts.push({ label, date, milestone: true, hint: date <= c.asOf ? after : before });
  };

  switch (a.kind) {
    case "livret":
      facts.push({ label: "Intérêts reçus depuis le début", amount: roundCents(s.interests), hint: a.livretType === "AUTRE" ? undefined : "Sans impôt ni prélèvements sociaux" });
      if (a.livretType === "AUTRE") notes.push("Livret non réglementé : ses intérêts sont en principe imposables. Hamac ne les calcule pas, voyez l'IFU de la banque.");
      break;
    case "assurance_vie": {
      const allowance = p.profile.couple ? p.tax.avAllowanceCouple : p.tax.avAllowanceSingle;
      milestone(96, "8 ans du contrat", `Gains retirés imposés à ${pct(Math.min(p.tax.tmi, p.tax.avAfter8))} au-delà de ${formatEur(allowance)} par an`, `D'ici là, gains retirés imposés à ${pct(Math.min(p.tax.tmi, p.tax.avBefore8))}`);
      if (accountWithholds(a, data)) facts.push({ label: "Prélèvements sociaux retenus sur le fonds euros", amount: c.avSocial, hint: `${pct(p.tax.socialAv)} des intérêts, chaque année` });
      else notes.push(`L'assureur ne prélève rien : les prélèvements sociaux du fonds euros (${pct(p.tax.socialAv)} des intérêts) sont à payer à la déclaration.`);
      const ucGain = roundCents(s.positions.reduce((t, x) => t + Math.max(0, x.gain), 0));
      if (s.positions.length) facts.push({ label: "Gains des unités de compte", amount: ucGain, hint: "Prélèvements sociaux dus au retrait" });
      facts.push({ label: "Abattement annuel après 8 ans", amount: allowance, hint: p.profile.couple ? "Couple" : "Personne seule" });
      break;
    }
    case "pea":
    case "pea_pme":
      milestone(60, "5 ans du plan", `Retraits : prélèvements sociaux seulement (${pct(p.tax.socialGeneral)})`, "Un retrait avant cette date clôture le plan et rend le gain imposable");
      facts.push({ label: "Dividendes et coupons reçus dans le plan", amount: roundCents(s.dividends + s.interests), hint: "Sans impôt tant que rien n'est retiré" });
      facts.push({ label: "Plus-values réalisées dans le plan", amount: roundCents(s.realizedGain), hint: "Sans impôt tant que rien n'est retiré" });
      break;
    case "cto": {
      facts.push({ label: "Plus-value latente", amount: roundCents(s.positions.reduce((t, x) => t + x.gain, 0)), hint: "Imposée seulement à la vente" });
      const last = [...c.securitiesYears].reverse().find((y) => y.year <= c.currentYear);
      const carry = roundCents((last?.carryOut ?? []).reduce((t, x) => t + x.amount, 0));
      if (carry > 0) facts.push({ label: "Moins-values encore déductibles", amount: carry, hint: "Tous comptes-titres, pendant 10 ans" });
      if (c.foreign > 0) facts.push({ label: "Retenues à l'étranger", amount: c.foreign, hint: "Crédit d'impôt selon la convention du pays, non compté ici" });
      if (s.positions.length > 0 || c.income > 0)
        notes.push(
          accountWithholds(a, data)
            ? "Coupons et dividendes : l'établissement retient un acompte et les prélèvements sociaux, l'impôt définitif est régularisé à la déclaration. Les plus-values sont réparties entre comptes-titres au prorata."
            : "Coupons et dividendes : l'établissement ne retient rien, l'impôt et les prélèvements sociaux sont à payer à la déclaration. Les plus-values sont réparties entre comptes-titres au prorata.",
        );
      if (c.journalTaxes > 0) facts.push({ label: "Opérations « Impôts » au Journal", amount: c.journalTaxes, hint: "Pour contrôle : les retenues viennent des revenus saisis" });
      break;
    }
    case "crowdlending": {
      const tax = crowdTaxOf(data, a);
      facts.push({ label: "La plateforme prélève les impôts", text: tax.withheld ? `Oui, ${pct(tax.rate)}` : "Non, ils sont à payer à la déclaration" });
      facts.push({ label: "Intérêts bruts reçus depuis le début", amount: c.income });
      if (c.journalTaxes > 0) {
        facts.push({ label: "Opérations « Impôts » au Journal", amount: c.journalTaxes, hint: "Débits des impôts retenus sur les intérêts" });
        if (Math.abs(c.journalTaxes - c.withheldTotal) >= 1)
          // Sans montant dans le texte : le mode discret ne masque que les montants affichés comme tels.
          notes.push("Les opérations « Impôts » du Journal ne correspondent pas aux impôts notés sur les intérêts (colonne « Retenu à la source ») : vérifiez les intérêts saisis.");
      }
      notes.push("Capital remboursé non imposable. Seuls les intérêts sont imposés.");
      break;
    }
    case "crypto": {
      const sales = crypto.sales.filter((x) => x.tx.accountId === a.id);
      facts.push({ label: "Ventes contre des euros", text: String(sales.length) });
      const year = crypto.years.find((y) => y.year === c.currentYear);
      facts.push({ label: `Ventes ${c.currentYear}, toutes plateformes`, amount: year?.grossSales ?? 0, hint: `Exonéré jusqu'à ${formatEur(p.crypto.exemptionThreshold)}` });
      facts.push({ label: "Prix d'acquisition restant, toutes plateformes", amount: crypto.remainingAcquisition });
      notes.push("Rien n'est retenu à la source : la plus-value se déclare sur la 2086. L'impôt de l'année est réparti entre plateformes au prorata de leur plus-value.");
      break;
    }
    case "per": {
      const contrib = Math.max(0, roundCents(s.netContrib));
      facts.push({ label: "Versements nets", amount: contrib });
      facts.push({ label: "Économie d'impôt estimée sur les versements", amount: roundCents(contrib * p.tax.tmi), hint: `S'ils ont été déduits du revenu, à votre tranche (${pct(p.tax.tmi)})` });
      notes.push("À la sortie en capital, les versements déduits sont imposés au barème et les gains au prélèvement forfaitaire.");
      break;
    }
    case "epargne_salariale":
      facts.push({ label: "Gain à ce jour", amount: roundCents(s.gain), hint: `Prélèvements sociaux (${pct(p.tax.socialGeneral)}) dus au retrait` });
      break;
  }
  if (c.journalTaxes > 0 && a.kind !== "crowdlending" && !(WITHHOLDING_COMPUTED.has(a.kind) && accountWithholds(a, data))) facts.push({ label: "Opérations « Impôts » au Journal", amount: c.journalTaxes, hint: "Comptées comme payées" });
  return { facts, notes };
}
