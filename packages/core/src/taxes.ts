import { addMonths } from "./dates";
import type { Asset, Transaction } from "./domain";
import type { AccountState, Disposal, EngineData, PortfolioState } from "./engine";
import { socialRateFor } from "./fiscalRules";
import { roundCents } from "./money";
import { crowdTaxOf } from "./institutions";
import { incomeTaxRate, isRetirementPlan, retirementYear, type PlanParams } from "./params";
import { PriceBook } from "./prices";
import { securitiesGains } from "./securitiesGains";
import { resolveIncome, securityDisposals } from "./taxReport";

// ——— Crypto : article 150 VH bis du CGI ———

export interface CryptoSale {
  tx: Transaction;
  date: string;
  /** Prix de cession brut (avant frais). */
  gross: number;
  net: number;
  fee: number;
  /** Valeur globale du portefeuille crypto au moment de la cession. */
  portfolioValue: number;
  /** Prix total d'acquisition avant la cession. */
  acquisitionBefore: number;
  /** Fraction du prix d'acquisition imputée à cette cession. */
  attributed: number;
  gain: number;
  year: number;
  /** Un autre actif a été valorisé sans cours récent : la valeur globale est approximative. */
  estimatedValue: boolean;
}

export interface CryptoYear {
  year: number;
  grossSales: number;
  netGain: number;
  exempt: boolean;
  incomeTax: number;
  social: number;
  total: number;
}

export interface CryptoTaxReport {
  sales: CryptoSale[];
  years: CryptoYear[];
  /** Prix total d'acquisition restant (portefeuille global). */
  remainingAcquisition: number;
}

/**
 * Plus-value de chaque cession : PV = prix de cession net − PTA × prix de cession brut / valeur globale du portefeuille.
 * Le portefeuille est global (toutes plateformes). Seules les ventes contre des euros sont imposables.
 */
export function cryptoTax(data: EngineData, asOf: string): CryptoTaxReport {
  const { params } = data;
  const cryptoAccounts = new Set(data.accounts.filter((a) => a.kind === "crypto").map((a) => a.id));
  const assets = new Map<string, Asset>(data.assets.map((a) => [a.id, a]));
  const book = new PriceBook(data.prices, data.assets);
  const txs = data.transactions
    .filter((t) => t.date <= asOf && cryptoAccounts.has(t.accountId) && t.assetId && assets.get(t.assetId)?.kind === "crypto" && (t.type === "achat" || t.type === "vente"))
    .sort((a, b) => (a.date === b.date ? (a.type === "achat" ? -1 : 1) : a.date.localeCompare(b.date)));

  const qty = new Map<string, number>();
  const costPerUnit = new Map<string, { qty: number; cost: number }>();
  let pta = 0;
  const sales: CryptoSale[] = [];

  for (const t of txs) {
    const id = t.assetId!;
    const q = t.quantity ?? 0;
    if (t.type === "achat") {
      pta += t.amount;
      qty.set(id, (qty.get(id) ?? 0) + q);
      const c = costPerUnit.get(id) ?? { qty: 0, cost: 0 };
      costPerUnit.set(id, { qty: c.qty + q, cost: c.cost + t.amount });
      continue;
    }
    const fee = t.fee ?? 0;
    const gross = t.amount + fee;
    const unit = q > 0 ? gross / q : 0;
    // Valeur globale : le titre vendu au prix de la cession, les autres au dernier cours connu (sinon au coût).
    let V = 0;
    let estimatedValue = false;
    for (const [aid, held] of qty) {
      if (held <= 0) continue;
      if (aid === id) V += held * unit;
      else {
        const p = book.at(aid, t.date);
        const c = costPerUnit.get(aid);
        if (!p || Date.parse(t.date) - Date.parse(p.date) > 7 * 86_400_000) estimatedValue = true;
        V += held * (p?.price ?? (c && c.qty > 0 ? c.cost / c.qty : 0));
      }
    }
    const attributed = V > 0 ? (pta * gross) / V : 0;
    const gain = t.amount - attributed;
    sales.push({ tx: t, date: t.date, gross: roundCents(gross), net: t.amount, fee, portfolioValue: roundCents(V), acquisitionBefore: roundCents(pta), attributed: roundCents(attributed), gain: roundCents(gain), year: +t.date.slice(0, 4), estimatedValue });
    pta = Math.max(0, pta - attributed);
    qty.set(id, Math.max(0, (qty.get(id) ?? 0) - q));
  }

  const ir = incomeTaxRate(params);
  const yearsSet = [...new Set(sales.map((s) => s.year))].sort((a, b) => a - b);
  const years: CryptoYear[] = yearsSet.map((year) => {
    const ys = sales.filter((s) => s.year === year);
    const grossSales = roundCents(ys.reduce((s, x) => s + x.gross, 0));
    const netGain = roundCents(ys.reduce((s, x) => s + x.gain, 0));
    const exempt = grossSales <= params.crypto.exemptionThreshold;
    const base = exempt ? 0 : Math.max(0, netGain);
    const incomeTax = roundCents(base * ir);
    const social = roundCents(base * socialRateFor(year, "patrimoine", params));
    return { year, grossSales, netGain, exempt, incomeTax, social, total: roundCents(incomeTax + social) };
  });
  return { sales, years, remainingAcquisition: roundCents(pta) };
}

// ——— Si tout était retiré aujourd'hui ———

export interface WithdrawalTaxRow {
  accountId: string;
  label: string;
  value: number;
  gain: number;
  tax: number;
  regime: string;
}

const pct = (r: number) => `${(Math.round(r * 1000) / 10).toString().replace(".", ",")} %`;

export function withdrawalTaxes(data: EngineData, state: PortfolioState, crypto: CryptoTaxReport): WithdrawalTaxRow[] {
  const p = data.params;
  const ir = incomeTaxRate(p);
  const year = +state.asOf.slice(0, 4);
  const shown = state.accounts.filter((s) => !s.account.archived || s.value !== 0);
  // La plus-value crypto se calcule sur le portefeuille global, toutes plateformes confondues.
  const cryptoTotal = shown.filter((s) => s.account.kind === "crypto").reduce((t, s) => t + s.positionsValue, 0);
  return shown.map((s) => {
    const base = { accountId: s.account.id, label: s.account.name, value: s.value, gain: s.gain };
    return { ...base, ...taxFor(s, p, ir, state.asOf, crypto, year, cryptoTotal, crowdTaxOf(data, s.account)) };
  });
}

function taxFor(s: AccountState, p: PlanParams, ir: number, asOf: string, crypto: CryptoTaxReport, year: number, cryptoTotal: number, crowd: { withheld: boolean; rate: number }): { tax: number; regime: string } {
  const gain = s.gain;
  switch (s.account.kind) {
    case "livret":
      return { tax: 0, regime: "Exonéré (livret réglementé)" };
    case "assurance_vie": {
      if (gain <= 0) return { tax: 0, regime: "Pas de gain" };
      const eightYears = s.account.openedOn ? addMonths(s.account.openedOn, 96) <= asOf : false;
      // Prélèvements sociaux : déjà retenus chaque année sur le fonds euros, dus au retrait sur les unités de compte.
      const ucGain = s.positions.reduce((t, x) => t + Math.max(0, x.gain), 0);
      const ps = ucGain * p.tax.socialAv;
      if (eightYears) {
        const allowance = p.profile.couple ? p.tax.avAllowanceCouple : p.tax.avAllowanceSingle;
        const rate = Math.min(p.tax.tmi, p.tax.avAfter8);
        return { tax: roundCents(Math.max(0, gain - allowance) * rate + ps), regime: `Plus de 8 ans : impôt de ${pct(rate)} au-delà de l'abattement de ${allowance.toLocaleString("fr-FR")} €` };
      }
      const rate = Math.min(p.tax.tmi, p.tax.avBefore8);
      return {
        tax: roundCents(gain * rate + ps),
        regime: s.account.openedOn ? `Moins de 8 ans : impôt de ${pct(rate)} sur le gain` : "Date d'ouverture non renseignée : traité comme moins de 8 ans",
      };
    }
    case "pea":
    case "pea_pme": {
      if (gain <= 0) return { tax: 0, regime: "Pas de gain" };
      const fiveYears = s.account.openedOn ? addMonths(s.account.openedOn, 60) <= asOf : false;
      if (fiveYears) return { tax: roundCents(gain * p.tax.socialGeneral), regime: `Plus de 5 ans : prélèvements sociaux seulement (${pct(p.tax.socialGeneral)})` };
      return {
        tax: roundCents(gain * (p.tax.socialGeneral + p.tax.peaBefore5)),
        regime: s.account.openedOn ? "Moins de 5 ans : prélèvements sociaux + impôt, et clôture du plan" : "Date d'ouverture non renseignée : traité comme moins de 5 ans",
      };
    }
    case "cto": {
      // Coupons et dividendes déjà imposés chaque année : reste la plus-value latente (dont prime de remboursement).
      const latent = s.positions.reduce((t, x) => t + x.gain, 0);
      if (latent <= 0) return { tax: 0, regime: "Pas de plus-value latente" };
      return { tax: roundCents(latent * (p.tax.socialGeneral + ir)), regime: `Plus-value latente × (${pct(p.tax.socialGeneral)} + ${pct(ir)})` };
    }
    case "per": {
      // Sortie en capital, versements supposés déduits à l'entrée : capital au barème, gains au prélèvement forfaitaire.
      const capital = Math.max(0, Math.min(s.value, s.netContrib));
      const gainTax = Math.max(0, gain) * (p.tax.pfuIncomeTax + p.tax.socialGeneral);
      return { tax: roundCents(capital * p.tax.tmi + gainTax), regime: `Sortie en capital, versements déduits : capital à ${pct(p.tax.tmi)}, gains à ${pct(p.tax.pfuIncomeTax + p.tax.socialGeneral)}` };
    }
    case "crowdlending":
      return { tax: 0, regime: `${crowd.withheld ? `Impôts déjà prélevés par la plateforme (${pct(crowd.rate)})` : "Intérêts à déclarer chaque année"} ; capital non imposable, pertes non déduites` };
    case "epargne_salariale": {
      if (gain <= 0) return { tax: 0, regime: "Pas de gain" };
      return { tax: roundCents(gain * p.tax.socialGeneral), regime: `Prélèvements sociaux seulement (${pct(p.tax.socialGeneral)})` };
    }
    case "crypto": {
      // Le prix d'acquisition restant est global : chaque compte porte sa part de la plus-value latente.
      const latent = cryptoTotal > 0 ? (cryptoTotal - crypto.remainingAcquisition) * (s.positionsValue / cryptoTotal) : 0;
      const salesThisYear = crypto.years.find((y) => y.year === year)?.grossSales ?? 0;
      if (latent <= 0) return { tax: 0, regime: "Pas de plus-value latente" };
      if (cryptoTotal + salesThisYear <= p.crypto.exemptionThreshold) return { tax: 0, regime: `Ventes de l'année sous ${p.crypto.exemptionThreshold} € : exonéré` };
      return { tax: roundCents(latent * (ir + p.tax.socialGeneral)), regime: `Impôt ${pct(ir)} + prélèvements sociaux ${pct(p.tax.socialGeneral)} sur la plus-value (formulaire 2086)` };
    }
  }
}

// ——— Rendements nets comparés ———

export interface NetYieldRow {
  label: string;
  gross: number | null;
  taxation: string;
  net: number | null;
}

export function netYields(p: PlanParams, asOf: string, livretRates: { lep: number | null; ldds: number | null }): NetYieldRow[] {
  const ir = incomeTaxRate(p);
  const ps = p.tax.socialGeneral;
  // Durée de détention : jusqu'au départ en retraite, ou 10 ans en gestion de patrimoine.
  const years = isRetirementPlan(p) ? Math.max(5, retirementYear(p) - +asOf.slice(0, 4)) : 10;
  const pea = Math.pow(1 + (Math.pow(1 + p.returns.actions, years) - 1) * (1 - ps), 1 / years) - 1;
  return [
    { label: "LEP", gross: livretRates.lep, taxation: "Exonéré", net: livretRates.lep },
    { label: "LDDS / Livret A", gross: livretRates.ldds, taxation: "Exonéré", net: livretRates.ldds },
    { label: "Fonds euros", gross: p.returns.fondsEuros, taxation: `Prélèvements sociaux ${pct(p.tax.socialAv)} chaque année (impôt en général couvert par l'abattement après 8 ans)`, net: p.returns.fondsEuros * (1 - p.tax.socialAv) },
    { label: "Obligations gardées jusqu'à l'échéance", gross: p.returns.obligations, taxation: `Prélèvements sociaux ${pct(ps)} + impôt ${pct(ir)} chaque année`, net: p.returns.obligations * (1 - ps - ir) },
    { label: "ETF en PEA (après 5 ans)", gross: p.returns.actions, taxation: `Prélèvements sociaux ${pct(ps)} sur les gains, au retrait (ramené en taux annuel sur ${years} ans)`, net: pea },
    { label: "Crypto (vente contre des euros)", gross: null, taxation: `Impôt ${pct(ir)} + prélèvements sociaux ${pct(ps)} sur la plus-value (rien si les ventes de l'année ne dépassent pas ${p.crypto.exemptionThreshold} €)`, net: null },
  ];
}

// ——— Impôts de chaque année ———

export interface YearTaxRow {
  year: number;
  avInterestNet: number;
  avSocial: number;
  couponsNet: number;
  couponsGross: number;
  couponsSocial: number;
  withholding: number;
  couponsIncomeTax: number;
  regularisation: number;
  cryptoIncomeTax: number;
  cryptoSocial: number;
  /** Plus-value de valeurs mobilières restant imposable (compte-titres), et ses impôts. */
  securitiesGain: number;
  securitiesIncomeTax: number;
  securitiesSocial: number;
  /** Crowdlending : intérêts crédités, impôts déjà prélevés par les plateformes, impôts restant à payer. */
  crowdReceived: number;
  crowdWithheld: number;
  crowdDue: number;
  total: number;
}

/**
 * Intérêts saisis nets (tels que crédités) : on retrouve le brut et les prélèvements.
 * Fonds euros : PS retenus par l'assureur. Coupons et dividendes du compte-titres : brut et retenues
 * selon `resolveIncome`, puis impôt définitif et régularisation. Plus-values : celles du récapitulatif fiscal.
 */
export function yearlyTaxes(data: EngineData, crypto: CryptoTaxReport, asOf: string, disposals: readonly Disposal[]): YearTaxRow[] {
  const p = data.params;
  const ir = incomeTaxRate(p);
  const kind = new Map(data.accounts.map((a) => [a.id, a.kind]));
  const accounts = new Map(data.accounts.map((a) => [a.id, a]));
  const firstYear = Math.min(+p.profile.startMonth.slice(0, 4), ...data.transactions.map((t) => +t.date.slice(0, 4)));
  const lastYear = +asOf.slice(0, 4);
  const gainsByYear = new Map(securitiesGains(securityDisposals(disposals, data.assets), data.accounts, lastYear).map((r) => [r.year, r]));
  const rows: YearTaxRow[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    const inYear = data.transactions.filter((t) => t.date.startsWith(`${year}-`) && t.date <= asOf);
    const avInterestNet = inYear.filter((t) => t.type === "interets" && kind.get(t.accountId) === "assurance_vie").reduce((s, t) => s + t.amount, 0);
    const coupons = inYear.filter((t) => (t.type === "interets" || t.type === "dividende") && kind.get(t.accountId) === "cto");
    const couponsNet = coupons.reduce((s, t) => s + t.amount, 0);
    const socialDue = socialRateFor(year, "patrimoine", p);
    // Plateforme qui prélève : impôts déjà payés (intérêts saisis nets, ou bruts avec les impôts débités à part). Sinon, le brut reste à imposer.
    let crowdReceived = 0;
    let crowdWithheld = 0;
    let crowdDue = 0;
    for (const t of inYear.filter((x) => x.type === "interets" && kind.get(x.accountId) === "crowdlending")) {
      const r = resolveIncome(t, accounts.get(t.accountId)!, data);
      const withheld = r.incomeTax + r.social + r.foreign;
      crowdReceived += r.gross - withheld;
      if (withheld > 0) crowdWithheld += withheld;
      else crowdDue += r.gross * (ir + socialDue);
    }
    const avSocial = (avInterestNet * p.tax.socialAv) / (1 - p.tax.socialAv);
    let couponsGross = 0;
    let couponsSocial = 0;
    let withholding = 0;
    for (const t of coupons) {
      const r = resolveIncome(t, accounts.get(t.accountId)!, data);
      couponsGross += r.gross;
      couponsSocial += r.social > 0 ? r.social : r.gross * socialDue;
      withholding += r.incomeTax;
    }
    const couponsIncomeTax = couponsGross * ir;
    const securitiesGain = gainsByYear.get(year)?.taxableGain ?? 0;
    const securitiesIncomeTax = roundCents(securitiesGain * ir);
    const securitiesSocial = roundCents(securitiesGain * socialDue);
    const cy = crypto.years.find((y) => y.year === year);
    const row: YearTaxRow = {
      year,
      avInterestNet: roundCents(avInterestNet),
      avSocial: roundCents(avSocial),
      couponsNet: roundCents(couponsNet),
      couponsGross: roundCents(couponsGross),
      couponsSocial: roundCents(couponsSocial),
      withholding: roundCents(withholding),
      couponsIncomeTax: roundCents(couponsIncomeTax),
      regularisation: roundCents(couponsIncomeTax - withholding),
      cryptoIncomeTax: cy?.incomeTax ?? 0,
      cryptoSocial: cy?.social ?? 0,
      securitiesGain,
      securitiesIncomeTax,
      securitiesSocial,
      crowdReceived: roundCents(crowdReceived),
      crowdWithheld: roundCents(crowdWithheld),
      crowdDue: roundCents(crowdDue),
      total: 0,
    };
    row.total = roundCents(row.avSocial + row.couponsSocial + row.couponsIncomeTax + row.cryptoIncomeTax + row.cryptoSocial + row.securitiesIncomeTax + row.securitiesSocial + row.crowdWithheld + row.crowdDue);
    rows.push(row);
  }
  return rows;
}
