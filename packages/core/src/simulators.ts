import { accruedFraction, remainingFlows, yieldToMaturity, type BondTerms } from "./bonds";
import { addMonths } from "./dates";
import { roundCents } from "./money";
import { annuity } from "./projection";
import { incomeLine, incomeTaxOn, SIM_RULES, SIM_SOURCES, simResult, socialRate, type SimLine, type SimResult, type SimTax } from "./simulation";
import { daysBetween, type Flow } from "./xirr";

/**
 * Les placements simulés. Chacun produit ses flux bruts et nets, et le détail de ses impôts.
 * Les taux saisis sont en pourcentage (3 pour 3 %), comme dans les formulaires.
 */

const pct = (v: number) => v / 100;
const eur = (v: number) => `${roundCents(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const yearOf = (d: string) => +d.slice(0, 4);

// ——— Obligation ———

export interface BondSimInput {
  /** Prix d'achat pied de coupon, en % du nominal. */
  pricePct: number;
  couponPct: number;
  /** Coupons par an. */
  frequency: number;
  maturityDate: string;
  buyDate: string;
  /** Frais d'achat (et de revente), en % du montant… */
  feePct: number;
  /** … et frais fixes par ordre, en euros. */
  feeFixed: number;
  /** Durée de détention en années ; 0 : jusqu'à l'échéance. */
  holdYears: number;
  /** Prix de revente pied de coupon, en % du nominal ; 0 : estimé à rendement de marché inchangé. */
  salePricePct: number;
}

/** Prix « coupon couru compris » qui donne le rendement `y` à cette date (même convention que yieldToMaturity). */
function dirtyPriceAt(terms: BondTerms, date: string, y: number): number {
  return remainingFlows(terms, date).reduce((t, f) => t + f.amount / Math.pow(1 + y, daysBetween(date, f.date) / 365), 0);
}

/** Prix de revente pied de coupon estimé : celui qui garde le rendement de l'achat (taux de marché inchangés). */
export function bondResalePrice(i: Pick<BondSimInput, "pricePct" | "couponPct" | "frequency" | "maturityDate" | "buyDate">, saleDate: string): number | null {
  const terms = { couponRate: pct(i.couponPct), maturityDate: i.maturityDate, frequency: Math.max(1, i.frequency) };
  const y = yieldToMaturity(terms, i.buyDate, pct(i.pricePct) + accruedFraction(terms, i.buyDate));
  if (y == null) return null;
  return dirtyPriceAt(terms, saleDate, y) - accruedFraction(terms, saleDate);
}

/**
 * Obligation achetée sur le marché, en compte-titres. Coupons : intérêts imposés l'année où ils sont reçus.
 * Gardée jusqu'à l'échéance : l'écart entre le prix d'achat et le remboursement est une prime de remboursement,
 * revenu imposé au remboursement (pas une plus-value) ; une perte n'est pas déductible.
 * Revendue avant : le gain est une plus-value de cession, coupon couru encaissé compris dans le prix de vente.
 */
export function simulateBond(i: BondSimInput, amount: number, tax: SimTax): SimResult {
  const terms = { couponRate: pct(i.couponPct), maturityDate: i.maturityDate, frequency: Math.max(1, i.frequency) };
  const price = pct(i.pricePct);
  const accrued = accruedFraction(terms, i.buyDate);
  const nominal = Math.max(0, amount - i.feeFixed) / ((price + accrued) * (1 + pct(i.feePct)));
  const fees = amount - nominal * (price + accrued);
  const flows = remainingFlows(terms, i.buyDate);
  const wanted = i.holdYears > 0 ? addMonths(i.buyDate, Math.round(i.holdYears * 12)) : null;
  // Une durée qui dépasse l'échéance : l'obligation est remboursée avant, on la garde jusque-là.
  const saleDate = wanted != null && wanted < i.maturityDate ? wanted : null;
  const lines: SimLine[] = [
    {
      date: i.buyDate,
      label: `Achat de ${eur(nominal)} de nominal à ${i.pricePct.toLocaleString("fr-FR")} %`,
      gross: -amount,
      taxable: 0,
      incomeTax: 0,
      social: 0,
      net: -amount,
      note: [accrued > 0 ? `dont ${eur(nominal * accrued)} de coupon couru` : null, fees > 0.005 ? `${eur(fees)} de frais` : null].filter(Boolean).join(", ") || undefined,
    },
  ];
  const grossFlows: Flow[] = [{ date: i.buyDate, amount: -amount }];
  const netFlows: Flow[] = [{ date: i.buyDate, amount: -amount }];
  const notes: string[] = [];
  flows.forEach((f, k) => {
    if (saleDate != null && f.date > saleDate) return;
    const last = k === flows.length - 1;
    const coupon = nominal * (f.amount - (last ? 1 : 0));
    if (coupon > 0) {
      // Coupon couru payé à l'achat : pour un particulier, aucun texte ne le déduit du coupon suivant, imposé en entier.
      const line = incomeLine(f.date, k === 0 && accrued > 0 ? "Premier coupon" : "Coupon", coupon, "interets", "placement", tax);
      lines.push({ ...line, note: k === 0 && accrued > 0 ? `imposé en entier, coupon couru payé à l'achat compris (${eur(nominal * accrued)})` : undefined });
      grossFlows.push({ date: f.date, amount: coupon });
      netFlows.push({ date: f.date, amount: line.net });
    }
    if (last && saleDate == null) {
      const prime = nominal * (1 - price);
      if (prime > 0) {
        const line = incomeLine(f.date, "Remboursement au pair", prime, "interets", "placement", tax);
        lines.push({ ...line, gross: nominal, net: nominal - line.incomeTax - line.social, note: `prime de remboursement imposée : ${eur(prime)}` });
        netFlows.push({ date: f.date, amount: nominal - line.incomeTax - line.social });
      } else {
        lines.push({ date: f.date, label: "Remboursement au pair", gross: nominal, taxable: 0, incomeTax: 0, social: 0, net: nominal, note: prime < 0 ? `perte de ${eur(-prime)}, non déductible` : undefined });
        netFlows.push({ date: f.date, amount: nominal });
      }
      grossFlows.push({ date: f.date, amount: nominal });
    }
  });

  if (saleDate != null) {
    const estimated = bondResalePrice(i, saleDate);
    const clean = i.salePricePct > 0 ? pct(i.salePricePct) : (estimated ?? 1);
    const accruedSale = accruedFraction(terms, saleDate);
    const proceeds = nominal * (clean + accruedSale);
    const saleFees = Math.min(proceeds, proceeds * pct(i.feePct) + i.feeFixed);
    const received = proceeds - saleFees;
    // Plus-value : prix de vente net de frais, coupon couru compris, moins le prix d'achat (coupon couru et frais compris).
    const gain = received - amount;
    const label = `Revente à ${(clean * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
    const detail = [accruedSale > 0 ? `coupon couru encaissé ${eur(nominal * accruedSale)}` : null, saleFees > 0.005 ? `${eur(saleFees)} de frais` : null].filter(Boolean).join(", ");
    const line: SimLine =
      gain > 0
        ? { ...incomeLine(saleDate, label, gain, "plusValue", "patrimoine", tax), gross: received }
        : { date: saleDate, label, gross: received, taxable: 0, incomeTax: 0, social: 0, net: received };
    line.net = received - line.incomeTax - line.social;
    line.note = `${gain > 0 ? `plus-value imposée : ${eur(gain)}` : `moins-value de ${eur(-gain)}`}${detail ? ` ; ${detail}` : ""}`;
    lines.push(line);
    grossFlows.push({ date: saleDate, amount: received });
    netFlows.push({ date: saleDate, amount: line.net });
    notes.push(
      "Revendue avant l'échéance : le gain est une plus-value de cession (et non une prime de remboursement), imposée comme les plus-values d'actions. Le coupon couru encaissé fait partie du prix de vente ; le coupon couru et les frais payés à l'achat, du prix d'achat.",
    );
    if (i.salePricePct > 0) notes.push(`Prix de revente saisi : ${i.salePricePct.toLocaleString("fr-FR")} %${estimated != null ? ` (à taux de marché inchangés, il serait d'environ ${(estimated * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %)` : ""}.`);
    else notes.push("Prix de revente estimé à rendement de marché inchangé depuis l'achat. Si les taux montent, il sera plus bas ; s'ils baissent, plus haut : saisissez votre propre prix pour tester.");
    if (gain < 0) notes.push("Moins-value : elle s'impute sur les plus-values de la même année et des 10 suivantes.");
    notes.push("Frais de revente : les mêmes que ceux de l'achat.");
  } else {
    if (wanted != null) notes.push("La durée choisie dépasse l'échéance : l'obligation est remboursée avant, la simulation s'arrête au remboursement.");
    notes.push(
      "Écart entre le prix d'achat et le remboursement au pair : c'est une prime de remboursement, imposée comme des intérêts l'année du remboursement, et non une plus-value. Elle ne peut donc pas absorber de moins-values.",
    );
    notes.push("La prime est calculée sur le prix d'achat pied de coupon, hors frais : c'est l'usage, mais le texte ne précise pas si le coupon couru ou les frais en font partie.");
    if (price > 1) notes.push("Achetée au-dessus du pair : la perte au remboursement n'est pas déductible de l'impôt sur le revenu (une tolérance existe pour les souscripteurs à l'émission, pas pour un achat en bourse).");
  }
  if (accrued > 0) {
    notes.push("Coupon couru payé à l'achat : le coupon suivant est quand même imposé en entier, aucun texte ne permettant à un particulier d'en déduire le coupon couru.");
  }
  const sources = saleDate != null ? [SIM_SOURCES.plusValues, SIM_SOURCES.couru, SIM_SOURCES.pfu, SIM_SOURCES.ps] : [SIM_SOURCES.prime, SIM_SOURCES.couru, SIM_SOURCES.pfu, SIM_SOURCES.ps];
  return simResult({ invested: amount, lines, grossFlows, netFlows, baremeEligible: true, notes, sources });
}

// ——— ETF et actions ———

export type EquityEnvelope = "cto" | "pea" | "av";

export interface EquitySimInput {
  envelope: EquityEnvelope;
  /** Rendement total attendu par an, dividendes compris, avant frais. */
  returnPct: number;
  /** Part versée en dividendes chaque année (0 : ETF capitalisant). */
  dividendPct: number;
  /** Frais annuels sur l'encours (frais de l'ETF, frais de gestion du contrat). */
  feesPct: number;
  /** Frais d'achat ou sur versement, en %, et frais fixes par ordre. */
  entryFeePct: number;
  entryFixed: number;
  /** Frais fixes chaque année : droits de garde, abonnement. */
  annualFixed: number;
  /** Frais de vente, en % et fixes (compte-titres et PEA). */
  salePct: number;
  saleFixed: number;
  years: number;
  /** Ancienneté du PEA ou du contrat le jour de l'achat, en années. */
  envelopeAgeYears: number;
  startDate: string;
}

/**
 * Compte-titres : dividendes imposés chaque année, plus-value à la vente.
 * PEA : rien pendant la détention ; à la sortie, après 5 ans, prélèvements sociaux seuls sur le gain.
 * Assurance-vie en unités de compte : rien pendant la détention ; au rachat, prélèvements sociaux et impôt,
 * avec l'abattement et le taux réduit après 8 ans.
 */
export function simulateEquity(i: EquitySimInput, amount: number, tax: SimTax): SimResult {
  const years = Math.max(1, Math.round(i.years));
  const r = pct(i.returnPct);
  const d = i.envelope === "cto" ? pct(i.dividendPct) : 0;
  const fee = pct(i.feesPct);
  let value = amount * (1 - pct(i.entryFeePct)) - i.entryFixed;
  const entryFees = amount - value;
  const lines: SimLine[] = [{ date: i.startDate, label: i.envelope === "av" ? "Versement" : "Achat", gross: -amount, taxable: 0, incomeTax: 0, social: 0, net: -amount, note: entryFees > 0.005 ? `dont ${eur(entryFees)} de frais` : undefined }];
  const grossFlows: Flow[] = [{ date: i.startDate, amount: -amount }];
  const netFlows: Flow[] = [{ date: i.startDate, amount: -amount }];
  for (let y = 1; y <= years; y++) {
    const date = addMonths(i.startDate, 12 * y);
    // Dans le PEA et le contrat, les dividendes restent placés : seul le compte-titres les verse.
    const dividend = value * d;
    value *= 1 + r - d - fee;
    if (dividend > 0.005) {
      const line = incomeLine(date, "Dividendes", dividend, "dividende", "placement", tax);
      lines.push(line);
      grossFlows.push({ date, amount: dividend });
      netFlows.push({ date, amount: line.net });
    }
    if (i.annualFixed > 0) {
      // Compte-titres : payés à côté, sur le compte espèces ; PEA et contrat : prélevés sur l'enveloppe.
      if (i.envelope === "cto") {
        lines.push({ date, label: "Frais fixes de l'année", gross: -i.annualFixed, taxable: 0, incomeTax: 0, social: 0, net: -i.annualFixed, note: "non déductibles" });
        grossFlows.push({ date, amount: -i.annualFixed });
        netFlows.push({ date, amount: -i.annualFixed });
      } else {
        value -= i.annualFixed;
      }
    }
  }
  // Frais de vente : ils réduisent le prix de cession (compte-titres) ou le retrait (PEA). Pas de vente en assurance-vie.
  const saleFees = i.envelope === "av" ? 0 : Math.min(value, value * pct(i.salePct) + i.saleFixed);
  value -= saleFees;
  const end = addMonths(i.startDate, 12 * years);
  const gain = value - amount;
  grossFlows.push({ date: end, amount: value });
  const ageAtExit = i.envelopeAgeYears + years;
  const notes: string[] = [];
  let exit: SimLine;
  let baremeEligible = true;
  const sources = [SIM_SOURCES.pfu, SIM_SOURCES.ps];
  if (i.envelope === "cto") {
    exit = gain > 0 ? { ...incomeLine(end, "Vente", gain, "plusValue", "patrimoine", tax), gross: value } : { date: end, label: "Vente", gross: value, taxable: 0, incomeTax: 0, social: 0, net: value };
    exit.net = value - exit.incomeTax - exit.social;
    if (gain > 0) exit.note = `plus-value imposée : ${eur(gain)}${saleFees > 0.005 ? `, après ${eur(saleFees)} de frais de vente` : ""}`;
    else notes.push("Moins-value : elle s'impute sur les plus-values de la même année et des 10 suivantes.");
    if (d > 0) notes.push("Dividendes : au barème, abattement de 40 % ; au prélèvement forfaitaire, aucun.");
    sources.push(SIM_SOURCES.plusValues);
  } else if (i.envelope === "pea") {
    const long = ageAtExit >= SIM_RULES.peaYears;
    baremeEligible = !long;
    const ps = Math.max(0, gain) * socialRate("pea", yearOf(end), tax);
    const ir = long ? 0 : incomeTaxOn(gain, "plusValue", tax, true);
    exit = { date: end, label: "Retrait du PEA", gross: value, taxable: Math.max(0, gain), incomeTax: ir, social: ps, net: value - ir - ps, note: `${long ? "après 5 ans : prélèvements sociaux seuls" : "avant 5 ans : impôt et prélèvements sociaux"}${saleFees > 0.005 ? ` ; ${eur(saleFees)} de frais de vente` : ""}` };
    notes.push(long ? "PEA de plus de 5 ans à la sortie : pas d'impôt sur le revenu, seulement les prélèvements sociaux sur le gain (18,6 % à partir de 2026)." : "Retrait avant 5 ans : le gain est imposé comme une plus-value, et le retrait clôt en principe le PEA.");
    sources.push(SIM_SOURCES.pea, SIM_SOURCES.psExceptions);
  } else {
    exit = lifeInsuranceExit(end, value, amount, ageAtExit, tax, "Rachat");
    notes.push(ageAtExit >= SIM_RULES.avYears ? `Contrat de plus de 8 ans au rachat : abattement de ${eur(tax.couple ? tax.params.tax.avAllowanceCouple : tax.params.tax.avAllowanceSingle)} par an sur les gains, puis ${(tax.params.tax.avAfter8 * 100).toLocaleString("fr-FR")} %.` : "Contrat de moins de 8 ans au rachat : gains imposés à 12,8 % (ou au barème).");
    notes.push("Abattement supposé entièrement disponible, et versements sur le contrat sous 150 000 €.");
    sources.push(SIM_SOURCES.av, SIM_SOURCES.avRachat, SIM_SOURCES.psExceptions);
  }
  lines.push(exit);
  netFlows.push({ date: end, amount: exit.net });
  return simResult({ invested: amount, lines, grossFlows, netFlows, baremeEligible, notes, sources });
}

/** Rachat total d'un contrat d'assurance-vie : impôt sur le gain, avec l'abattement après 8 ans ; prélèvements sociaux si `social`. */
function lifeInsuranceExit(date: string, value: number, premiums: number, ageAtExit: number, tax: SimTax, label: string, social = true): SimLine {
  const gain = Math.max(0, value - premiums);
  const ps = social ? gain * socialRate("assuranceVie", yearOf(date), tax) : 0;
  let ir: number;
  if (ageAtExit >= SIM_RULES.avYears) {
    const allowance = tax.couple ? tax.params.tax.avAllowanceCouple : tax.params.tax.avAllowanceSingle;
    const base = Math.max(0, gain - allowance);
    ir = tax.regime === "pfu" ? base * tax.params.tax.avAfter8 : incomeTaxOn(base, "interets", tax, social);
  } else {
    ir = incomeTaxOn(gain, "interets", tax, social);
  }
  return { date, label, gross: value, taxable: gain, incomeTax: ir, social: ps, net: value - ir - ps, note: gain > 0 ? `gains du contrat : ${eur(gain)}` : undefined };
}

// ——— Fonds euros ———

export interface EuroFundSimInput {
  /** Taux servi, net des frais de gestion du contrat. */
  ratePct: number;
  entryFeePct: number;
  years: number;
  contractAgeYears: number;
  startDate: string;
}

/**
 * Fonds euros d'un contrat d'assurance-vie : intérêts crédités chaque fin d'année, prélèvements sociaux
 * retenus au même moment dans le contrat ; impôt sur le revenu au rachat, avec l'abattement après 8 ans.
 */
export function simulateEuroFund(i: EuroFundSimInput, amount: number, tax: SimTax): SimResult {
  const years = Math.max(1, Math.round(i.years));
  const r = pct(i.ratePct);
  let gross = amount * (1 - pct(i.entryFeePct));
  let net = gross;
  const lines: SimLine[] = [{ date: i.startDate, label: "Versement", gross: -amount, taxable: 0, incomeTax: 0, social: 0, net: -amount, note: i.entryFeePct > 0 ? `${eur(amount * pct(i.entryFeePct))} de frais sur versement` : undefined }];
  for (let y = 1; y <= years; y++) {
    const date = addMonths(i.startDate, 12 * y);
    const interest = net * r;
    const ps = interest * socialRate("assuranceVie", yearOf(date), tax);
    lines.push({ date, label: "Intérêts crédités", gross: interest, taxable: interest, incomeTax: 0, social: ps, net: interest - ps, note: "restent dans le contrat", kept: true });
    net += interest - ps;
    gross *= 1 + r;
  }
  const end = addMonths(i.startDate, 12 * years);
  const exit = lifeInsuranceExit(end, net, amount, i.contractAgeYears + years, tax, "Rachat", false);
  exit.note = `${exit.note ?? ""}${exit.note ? " ; " : ""}prélèvements sociaux déjà retenus chaque année`;
  lines.push(exit);
  const notes = [
    "Les prélèvements sociaux sont retenus chaque année sur les intérêts du fonds euros : ils réduisent ce qui reste placé.",
    i.contractAgeYears + years >= SIM_RULES.avYears ? "Contrat de plus de 8 ans au rachat : abattement annuel sur les gains, puis taux réduit." : "Contrat de moins de 8 ans au rachat : gains imposés à 12,8 % (ou au barème).",
    "Abattement supposé entièrement disponible, et versements sur le contrat sous 150 000 €.",
  ];
  return simResult({
    invested: amount,
    lines,
    grossFlows: [{ date: i.startDate, amount: -amount }, { date: end, amount: gross }],
    netFlows: [{ date: i.startDate, amount: -amount }, { date: end, amount: exit.net }],
    baremeEligible: true,
    notes,
    sources: [SIM_SOURCES.av, SIM_SOURCES.avRachat, SIM_SOURCES.psExceptions],
  });
}

// ——— Crowdlending ———

export type Repayment = "in_fine" | "amortissable";

export interface LendingSimInput {
  ratePct: number;
  months: number;
  repayment: Repayment;
  /** Part des sommes prêtées dans des projets qui ne remboursent rien. */
  defaultPct: number;
  startDate: string;
}

/**
 * Prêts via une plateforme : intérêts mensuels imposés l'année où ils sont reçus. Les projets en défaut
 * sont supposés ne rien rembourser ; leur perte, constatée à l'échéance prévue, s'impute sur les intérêts
 * de la même année et des 5 suivantes (seulement pour l'impôt sur le revenu).
 */
export function simulateLending(i: LendingSimInput, amount: number, tax: SimTax, horizonMonths: number | null = null): SimResult {
  const n = Math.max(1, Math.round(i.months));
  // Durée de comparaison plus courte que le prêt : on s'arrête là, le capital restant dû compté au pair.
  const stop = horizonMonths != null && horizonMonths < n ? Math.max(1, Math.round(horizonMonths)) : n;
  const monthly = pct(i.ratePct) / 12;
  const healthy = amount * (1 - pct(i.defaultPct));
  const lost = amount - healthy;
  const lines: SimLine[] = [{ date: i.startDate, label: "Prêt", gross: -amount, taxable: 0, incomeTax: 0, social: 0, net: -amount }];
  const grossFlows: Flow[] = [{ date: i.startDate, amount: -amount }];
  const netFlows: Flow[] = [{ date: i.startDate, amount: -amount }];
  const payment = i.repayment === "amortissable" ? annuity(healthy, monthly, n) : 0;
  let capital = healthy;
  const interestByYear = new Map<number, number>();
  for (let m = 1; m <= stop; m++) {
    const date = addMonths(i.startDate, m);
    const interest = capital * monthly;
    const scheduled = i.repayment === "amortissable" ? payment - interest : m === n ? capital : 0;
    // Au dernier mois compté, le capital restant dû est compté au pair, sans impôt (c'est du capital).
    const principal = m === stop ? capital : scheduled;
    const early = m === stop && stop < n;
    capital -= principal;
    const line = incomeLine(date, m === n ? "Dernière échéance" : early ? "Fin de la durée de comparaison" : "Échéance", interest, "interets", "placement", tax);
    const cash = interest + principal;
    lines.push({ ...line, gross: cash, net: cash - line.incomeTax - line.social, note: early ? `dont ${eur(principal)} de capital restant dû, compté au pair` : principal > 0.005 ? `dont ${eur(principal)} de capital` : undefined });
    grossFlows.push({ date, amount: cash });
    netFlows.push({ date, amount: cash - line.incomeTax - line.social });
    interestByYear.set(yearOf(date), (interestByYear.get(yearOf(date)) ?? 0) + interest);
  }
  const notes = ["Intérêts imposés l'année où ils sont reçus : 12,8 % retenus à la source au prélèvement forfaitaire, et les prélèvements sociaux."];
  if (stop < n) notes.push(`Le prêt dure plus que la durée de comparaison : le capital restant dû à cette date est compté à sa valeur, sans les intérêts à venir.`);
  if (lost > 0.005 && stop < n) notes.push("La perte des projets en défaut n'est constatée qu'à la fin prévue du prêt, après la durée de comparaison : son imputation n'est pas comptée.");
  if (lost > 0.005 && stop === n) {
    const end = addMonths(i.startDate, n);
    // Imputation sur les intérêts de l'année de la perte et des 5 suivantes, dans cette simulation.
    const imputable = [...interestByYear.entries()].filter(([y]) => y >= yearOf(end) && y <= yearOf(end) + SIM_RULES.crowdLossCarryYears).reduce((t, [, v]) => t + v, 0);
    const used = Math.min(lost, imputable, SIM_RULES.crowdLossCap);
    const refund = incomeTaxOn(used, "interets", tax, false);
    lines.push({ date: end, label: "Perte des projets en défaut", gross: 0, taxable: -used, incomeTax: -refund, social: 0, net: refund, note: `${eur(lost)} perdus${refund > 0 ? ` ; ${eur(used)} imputés sur les intérêts` : ""}` });
    if (refund > 0) netFlows.push({ date: end, amount: refund });
    notes.push(
      "Les pertes de prêts et de minibons s'imputent sur les intérêts de prêts de la même année et des 5 suivantes, dans la limite de 8 000 € par an. Ici, seuls les intérêts de cette simulation les absorbent : avec d'autres prêts en cours, la perte s'imputerait davantage. Seul l'impôt sur le revenu est compté ici : les prélèvements sociaux déjà payés ne sont pas repris.",
    );
    notes.push("Obligations émises par une plateforme (et non des prêts) : la perte est une moins-value, imputable sur les plus-values pendant 10 ans, pas sur les intérêts.");
  }
  return simResult({ invested: amount, lines, grossFlows, netFlows, baremeEligible: true, notes, sources: [SIM_SOURCES.crowd, SIM_SOURCES.pfu, SIM_SOURCES.ps] });
}

// ——— Livret et compte à terme ———

export type SavingsKind = "reglemente" | "fiscalise";

export interface SavingsSimInput {
  kind: SavingsKind;
  ratePct: number;
  years: number;
  startDate: string;
}

/**
 * Livret A, LDDS, LEP : intérêts exonérés d'impôt et de prélèvements sociaux.
 * Livret bancaire ou compte à terme : intérêts imposés chaque année, retenus à la source.
 */
export function simulateSavings(i: SavingsSimInput, amount: number, tax: SimTax): SimResult {
  const years = Math.max(1, Math.round(i.years));
  const r = pct(i.ratePct);
  let gross = amount;
  let net = amount;
  const lines: SimLine[] = [{ date: i.startDate, label: "Dépôt", gross: -amount, taxable: 0, incomeTax: 0, social: 0, net: -amount }];
  for (let y = 1; y <= years; y++) {
    const date = addMonths(i.startDate, 12 * y);
    const interest = net * r;
    const line = i.kind === "reglemente" ? { ...incomeLine(date, "Intérêts", interest, "interets", "exonere", tax), incomeTax: 0, social: 0, net: interest, taxable: 0 } : incomeLine(date, "Intérêts", interest, "interets", "placement", tax);
    lines.push({ ...line, note: "restent sur le compte", kept: true });
    net += line.net;
    gross *= 1 + r;
  }
  const end = addMonths(i.startDate, 12 * years);
  lines.push({ date: end, label: "Retrait", gross: net, taxable: 0, incomeTax: 0, social: 0, net });
  return simResult({
    invested: amount,
    lines,
    grossFlows: [{ date: i.startDate, amount: -amount }, { date: end, amount: gross }],
    netFlows: [{ date: i.startDate, amount: -amount }, { date: end, amount: net }],
    baremeEligible: i.kind === "fiscalise",
    notes: i.kind === "reglemente" ? ["Livret A, LDDS et LEP : intérêts exonérés d'impôt et de prélèvements sociaux, dans la limite du plafond du livret."] : ["Intérêts imposés chaque année : 12,8 % retenus à la source au prélèvement forfaitaire, et les prélèvements sociaux."],
    sources: i.kind === "reglemente" ? [SIM_SOURCES.livrets] : [SIM_SOURCES.pfu, SIM_SOURCES.ps],
  });
}

// ——— Le plus avantageux ———

export interface SimComparison {
  pfu: SimResult;
  bareme: SimResult | null;
  best: SimResult;
  bestRegime: "pfu" | "bareme";
}

/** Calcule au prélèvement forfaitaire et, si des revenus peuvent y aller, au barème ; garde le meilleur net. */
export function bestRegime(run: (tax: SimTax) => SimResult, tax: Omit<SimTax, "regime">): SimComparison {
  const pfu = run({ ...tax, regime: "pfu" });
  const bareme = pfu.baremeEligible ? run({ ...tax, regime: "bareme" }) : null;
  const useBareme = bareme != null && bareme.netGain > pfu.netGain + 0.005;
  return { pfu, bareme, best: useBareme ? bareme : pfu, bestRegime: useBareme ? "bareme" : "pfu" };
}
