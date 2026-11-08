import type { EngineData, PortfolioState } from "./engine";
import { roundCents } from "./money";
import { ageInYear, etfTarget, retirementYear, type PlanParams } from "./params";
import { Schedule } from "./schedule";
import { orderFee } from "./institutions";

/**
 * Projection annuelle simplifiée (onglet « Projection » du sheet), avant impôts, hors crypto.
 * Améliorations : versements tirés du calendrier complet (changements futurs compris),
 * plancher des livrets respecté (une dépense trop forte puise dans le fonds euros),
 * phase de retraits jusqu'à l'âge horizon, et fourchette de résultats (Monte-Carlo).
 */

export interface Flows {
  livrets: number;
  fondsEuros: number;
  obligations: number;
  actions: number;
}

export interface ProjectionInput {
  params: PlanParams;
  startYear: number;
  start: Flows;
  /** Versé net de départ (hors crypto). */
  startContributed: number;
  /** Versements annuels prévus par classe d'actifs pour une année donnée. */
  contributions: (year: number) => Flows;
  /** Dépenses prévues payées par les livrets. */
  expenses: (year: number) => number;
  /** Frais payés sur les versements de l'année (déjà retirés de `contributions`). */
  contributionFees?: (year: number) => number;
  /** Frais annuels proportionnels à l'encours, retranchés du rendement de chaque classe d'actifs. */
  feeDrag?: Partial<Returns>;
}

export interface ProjectionRow {
  year: number;
  age: number;
  active: boolean;
  etfTarget: number;
  expense: number;
  livrets: number;
  excessToFe: number;
  obligations: number;
  actions: number;
  fondsEuros: number;
  invested: number;
  total: number;
  /** En euros d'aujourd'hui. */
  real: number;
  contributed: number;
  gains: number;
  belowFloor: boolean;
  /** Frais cumulés depuis l'année de départ de la projection. */
  fees: number;
}

export interface RetirementIncome {
  /** Capital investi au départ, en euros d'aujourd'hui. */
  investedToday: number;
  monthlyToday: number;
  monthlyNominal: number;
  years: number;
}

export interface DrawdownRow {
  year: number;
  age: number;
  capital: number;
  withdrawn: number;
}

export interface Projection {
  rows: ProjectionRow[];
  atRetirement: ProjectionRow;
  income: RetirementIncome;
  drawdown: DrawdownRow[];
}

/** Mensualité constante qui épuise `pv` en `n` mois au taux mensuel `r` (PMT). */
export function annuity(pv: number, r: number, n: number): number {
  if (n <= 0) return 0;
  if (Math.abs(r) < 1e-12) return pv / n;
  return (pv * r) / (1 - Math.pow(1 + r, -n));
}

export interface Returns {
  livrets: number;
  fondsEuros: number;
  obligations: number;
  actions: number;
}

export function project(input: ProjectionInput, returnsFor: (year: number) => Returns = () => input.params.returns, opts: { drawdown?: boolean } = {}): Projection {
  const p = input.params;
  const retYear = retirementYear(p);
  const { securisationAge, retirementAge } = p.profile;
  const first: ProjectionRow = {
    year: input.startYear,
    age: ageInYear(p, input.startYear),
    active: true,
    etfTarget: etfTarget(p, ageInYear(p, input.startYear)),
    expense: 0,
    livrets: input.start.livrets,
    excessToFe: 0,
    obligations: input.start.obligations,
    actions: input.start.actions,
    fondsEuros: input.start.fondsEuros,
    invested: input.start.obligations + input.start.actions + input.start.fondsEuros,
    total: 0,
    real: 0,
    contributed: input.startContributed,
    gains: 0,
    belowFloor: input.start.livrets < p.livrets.floor,
    fees: 0,
  };
  first.total = first.livrets + first.invested;
  first.real = first.total;
  first.gains = first.total - first.contributed;
  const rows: ProjectionRow[] = [first];
  let expensesSum = 0;

  for (let year = input.startYear + 1; year <= Math.max(retYear, input.startYear); year++) {
    const prev = rows[rows.length - 1];
    const raw = returnsFor(year);
    const drag = input.feeDrag ?? {};
    const r = {
      livrets: raw.livrets - (drag.livrets ?? 0),
      fondsEuros: raw.fondsEuros - (drag.fondsEuros ?? 0),
      obligations: raw.obligations - (drag.obligations ?? 0),
      actions: raw.actions - (drag.actions ?? 0),
    };
    const age = ageInYear(p, year);
    const active = age <= retirementAge;
    const target = etfTarget(p, age);
    const c = active ? input.contributions(year) : { livrets: 0, fondsEuros: 0, obligations: 0, actions: 0 };
    const expense = input.expenses(year);
    expensesSum += expense;
    const secured = age >= securisationAge;

    let livrets = prev.livrets * (1 + r.livrets) + c.livrets - expense;
    const excess = Math.max(0, livrets - p.livrets.ceiling);
    livrets -= excess;
    let fePre = prev.fondsEuros * (1 + r.fondsEuros) + c.fondsEuros + (secured ? c.actions : 0) + excess;
    // Plancher : si une dépense fait passer les livrets sous le plancher, on complète depuis le fonds euros.
    let belowFloor = false;
    if (livrets < p.livrets.floor) {
      const need = p.livrets.floor - livrets;
      const take = Math.min(need, Math.max(0, fePre));
      livrets += take;
      fePre -= take;
      belowFloor = livrets < p.livrets.floor - 0.5;
    }
    const obligations = prev.obligations * (1 + r.obligations) + c.obligations;
    const etfPre = prev.actions * (1 + r.actions) + (secured ? 0 : c.actions);
    const actions = secured ? Math.min(etfPre, target * (obligations + etfPre + fePre)) : etfPre;
    const fondsEuros = etfPre + fePre - actions;
    const invested = obligations + actions + fondsEuros;
    const total = livrets + invested;
    const entryFees = active ? (input.contributionFees?.(year) ?? 0) : 0;
    const dragFees =
      prev.livrets * (drag.livrets ?? 0) + prev.fondsEuros * (drag.fondsEuros ?? 0) + prev.obligations * (drag.obligations ?? 0) + prev.actions * (drag.actions ?? 0);
    const contributed = prev.contributed + (active ? c.livrets + c.fondsEuros + c.obligations + c.actions + entryFees : 0);
    rows.push({
      year,
      age,
      active,
      etfTarget: target,
      expense,
      livrets,
      excessToFe: excess,
      obligations,
      actions,
      fondsEuros,
      invested,
      total,
      real: total / Math.pow(1 + p.returns.inflation, year - input.startYear),
      contributed,
      gains: total - contributed + expensesSum,
      belowFloor,
      fees: prev.fees + entryFees + dragFees,
    });
  }

  const atRetirement = rows.find((r) => r.year === retYear) ?? rows[rows.length - 1];
  const yearsToGo = Math.max(0, retYear - input.startYear);
  const investedToday = atRetirement.invested / Math.pow(1 + p.returns.inflation, yearsToGo);
  const months = (p.profile.horizonAge - p.profile.retirementAge) * 12;
  const monthlyReal = Math.pow(1 + p.returns.realReturnRetirement, 1 / 12) - 1;
  const monthlyToday = annuity(investedToday, monthlyReal, months);
  const monthlyNominal = monthlyToday * Math.pow(1 + p.returns.inflation, yearsToGo);

  // Phase de retraits, au mois le mois : revenu revalorisé de l'inflation, capital rémunéré à réel + inflation.
  const drawdown: DrawdownRow[] = [];
  let capital = atRetirement.invested;
  const monthlyNominalRate = Math.pow((1 + p.returns.realReturnRetirement) * (1 + p.returns.inflation), 1 / 12) - 1;
  const monthlyInflation = Math.pow(1 + p.returns.inflation, 1 / 12) - 1;
  // La fourchette n'a pas besoin de la phase de retraits (calcul mois par mois).
  for (let y = 0; opts.drawdown !== false && y < p.profile.horizonAge - p.profile.retirementAge; y++) {
    let withdrawn = 0;
    for (let m = 0; m < 12; m++) {
      const payment = monthlyNominal * Math.pow(1 + monthlyInflation, y * 12 + m + 1);
      capital = capital * (1 + monthlyNominalRate) - payment;
      withdrawn += payment;
    }
    drawdown.push({ year: retYear + y + 1, age: p.profile.retirementAge + y + 1, capital: Math.max(0, capital), withdrawn });
  }

  return {
    rows,
    atRetirement,
    income: { investedToday: roundCents(investedToday), monthlyToday: roundCents(monthlyToday), monthlyNominal: roundCents(monthlyNominal), years: p.profile.horizonAge - p.profile.retirementAge },
    drawdown,
  };
}

// ——— Construction depuis l'état réel ———

export interface ProjectionOverrides {
  /** Versement mensuel supplémentaire par classe d'actifs (simulation « et si »). */
  extraMonthly?: Partial<Flows>;
  params?: PlanParams;
}

/** Données d'entrée de la projection à partir du patrimoine actuel et du calendrier des versements. */
export function projectionInputFromState(data: EngineData, state: PortfolioState, overrides: ProjectionOverrides = {}): ProjectionInput {
  const params = overrides.params ?? data.params;
  const schedule = new Schedule(data.plans, data.skips, params.profile.startMonth, params.profile.contributionDay);
  const kinds = new Map(data.accounts.map((a) => [a.id, a.kind]));
  const extra = overrides.extraMonthly ?? {};
  const startYear = +state.asOf.slice(0, 4);
  const institutions = new Map((data.institutions ?? []).map((i) => [i.id, i]));
  const accountById = new Map(data.accounts.map((a) => [a.id, a]));
  /**
   * Frais sur les versements d'une année : frais sur versements de l'assurance-vie, courtage des achats
   * (un ordre par mois en PEA, un ordre par an en compte-titres pour une obligation) et droits de garde fixes.
   */
  const feesOnContributions = (accountId: string, amount: number): number => {
    const a = accountById.get(accountId);
    const inst = a?.institutionId ? institutions.get(a.institutionId) : undefined;
    if (!a || !inst || amount <= 0) return 0;
    if (a.kind === "assurance_vie") return amount * (inst.offers.assurance_vie?.entryFee ?? 0);
    if (a.kind === "pea" || a.kind === "pea_pme" || a.kind === "cto") {
      const offer = inst.offers[a.kind === "cto" ? "cto" : "pea"];
      if (!offer) return 0;
      const courtage = a.kind !== "cto" ? 12 * orderFee(offer.orderFees, amount / 12) : orderFee(offer.orderFees, amount);
      return courtage + offer.custodyFixed;
    }
    return 0;
  };
  const contributionFees = (year: number) => data.accounts.reduce((s, a) => s + feesOnContributions(a.id, schedule.inYear(a.id, year)), 0);
  const contributions = (year: number): Flows => {
    const f: Flows = { livrets: 0, fondsEuros: 0, obligations: 0, actions: 0 };
    for (const a of data.accounts) {
      const gross = schedule.inYear(a.id, year);
      if (!gross) continue;
      const amount = gross - feesOnContributions(a.id, gross);
      switch (kinds.get(a.id)) {
        case "livret":
          f.livrets += amount;
          break;
        case "assurance_vie":
        case "per":
        case "epargne_salariale":
          f.fondsEuros += amount;
          break;
        case "cto":
          f.obligations += amount;
          break;
        case "pea":
        case "pea_pme":
          f.actions += amount;
          break;
      }
    }
    f.livrets += 12 * (extra.livrets ?? 0);
    f.fondsEuros += 12 * (extra.fondsEuros ?? 0);
    f.obligations += 12 * (extra.obligations ?? 0);
    f.actions += 12 * (extra.actions ?? 0);
    return f;
  };
  const expenses = (year: number) => (data as { plannedExpenses?: Array<{ year: number; amount: number }> }).plannedExpenses?.filter((e) => e.year === year).reduce((s, e) => s + e.amount, 0) ?? 0;
  const cryptoContrib = state.accounts.filter((a) => a.account.kind === "crypto").reduce((s, a) => s + a.netContrib, 0);
  // Frais proportionnels à l'encours, pondérés par la valeur actuelle de chaque compte.
  const weighted = (kindsOf: string[], rateOf: (a: (typeof data.accounts)[number]) => number) => {
    const members = state.accounts.filter((s) => kindsOf.includes(s.account.kind) && s.value > 0);
    const total = members.reduce((s, m) => s + m.value, 0);
    return total > 0 ? members.reduce((s, m) => s + m.value * rateOf(m.account), 0) / total : 0;
  };
  const instOf = (a: (typeof data.accounts)[number]) => (a.institutionId ? institutions.get(a.institutionId) : undefined);
  const feeDrag = {
    fondsEuros: weighted(["assurance_vie"], (a) => instOf(a)?.offers.assurance_vie?.euroFee ?? 0),
    actions: weighted(["pea", "pea_pme"], (a) => instOf(a)?.offers.pea?.custodyRate ?? 0),
    obligations: weighted(["cto"], (a) => instOf(a)?.offers.cto?.custodyRate ?? 0),
  };
  return {
    params,
    startYear,
    start: { livrets: state.buckets.precaution, fondsEuros: state.buckets.garanti, obligations: state.buckets.obligations, actions: state.buckets.croissance },
    startContributed: state.totals.netContrib - cryptoContrib,
    // Identiques d'un tirage à l'autre : calculées une fois par année.
    contributions: perYear(contributions),
    contributionFees: perYear(contributionFees),
    feeDrag,
    expenses: perYear(expenses),
  };
}

/** Mémorise une fonction de l'année (les versements ne dépendent pas des rendements tirés). */
function perYear<T>(f: (year: number) => T): (year: number) => T {
  const cache = new Map<number, T>();
  return (year) => {
    let v = cache.get(year);
    if (v === undefined) {
      v = f(year);
      cache.set(year, v);
    }
    return v;
  };
}

export function projectFromState(data: EngineData, state: PortfolioState, overrides: ProjectionOverrides = {}): Projection {
  return project(projectionInputFromState(data, state, overrides));
}

// ——— Fourchette (Monte-Carlo) ———

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export interface Band {
  year: number;
  p10: number;
  p50: number;
  p90: number;
}

/**
 * Fourchette du patrimoine : les actions suivent un rendement annuel aléatoire
 * (moyenne = hypothèse, volatilité ~16 %/an), les autres classes d'actifs restent déterministes.
 */
export function monteCarlo(input: ProjectionInput, runs = 400, volatility = 0.16, seed = 42): Band[] {
  const rand = rng(seed);
  const mu = Math.log(1 + input.params.returns.actions) - (volatility * volatility) / 2;
  const totals: number[][] = [];
  for (let i = 0; i < runs; i++) {
    const draws = new Map<number, number>();
    const res = project(input, (year) => {
      let r = draws.get(year);
      if (r == null) {
        r = Math.exp(mu + volatility * normal(rand)) - 1;
        draws.set(year, r);
      }
      return { ...input.params.returns, actions: r };
    }, { drawdown: false });
    res.rows.forEach((row, j) => (totals[j] ??= []).push(row.total));
  }
  const q = (arr: number[], p: number) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
  };
  return totals.map((arr, j) => ({ year: input.startYear + j, p10: q(arr, 0.1), p50: q(arr, 0.5), p90: q(arr, 0.9) }));
}
