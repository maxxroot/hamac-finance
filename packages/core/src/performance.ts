import { addMonths } from "./dates";
import { ASSET_BUCKET, BUCKET_LABELS, BUCKETS, CASH_BUCKET, type AccountKind, type Bucket, type PricePoint } from "./domain";
import { accountIrr, contributionFlows, irrOf, PERF_GROUPS, type EngineData, type PortfolioState } from "./engine";
import type { HistoryPoint } from "./history";
import { endOfMonth } from "./history";
import { roundCents } from "./money";
import { PriceBook } from "./prices";
import { addMonth, Schedule, type Month } from "./schedule";
import type { WithdrawalTaxRow } from "./taxes";
import { daysBetween, type Flow } from "./xirr";

/**
 * Mesures de performance dans le temps, à partir de l'historique mensuel et du journal.
 * Convention des flux : celle du TRI (apports négatifs, retraits positifs).
 */

export interface PerfPoint {
  month: Month;
  date: string;
  value: number;
}

export interface MonthReturn extends PerfPoint {
  /** Argent entré dans le mois, retraits déduits. */
  inflow: number;
  gain: number;
  /** null si la somme réellement placée dans le mois est trop faible pour donner un taux qui ait un sens. */
  rate: number | null;
}

/** Sous 10 % de la somme en jeu, l'argent vient d'arriver : le taux du mois serait démesuré. */
const MIN_BASE_SHARE = 0.1;

/**
 * Rendement de chaque mois, sans l'effet des versements, par la méthode de Dietz modifiée :
 * gain du mois ÷ (valeur de départ + versements pondérés par le temps passé dans le mois).
 * Source : GIPS (CFA Institute), Guidance Statement on Calculation Methodology.
 */
export function monthlyReturns(points: readonly PerfPoint[], flows: readonly Flow[]): MonthReturn[] {
  return points.map((p, i) => {
    const prevDate = i === 0 ? endOfMonth(addMonth(p.month, -1)) : points[i - 1]!.date;
    const startValue = i === 0 ? 0 : points[i - 1]!.value;
    const span = Math.max(1, daysBetween(prevDate, p.date));
    let inflow = 0;
    let weighted = 0;
    for (const f of flows) {
      if (f.date <= prevDate || f.date > p.date) continue;
      inflow -= f.amount;
      weighted -= (f.amount * (span - daysBetween(prevDate, f.date))) / span;
    }
    const base = startValue + weighted;
    const gain = p.value - startValue - inflow;
    const floor = Math.max(1, MIN_BASE_SHARE * Math.max(Math.abs(startValue), Math.abs(p.value)));
    const rate = base >= floor && gain / base >= -1 ? gain / base : null;
    return { ...p, inflow: roundCents(inflow), gain: roundCents(gain), rate };
  });
}

/** Enchaîne des rendements mensuels ; null si aucun mois n'en a. */
export function chainRates(rates: ReadonlyArray<number | null>): number | null {
  if (!rates.some((r) => r != null)) return null;
  return rates.reduce<number>((idx, r) => idx * (1 + (r ?? 0)), 1) - 1;
}

export interface CurvePoint {
  month: Month;
  /** Rendement cumulé depuis le départ, sans l'effet des versements (0,05 = +5 %). */
  cumulative: number;
  /** Gain cumulé en euros depuis le départ : variation de valeur moins l'argent versé. Le dernier point vaut le gain de la période. */
  gain: number;
}

export interface Drawdown {
  /** Baisse entre le plus haut et le plus bas, négative. */
  depth: number;
  troughMonth: Month;
  /** Premier mois où le plus haut est retrouvé ; null si pas encore. */
  recoveredMonth: Month | null;
}

/** Plus forte baisse de la performance, d'un plus haut au plus bas qui suit ; null s'il n'y a eu aucune baisse. */
export function maxDrawdown(months: readonly MonthReturn[]): Drawdown | null {
  let idx = 1;
  let peak = 1;
  let worst: { depth: number; at: number; peak: number } | null = null;
  const index = months.map((m, i) => {
    idx *= 1 + (m.rate ?? 0);
    if (idx > peak) peak = idx;
    const depth = idx / peak - 1;
    if (depth < 0 && (!worst || depth < worst.depth)) worst = { depth, at: i, peak };
    return idx;
  });
  const w = worst as { depth: number; at: number; peak: number } | null;
  if (!w) return null;
  const back = index.findIndex((v, i) => i > w.at && v >= w.peak);
  return { depth: w.depth, troughMonth: months[w.at]!.month, recoveredMonth: back >= 0 ? months[back]!.month : null };
}

export interface GainSources {
  unrealized: number;
  realized: number;
  dividends: number;
  interests: number;
  /** Frais facturés à part, déduits du gain (positif). */
  billedFees: number;
  /** Impôts débités à part, déduits du gain (positif). */
  taxes: number;
  /** Corrections et pertes de crowdlending. */
  other: number;
  total: number;
  /** Tous les frais payés (positif), y compris ceux déjà compris dans les achats et les ventes. */
  allFees: number;
  embeddedFees: number;
}

export interface YearPerformance {
  year: number;
  startValue: number;
  endValue: number;
  inflow: number;
  gain: number;
  rate: number | null;
  income: number;
  fees: number;
}

export interface CalendarYear {
  year: number;
  /** Janvier à décembre ; null si le mois n'a pas de rendement. */
  months: Array<number | null>;
  rate: number | null;
}

export interface MonthStats {
  best: { month: Month; rate: number };
  worst: { month: Month; rate: number };
  positive: number;
  counted: number;
}

export interface PeriodSummary {
  startValue: number;
  endValue: number;
  inflow: number;
  gain: number;
  /** Depuis le début : gain ÷ montant investi. Sur une période : rendement de la période. */
  gainPct: number | null;
  /** Rendement de la période, sans l'effet des versements. */
  rate: number | null;
  annualized: number | null;
  annualizedReason: string | null;
}

/** Résultat d'une classe d'actifs sur la période. */
export interface ClassPerformance {
  bucket: Bucket;
  label: string;
  /** Valeur de la classe en fin de période. */
  value: number;
  /** Plus-values (encaissées ou non), dividendes et intérêts de la période. */
  gain: number;
  /** Rendement de la période, sans l'effet de l'argent ajouté ou retiré ; null si la classe était trop petite pour en donner un. */
  rate: number | null;
}

export interface ClassBreakdown {
  /** Dans l'ordre fixe des classes. */
  rows: ClassPerformance[];
  /** Frais facturés à part et impôts prélevés (négatif) : ils ne se rattachent à aucune classe. Avec les lignes, redonne le gain. */
  charges: number;
}

export interface ScopePerformance {
  summary: PeriodSummary;
  sources: GainSources;
  byClass: ClassBreakdown;
  drawdown: Drawdown | null;
  curve: CurvePoint[];
  years: YearPerformance[];
  calendar: CalendarYear[];
  stats: MonthStats | null;
  /** Mois de la période dont plus de 1 % de la valeur est comptée au prix de revient, faute de cours. */
  unpricedMonths: number;
  windowMonths: number;
}

const sum = <T>(xs: readonly T[], f: (x: T) => number) => xs.reduce((t, x) => t + f(x), 0);

/** Comptes qui comptent dans le total du patrimoine. */
export function activeAccountIds(state: PortfolioState): string[] {
  return state.accounts.filter((a) => !a.account.archived || a.value !== 0).map((a) => a.account.id);
}

export function accountFlows(data: EngineData, accountIds: readonly string[], asOf: string): Flow[] {
  const { params } = data;
  const schedule = new Schedule(data.plans, data.skips, params.profile.startMonth, params.profile.contributionDay);
  return contributionFlows(data, new Set(accountIds), asOf, schedule, true);
}

/** Point de départ de la période ; null si elle couvre tout l'historique (on part alors de zéro). */
function windowStart(length: number, monthsBack: number | null): number | null {
  return monthsBack != null && length > monthsBack ? length - 1 - monthsBack : null;
}

/** Ne garde que les mois à partir de la première donnée. */
function trimLeading<T extends PerfPoint>(points: readonly T[], flows: readonly Flow[]): number {
  const withFlow = new Set(flows.map((f) => f.date.slice(0, 7)));
  return points.findIndex((p) => p.value !== 0 || withFlow.has(p.month));
}

function summarize(points: readonly PerfPoint[], months: readonly MonthReturn[], start: number | null, flows: readonly Flow[], asOf: string): PeriodSummary {
  const from = start == null ? null : points[start]!;
  const window = start == null ? months : months.slice(start + 1);
  const startValue = from?.value ?? 0;
  const endValue = points.at(-1)!.value;
  const inflow = sum(window, (m) => m.inflow);
  const gain = endValue - startValue - inflow;
  const rate = chainRates(window.map((m) => m.rate));
  const inWindow = from ? flows.filter((f) => f.date > from.date) : [...flows];
  if (from && startValue > 0) inWindow.push({ date: from.date, amount: -startValue });
  const { irr, reason } = irrOf(inWindow, endValue, asOf);
  return {
    startValue: roundCents(startValue),
    endValue: roundCents(endValue),
    inflow: roundCents(inflow),
    gain: roundCents(gain),
    gainPct: from ? rate : inflow > 0 ? gain / inflow : null,
    rate,
    annualized: irr,
    annualizedReason: reason,
  };
}

function cumulated(h: HistoryPoint | null, ids: readonly string[]) {
  const pick = (f: (d: HistoryPoint["detailByAccount"][string]) => number) => (h ? sum(ids, (id) => (h.detailByAccount[id] ? f(h.detailByAccount[id]!) : 0)) : 0);
  return {
    gain: h ? sum(ids, (id) => (h.byAccount[id] ?? 0) - (h.contribByAccount[id] ?? 0)) : 0,
    unrealized: pick((d) => d.unrealized),
    realized: pick((d) => d.realized),
    dividends: pick((d) => d.dividends),
    interests: pick((d) => d.interests),
    fees: pick((d) => d.fees),
    embeddedFees: pick((d) => d.embeddedFees),
    // Historique antérieur au type « Impôts » : champ absent.
    taxes: pick((d) => d.taxes ?? 0),
  };
}

/** D'où vient le gain entre deux points : la somme des lignes redonne toujours le gain. */
export function gainSources(start: HistoryPoint | null, end: HistoryPoint, ids: readonly string[]): GainSources {
  const a = cumulated(start, ids);
  const b = cumulated(end, ids);
  const d = (k: keyof typeof a) => b[k] - a[k];
  const billedFees = d("fees") - d("embeddedFees");
  const known = d("unrealized") + d("realized") + d("dividends") + d("interests") - billedFees - d("taxes");
  return {
    unrealized: roundCents(d("unrealized")),
    realized: roundCents(d("realized")),
    dividends: roundCents(d("dividends")),
    interests: roundCents(d("interests")),
    billedFees: roundCents(billedFees),
    taxes: roundCents(d("taxes")),
    other: roundCents(d("gain") - known),
    total: roundCents(d("gain")),
    allFees: roundCents(d("fees")),
    embeddedFees: roundCents(d("embeddedFees")),
  };
}

function yearsOf(months: readonly MonthReturn[], history: readonly HistoryPoint[], ids: readonly string[]): YearPerformance[] {
  const byYear = new Map<number, number[]>();
  months.forEach((m, i) => {
    const y = +m.month.slice(0, 4);
    byYear.set(y, [...(byYear.get(y) ?? []), i]);
  });
  return [...byYear.entries()].map(([year, idx]) => {
    const first = idx[0]!;
    const last = idx.at(-1)!;
    const before = first > 0 ? history[first - 1]! : null;
    const s = gainSources(before, history[last]!, ids);
    const group = idx.map((i) => months[i]!);
    return {
      year,
      startValue: before ? months[first - 1]!.value : 0,
      endValue: months[last]!.value,
      inflow: roundCents(sum(group, (m) => m.inflow)),
      gain: roundCents(sum(group, (m) => m.gain)),
      rate: chainRates(group.map((m) => m.rate)),
      income: roundCents(s.dividends + s.interests),
      fees: s.allFees,
    };
  });
}

function calendarOf(months: readonly MonthReturn[]): CalendarYear[] {
  const years = new Map<number, Array<number | null>>();
  for (const m of months) {
    const year = +m.month.slice(0, 4);
    const row = years.get(year) ?? Array<number | null>(12).fill(null);
    row[+m.month.slice(5, 7) - 1] = m.rate;
    years.set(year, row);
  }
  return [...years.entries()].map(([year, row]) => ({ year, months: row, rate: chainRates(row) }));
}

function statsOf(months: readonly MonthReturn[]): MonthStats | null {
  const rated = months.flatMap((m) => (m.rate == null ? [] : [{ month: m.month, rate: m.rate }]));
  if (!rated.length) return null;
  const by = (cmp: (a: number, b: number) => boolean) => rated.reduce((x, m) => (cmp(m.rate, x.rate) ? m : x), rated[0]!);
  return { best: by((a, b) => a > b), worst: by((a, b) => a < b), positive: rated.filter((m) => m.rate > 0).length, counted: rated.length };
}

// ——— Par classe d'actifs ———

interface ClassSnapshot {
  value: Record<Bucket, number>;
  /** Résultat cumulé : plus-values, revenus et intérêts, hors frais facturés à part et impôts. */
  result: Record<Bucket, number>;
  /** Frais facturés à part et impôts cumulés (positif). */
  charges: number;
}

const zeroBuckets = () => Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>;

/**
 * Valeur et résultat cumulé de chaque classe à une date. Un titre compte dans la classe de son type
 * (comme dans la répartition) ; les espèces et les projets de crowdlending, dans celle du compte.
 * Le reste du gain d'un compte, hors titres, revient à la classe de ses espèces (intérêts d'un livret, d'un fonds euros…).
 */
function classSnapshot(h: HistoryPoint, ids: ReadonlySet<string>, kindOf: ReadonlyMap<string, AccountKind>, bucketOf: ReadonlyMap<string, Bucket>): ClassSnapshot {
  const value = zeroBuckets();
  const result = zeroBuckets();
  const posValue = new Map<string, number>();
  const posResult = new Map<string, number>();
  for (const key of new Set([...Object.keys(h.byPosition), ...Object.keys(h.positionResults)])) {
    const [accountId, assetId] = key.split(":") as [string, string];
    const kind = kindOf.get(accountId);
    if (!ids.has(accountId) || !kind) continue;
    const pos = h.byPosition[key];
    const res = h.positionResults[key];
    const b = bucketOf.get(assetId) ?? CASH_BUCKET[kind];
    const v = pos?.value ?? 0;
    const r = (pos ? pos.value - pos.cost : 0) + (res?.realized ?? 0) + (res?.income ?? 0);
    value[b] += v;
    result[b] += r;
    posValue.set(accountId, (posValue.get(accountId) ?? 0) + v);
    posResult.set(accountId, (posResult.get(accountId) ?? 0) + r);
  }
  let charges = 0;
  for (const id of ids) {
    const kind = kindOf.get(id);
    if (!kind) continue;
    const d = h.detailByAccount[id];
    const accountCharges = d ? d.fees - d.embeddedFees + (d.taxes ?? 0) : 0;
    const cash = CASH_BUCKET[kind];
    value[cash] += (h.byAccount[id] ?? 0) - (posValue.get(id) ?? 0);
    result[cash] += (h.byAccount[id] ?? 0) - (h.contribByAccount[id] ?? 0) - (posResult.get(id) ?? 0) + accountCharges;
    charges += accountCharges;
  }
  return { value, result, charges };
}

/**
 * Gain et rendement de chaque classe sur la période. Le rendement d'un mois suit la méthode de Dietz
 * simple : gain du mois ÷ (valeur de départ + moitié de l'argent entré dans la classe pendant le mois),
 * l'argent entré étant ce qui reste de la variation de valeur une fois le gain retiré (versements, achats, ventes).
 * Source : GIPS (CFA Institute), Guidance Statement on Calculation Methodology.
 */
function classBreakdown(data: EngineData, kept: readonly HistoryPoint[], accountIds: readonly string[], start: number | null): ClassBreakdown {
  const ids = new Set(accountIds);
  const kindOf = new Map(data.accounts.map((a) => [a.id, a.kind]));
  const bucketOf = new Map(data.assets.map((a) => [a.id, ASSET_BUCKET[a.kind]]));
  const snaps = kept.map((h) => classSnapshot(h, ids, kindOf, bucketOf));
  const zero: ClassSnapshot = { value: zeroBuckets(), result: zeroBuckets(), charges: 0 };
  const from = start == null ? zero : snaps[start]!;
  const end = snaps.at(-1) ?? zero;
  const rows: ClassPerformance[] = [];
  for (const b of BUCKETS) {
    const gain = end.result[b] - from.result[b];
    if (Math.abs(end.value[b]) < 0.005 && Math.abs(gain) < 0.005) continue;
    const rates: Array<number | null> = [];
    for (let i = start == null ? 0 : start + 1; i < snaps.length; i++) {
      const prev = i === 0 ? zero : snaps[i - 1]!;
      const g = snaps[i]!.result[b] - prev.result[b];
      const inflow = snaps[i]!.value[b] - prev.value[b] - g;
      const base = prev.value[b] + inflow / 2;
      const floor = Math.max(1, MIN_BASE_SHARE * Math.max(Math.abs(prev.value[b]), Math.abs(snaps[i]!.value[b])));
      rates.push(base >= floor && g / base >= -1 ? g / base : null);
    }
    rows.push({ bucket: b, label: BUCKET_LABELS[b], value: roundCents(end.value[b]), gain: roundCents(gain), rate: chainRates(rates) });
  }
  return { rows, charges: roundCents(from.charges - end.charges) };
}

/** Tout ce que la page montre pour un ensemble de comptes ; `monthsBack` null = depuis le début. */
export function scopePerformance(data: EngineData, state: PortfolioState, history: readonly HistoryPoint[], accountIds: readonly string[], monthsBack: number | null): ScopePerformance | null {
  const flows = accountFlows(data, accountIds, state.asOf);
  const all = history.map((h) => ({ month: h.month, date: h.date, value: sum(accountIds, (id) => h.byAccount[id] ?? 0) }));
  const first = trimLeading(all, flows);
  if (first < 0) return null;
  const points = all.slice(first);
  const kept = history.slice(first);
  const months = monthlyReturns(points, flows);
  const start = windowStart(points.length, monthsBack);
  const window = start == null ? months : months.slice(start + 1);
  const curve: CurvePoint[] = start == null ? [] : [{ month: points[start]!.month, cumulative: 0, gain: 0 }];
  let idx = 1;
  let gain = 0;
  for (const m of window) {
    idx *= 1 + (m.rate ?? 0);
    gain += m.gain;
    curve.push({ month: m.month, cumulative: idx - 1, gain: roundCents(gain) });
  }
  const unpricedMonths = kept.slice(start == null ? 0 : start + 1).filter((h) => {
    const value = sum(accountIds, (id) => h.byAccount[id] ?? 0);
    return value > 0 && sum(accountIds, (id) => h.detailByAccount[id]?.unpriced ?? 0) > 0.01 * value;
  }).length;
  return {
    summary: summarize(points, months, start, flows, state.asOf),
    sources: gainSources(start == null ? null : kept[start]!, kept.at(-1)!, accountIds),
    byClass: classBreakdown(data, kept, accountIds, start),
    drawdown: maxDrawdown(window),
    curve,
    years: yearsOf(months, kept, accountIds),
    calendar: calendarOf(months),
    stats: statsOf(months),
    unpricedMonths,
    windowMonths: window.length,
  };
}

// ——— Par enveloppe ———

export interface EnvelopePerformance {
  key: string;
  label: string;
  value: number;
  inflow: number;
  gain: number;
  gainPct: number | null;
  annualized: number | null;
  annualizedReason: string | null;
  assumption: number | null;
  /** Gain restant si tout était retiré aujourd'hui ; seulement depuis le début. */
  afterTax: number | null;
  accounts: EnvelopePerformance[];
}

/** Lignes par enveloppe puis total. Depuis le début, elles reprennent les chiffres du tableau de bord. */
export function envelopePerformance(data: EngineData, state: PortfolioState, history: readonly HistoryPoint[], taxes: readonly WithdrawalTaxRow[], monthsBack: number | null): EnvelopePerformance[] {
  const active = new Set(activeAccountIds(state));
  const taxOf = (ids: readonly string[]) => sum(taxes.filter((t) => ids.includes(t.accountId)), (t) => t.tax);
  const fromPeriod = (key: string, label: string, ids: string[], assumption: number | null) => {
    const p = scopePerformance(data, state, history, ids, monthsBack);
    if (!p) return null;
    const { endValue, inflow, gain, gainPct, annualized, annualizedReason } = p.summary;
    return { key, label, value: endValue, inflow, gain, gainPct, annualized, annualizedReason, assumption, afterTax: null, accounts: [] as EnvelopePerformance[] };
  };
  const accountRow = (id: string): EnvelopePerformance | null => {
    const a = state.accountById.get(id)!;
    if (monthsBack != null) return fromPeriod(id, a.account.name, [id], null);
    const { irr, reason } = accountIrr(data, state, id);
    return { key: id, label: a.account.name, value: a.value, inflow: a.netContrib, gain: a.gain, gainPct: a.netContrib > 0 ? a.gain / a.netContrib : null, annualized: irr, annualizedReason: reason, assumption: null, afterTax: roundCents(a.gain - taxOf([id])), accounts: [] };
  };
  const rows: EnvelopePerformance[] = [];
  for (const r of state.performance) {
    const group = PERF_GROUPS.find((g) => g.key === r.key);
    const ids = (group ? state.accounts.filter((a) => group.kinds.includes(a.account.kind)) : state.accounts).map((a) => a.account.id).filter((id) => active.has(id));
    const base = monthsBack == null
      ? { key: r.key, label: r.label, value: r.value, inflow: r.netContrib, gain: r.gain, gainPct: r.netContrib > 0 ? r.gainPct : null, annualized: r.irr, annualizedReason: r.irrReason, assumption: r.assumption, afterTax: roundCents(r.gain - taxOf(ids)), accounts: [] as EnvelopePerformance[] }
      : ids.length ? fromPeriod(r.key, r.label, ids, r.assumption) : null;
    if (!base) continue;
    if (group) base.accounts = ids.flatMap((id) => accountRow(id) ?? []);
    rows.push(base);
  }
  return rows;
}

// ——— Par titre ———

export interface AssetPerformance {
  assetId: string;
  value: number;
  /** Plus-value latente + réalisée + revenus sur la période. */
  gain: number;
  income: number;
  rate: number | null;
}

/** Flux d'un titre, vus comme s'il était un compte : achats en entrée, ventes et revenus en sortie. */
function assetFlows(data: EngineData, state: PortfolioState, assetId: string, accounts: ReadonlySet<string>): Flow[] {
  const flows: Flow[] = [];
  for (const tx of data.transactions) {
    if (tx.assetId !== assetId || tx.date > state.asOf || !accounts.has(tx.accountId)) continue;
    if (tx.type === "achat") flows.push({ date: tx.date, amount: -tx.amount });
    if (tx.type === "vente" || tx.type === "dividende" || tx.type === "interets") flows.push({ date: tx.date, amount: tx.amount });
  }
  for (const d of state.disposals) if (d.kind === "remboursement" && d.assetId === assetId && accounts.has(d.accountId)) flows.push({ date: d.date, amount: d.proceeds });
  return flows;
}

/** Résultat de chaque titre sur la période, titres vendus compris, du meilleur au moins bon. */
export function assetPerformance(data: EngineData, state: PortfolioState, history: readonly HistoryPoint[], accountIds: readonly string[], monthsBack: number | null): AssetPerformance[] {
  const accounts = new Set(accountIds);
  const assetIds = new Set<string>();
  for (const key of Object.keys(history.at(-1)?.positionResults ?? {})) {
    const [accountId, assetId] = key.split(":");
    if (accounts.has(accountId!)) assetIds.add(assetId!);
  }
  const rows: AssetPerformance[] = [];
  for (const assetId of assetIds) {
    const of = (h: HistoryPoint) =>
      accountIds.reduce(
        (t, id) => {
          const key = `${id}:${assetId}`;
          const pos = h.byPosition[key];
          const res = h.positionResults[key];
          return { value: t.value + (pos?.value ?? 0), latent: t.latent + (pos ? pos.value - pos.cost : 0), realized: t.realized + (res?.realized ?? 0), income: t.income + (res?.income ?? 0) };
        },
        { value: 0, latent: 0, realized: 0, income: 0 },
      );
    const flows = assetFlows(data, state, assetId, accounts);
    const series = history.map((h) => ({ month: h.month, date: h.date, value: of(h).value }));
    const first = trimLeading(series, flows);
    if (first < 0) continue;
    const points = series.slice(first);
    const kept = history.slice(first);
    const months = monthlyReturns(points, flows);
    const start = windowStart(points.length, monthsBack);
    const end = of(kept.at(-1)!);
    const begin = start == null ? { latent: 0, realized: 0, income: 0 } : of(kept[start]!);
    const gain = end.latent + end.realized + end.income - (begin.latent + begin.realized + begin.income);
    if (end.value === 0 && Math.abs(gain) < 0.005) continue;
    rows.push({ assetId, value: roundCents(end.value), gain: roundCents(gain), income: roundCents(end.income - begin.income), rate: chainRates((start == null ? months : months.slice(start + 1)).map((m) => m.rate)) });
  }
  return rows.sort((a, b) => b.gain - a.gain);
}

// ——— Comparaison ———

export interface SeriesPoint {
  date: string;
  price: number;
}

/** Ce qu'on compare : des comptes, un titre du portefeuille, ou l'historique d'un titre qu'on ne détient pas. */
export type CompareSide = { kind: "accounts"; accountIds: readonly string[] } | { kind: "asset"; assetId: string } | { kind: "series"; points: readonly SeriesPoint[] };

export interface WhatIf {
  actual: number;
  simulated: number;
  difference: number;
}

export interface Comparison {
  /** Mois (`AAAA-MM`) quand un portefeuille est comparé, jours (`AAAA-MM-JJ`) entre deux titres : voir `daily`. */
  dates: string[];
  daily: boolean;
  left: number[];
  right: number[];
  leftRate: number;
  rightRate: number;
  whatIf: WhatIf | null;
}

/** Titres dont on connaît assez de cours pour servir de point de comparaison. */
export function comparableAssetIds(data: EngineData): string[] {
  const dated = new Map<string, Set<string>>();
  for (const p of data.prices) dated.set(p.assetId, (dated.get(p.assetId) ?? new Set()).add(p.date.slice(0, 7)));
  return data.assets.filter((a) => !a.archived && a.kind !== "obligation" && (dated.get(a.id)?.size ?? 0) >= 2).map((a) => a.id);
}

type BookSide = Exclude<CompareSide, { kind: "series" }>;

/** Au-delà, on espace les points : un graphique n'en montre pas davantage. */
const MAX_COMPARE_POINTS = 300;

/** Deux titres, sur leurs cours : du premier jour où les deux en ont (ou du début de la période) à aujourd'hui. */
function comparePrices(book: PriceBook, leftId: string, rightId: string, asOf: string, monthsBack: number | null): Comparison | null {
  const pricesOf = (id: string) => book.history(id).filter((p) => p.date > "1900-01-01" && p.date <= asOf);
  const l = pricesOf(leftId);
  const r = pricesOf(rightId);
  if (!l.length || !r.length) return null;
  const firstCommon = l[0]!.date > r[0]!.date ? l[0]!.date : r[0]!.date;
  const windowFrom = monthsBack == null ? firstCommon : addMonths(asOf, -monthsBack);
  const from = windowFrom > firstCommon ? windowFrom : firstCommon;
  const all = [from, ...[...new Set([...l, ...r].map((p) => p.date))].filter((d) => d > from).sort((a, b) => a.localeCompare(b))];
  if (all.length < 2) return null;
  const step = Math.ceil(all.length / MAX_COMPARE_POINTS);
  const dates = all.filter((_, i) => i % step === 0 || i === all.length - 1);
  const curve = (id: string): number[] | null => {
    const base = book.at(id, from)?.price;
    return base && base > 0 ? dates.map((d) => book.at(id, d)!.price / base - 1) : null;
  };
  const left = curve(leftId);
  const right = curve(rightId);
  if (!left || !right) return null;
  return { dates, daily: true, left, right, leftRate: left.at(-1)!, rightRate: right.at(-1)!, whatIf: null };
}

function sideRates(data: EngineData, state: PortfolioState, history: readonly HistoryPoint[], book: PriceBook, side: BookSide): Map<Month, number | null> {
  const out = new Map<Month, number | null>();
  if (side.kind === "asset") {
    let previous: number | null = null;
    for (const h of history) {
      const p = book.at(side.assetId, h.date);
      if (!p || p.date <= "1900-01-01") continue;
      out.set(h.month, previous != null && previous > 0 ? p.price / previous - 1 : null);
      previous = p.price;
    }
    return out;
  }
  const flows = accountFlows(data, side.accountIds, state.asOf);
  const all = history.map((h) => ({ month: h.month, date: h.date, value: sum(side.accountIds, (id) => h.byAccount[id] ?? 0) }));
  const first = trimLeading(all, flows);
  if (first >= 0) for (const m of monthlyReturns(all.slice(first), flows)) out.set(m.month, m.rate);
  return out;
}

/** Les mêmes dates et les mêmes montants, placés sur un autre titre (au dernier cours connu à chaque date). */
export function sameFlowsOn(book: PriceBook, assetId: string, startValue: number, startDate: string, flows: readonly Flow[], asOf: string): number | null {
  const price = (date: string) => book.at(assetId, date)?.price ?? null;
  const first = price(startDate);
  const last = price(asOf);
  if (first == null || last == null || first <= 0) return null;
  let units = startValue / first;
  for (const f of [...flows].sort((a, b) => a.date.localeCompare(b.date))) {
    if (f.date <= startDate || f.date > asOf) continue;
    const p = price(f.date);
    if (p == null || p <= 0) continue;
    units = Math.max(0, units - f.amount / p);
  }
  return roundCents(units * last);
}

/**
 * Compare deux éléments depuis un même point de départ. Un portefeuille se lit mois par mois, sur sa durée ;
 * deux titres se comparent sur leurs cours, sans dépendre de la date d'ouverture des comptes.
 */
export function comparePerformance(data: EngineData, state: PortfolioState, history: readonly HistoryPoint[], leftSide: CompareSide, rightSide: CompareSide, monthsBack: number | null): Comparison | null {
  const outside: PricePoint[] = [];
  const onBook = (side: CompareSide, assetId: string): BookSide => {
    if (side.kind !== "series") return side;
    for (const p of side.points) outside.push({ assetId, date: p.date, price: p.price, source: "comparaison" });
    return { kind: "asset", assetId };
  };
  const left = onBook(leftSide, "__gauche");
  const right = onBook(rightSide, "__droite");
  const book = new PriceBook([...data.prices, ...outside], data.assets);
  if (left.kind === "asset" && right.kind === "asset") return comparePrices(book, left.assetId, right.assetId, state.asOf, monthsBack);
  const l = sideRates(data, state, history, book, left);
  const r = sideRates(data, state, history, book, right);
  const start = windowStart(history.length, monthsBack);
  const fromMonth = start == null ? null : history[start]!.month;
  const months = history.map((h) => h.month).filter((m) => l.has(m) && r.has(m) && (fromMonth == null || m >= fromMonth));
  if (months.length < 2) return null;
  const curve = (rates: Map<Month, number | null>) => {
    let idx = 1;
    return months.map((m, i) => {
      if (i > 0) idx *= 1 + (rates.get(m) ?? 0);
      return idx - 1;
    });
  };
  const leftCurve = curve(l);
  const rightCurve = curve(r);
  let whatIf: WhatIf | null = null;
  if (left.kind === "accounts" && right.kind === "asset") {
    const valueAt = (h: HistoryPoint) => sum(left.accountIds, (id) => h.byAccount[id] ?? 0);
    const base = history.find((h) => h.month === months[0])!;
    const actual = roundCents(valueAt(history.at(-1)!));
    const simulated = sameFlowsOn(book, right.assetId, valueAt(base), base.date, accountFlows(data, left.accountIds, state.asOf), state.asOf);
    if (simulated != null) whatIf = { actual, simulated, difference: roundCents(simulated - actual) };
  }
  return { dates: months, daily: false, left: leftCurve, right: rightCurve, leftRate: leftCurve.at(-1)!, rightRate: rightCurve.at(-1)!, whatIf };
}
