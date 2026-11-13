import { addMonths, roundCents } from "../base";
import { crowdTaxOf, incomeTaxRate, isRetirementPlan, retirementYear, type CrowdTax, type PlanParams } from "../model";
import { securitiesGains, type AccountState, type Disposal, type EngineData, type PortfolioState } from "../portfolio";
import { socialRateFor } from "./fiscalRules";
import type { CryptoTaxReport } from "./cryptoTax";
import { crowdDueAtDeclaration, resolveIncome, securityDisposals } from "./taxReport";

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
    return { ...base, ...taxFor(s, p, ir, state.asOf, crypto, year, cryptoTotal, crowdTaxOf(data, s.account, year)) };
  });
}

function taxFor(s: AccountState, p: PlanParams, ir: number, asOf: string, crypto: CryptoTaxReport, year: number, cryptoTotal: number, crowd: CrowdTax): { tax: number; regime: string } {
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
      return {
        tax: 0,
        regime: `${crowd.withheld ? (crowd.incomeTax > 0 ? `Impôts déjà prélevés par la plateforme (${pct(crowd.rate)})` : `Prélèvements sociaux retenus par la plateforme (${pct(crowd.rate)}), impôt sur le revenu à la déclaration (dispense d'acompte)`) : "Intérêts à déclarer chaque année"} ; capital non imposable, pertes non déduites`,
      };
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
    // Plateforme qui prélève : retenues déjà payées, puis régularisation de l'impôt à la déclaration (`crowdDueAtDeclaration`).
    let crowdReceived = 0;
    let crowdWithheld = 0;
    let crowdDue = 0;
    for (const t of inYear.filter((x) => x.type === "interets" && kind.get(x.accountId) === "crowdlending")) {
      const r = resolveIncome(t, accounts.get(t.accountId)!, data);
      crowdReceived += r.gross - r.incomeTax - r.social - r.foreign;
      crowdWithheld += r.incomeTax + r.social + r.foreign;
      crowdDue += crowdDueAtDeclaration(r, ir, socialDue);
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

