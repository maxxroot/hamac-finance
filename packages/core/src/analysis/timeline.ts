import { ACCOUNT_KIND_LABELS, addMonth, BUCKETS, monthOf, plannedBucketOf, Schedule, type Bucket, type Month, type Transaction } from "../model";
import type { EngineData, HistoryPoint } from "../portfolio";
import { formatEur, formatPct, roundCents } from "../base";
import { accountFlows, gainSources, maxDrawdown, monthlyReturns, type GainSources } from "./performance";
import { loanState } from "../loans";

/**
 * Page Historique : remonter le temps. Les grandes étapes du parcours, la situation à deux dates
 * et ce qui s'est passé entre les deux. Tout se déduit du journal et de l'historique mensuel.
 */

// ——— Grandes étapes ———

export const MILESTONE_CATEGORIES = ["comptes", "titres", "paliers", "mouvements", "marches", "immobilier"] as const;
export type MilestoneCategory = (typeof MILESTONE_CATEGORIES)[number];
export const MILESTONE_CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  comptes: "Comptes et contrats",
  titres: "Titres",
  paliers: "Paliers",
  mouvements: "Gros versements et retraits",
  marches: "Marchés",
  immobilier: "Biens et crédits",
};

export interface Milestone {
  /** Clé stable, pour l'affichage. */
  id: string;
  date: string;
  month: Month;
  category: MilestoneCategory;
  title: string;
  detail: string | null;
  accountId: string | null;
}

/** Paliers de 1, 2 et 5 à chaque puissance de dix, à partir de 1 000 €. */
export function thresholds(upTo: number): number[] {
  const out: number[] = [];
  for (let p = 1_000; p <= upTo; p *= 10) for (const k of [1, 2, 5]) if (k * p <= upTo) out.push(k * p);
  return out;
}

/** Un versement ou un retrait ponctuel compte parmi les étapes à partir de ce montant… */
export const BIG_MOVE_MIN = 5_000;
/** … et s'il pèse au moins cette part du patrimoine financier de la fin du mois précédent. */
export const BIG_MOVE_SHARE = 0.1;
/** Une baisse plus légère que celle-ci n'est pas une étape. */
export const DRAWDOWN_MIN = -0.05;

const eur = (v: number) => formatEur(v, { compact: true });
const quoted = (name: string) => `« ${name} »`;
const QTY_EPS = 1e-9;

/** Les grandes étapes, de la plus ancienne à la plus récente ; seules celles passées à `asOf` comptent. */
export function milestones(data: EngineData, history: readonly HistoryPoint[], asOf: string): Milestone[] {
  const out: Milestone[] = [];
  const push = (m: Omit<Milestone, "month">) => {
    if (m.date <= asOf) out.push({ ...m, month: monthOf(m.date) });
  };
  const accountName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? "compte supprimé";
  const assetName = (id: string) => data.assets.find((a) => a.id === id)?.name ?? "titre supprimé";
  const txs = data.transactions.filter((t) => t.date <= asOf).sort((a, b) => a.date.localeCompare(b.date));
  const schedule = new Schedule(data.plans, data.skips, data.params.profile.startMonth, data.params.profile.contributionDay);

  // Comptes : ouverture (date saisie, sinon première opération) et clôture (dernière opération d'un compte archivé).
  for (const a of data.accounts) {
    const dates = [...txs.filter((t) => t.accountId === a.id || t.counterAccountId === a.id).map((t) => t.date), ...schedule.paidFlows(a.id, asOf).map((f) => f.date)].sort((x, y) => x.localeCompare(y));
    const opened = a.openedOn ?? dates[0];
    if (opened) push({ id: `ouverture:${a.id}`, date: opened, category: "comptes", title: `Ouverture de ${quoted(a.name)}`, detail: ACCOUNT_KIND_LABELS[a.kind], accountId: a.id });
    const last = dates.at(-1);
    if (a.archived && last) push({ id: `cloture:${a.id}`, date: last, category: "comptes", title: `Clôture de ${quoted(a.name)}`, detail: ACCOUNT_KIND_LABELS[a.kind], accountId: a.id });
  }

  // Titres : premier achat de chaque titre, puis chaque vente qui vide une ligne.
  const bought = new Set<string>();
  const qty = new Map<string, number>();
  // Un arbitrage cède un titre et en reçoit un autre.
  const legs = txs.flatMap((t): Transaction[] =>
    t.type === "arbitrage" ? [{ ...t, type: "vente" }, { ...t, type: "achat", assetId: t.counterAssetId ?? null, quantity: t.counterQuantity ?? null }] : [t],
  );
  for (const t of legs) {
    if (!t.assetId || !t.quantity || (t.type !== "achat" && t.type !== "vente")) continue;
    const key = `${t.accountId}:${t.assetId}`;
    const before = qty.get(key) ?? 0;
    if (t.type === "achat") {
      qty.set(key, before + t.quantity);
      if (!bought.has(t.assetId)) {
        bought.add(t.assetId);
        push({ id: `achat:${t.assetId}`, date: t.date, category: "titres", title: `Premier achat de ${assetName(t.assetId)}`, detail: `${eur(t.amount)} dans ${quoted(accountName(t.accountId))}`, accountId: t.accountId });
      }
    } else {
      const after = before - t.quantity;
      qty.set(key, Math.max(0, after));
      if (before > QTY_EPS && after <= QTY_EPS * Math.max(1, before)) {
        push({ id: `vente:${t.id}`, date: t.date, category: "titres", title: `Vente de tout ${assetName(t.assetId)}`, detail: `${eur(t.amount)} reçus dans ${quoted(accountName(t.accountId))}`, accountId: t.accountId });
      }
    }
  }

  // Paliers du patrimoine financier : la première fois qu'il les dépasse, le plus haut seulement si plusieurs le même mois.
  const peak = Math.max(0, ...history.map((h) => h.value));
  const pending = thresholds(peak);
  for (const h of history) {
    let crossed: number | null = null;
    while (pending.length && h.value >= pending[0]!) crossed = pending.shift()!;
    if (crossed != null) push({ id: `palier:${crossed}`, date: h.date, category: "paliers", title: `Cap des ${eur(crossed)} franchi`, detail: `Patrimoine financier : ${eur(h.value)}`, accountId: null });
  }

  // Gros versements et retraits ponctuels, comparés au patrimoine de la fin du mois précédent.
  const valueAt = new Map(history.map((h) => [h.month, h.value]));
  for (const t of txs) {
    if (t.type !== "versement" && t.type !== "retrait") continue;
    const before = valueAt.get(addMonth(monthOf(t.date), -1)) ?? 0;
    if (t.amount < BIG_MOVE_MIN || t.amount < BIG_MOVE_SHARE * before) continue;
    const name = quoted(accountName(t.accountId));
    push({ id: `mouvement:${t.id}`, date: t.date, category: "mouvements", title: `${t.type === "versement" ? "Versement" : "Retrait"} de ${eur(t.amount)}`, detail: t.type === "versement" ? `sur ${name}` : `depuis ${name}`, accountId: t.accountId });
  }

  // Marchés : point bas de la plus forte baisse des placements (sans l'effet des versements), puis son rattrapage.
  if (history.length > 1) {
    const ids = data.accounts.map((a) => a.id);
    const months = monthlyReturns(
      history.map((h) => ({ month: h.month, date: h.date, value: h.value })),
      accountFlows(data, ids, asOf),
    );
    const dd = maxDrawdown(months);
    if (dd && dd.depth <= DRAWDOWN_MIN) {
      const dateOf = (m: Month) => history.find((h) => h.month === m)!.date;
      push({ id: "baisse", date: dateOf(dd.troughMonth), category: "marches", title: "Point bas de la plus forte baisse", detail: `${formatPct(dd.depth)} depuis le plus haut précédent, hors versements`, accountId: null });
      if (dd.recoveredMonth) push({ id: "rattrapage", date: dateOf(dd.recoveredMonth), category: "marches", title: "Plus forte baisse rattrapée", detail: "Les placements retrouvent leur plus haut", accountId: null });
    }
  }

  // Biens et crédits.
  for (const p of data.properties ?? []) {
    if (p.purchaseDate) push({ id: `bien:${p.id}`, date: p.purchaseDate, category: "immobilier", title: `Achat de ${quoted(p.name)}`, detail: p.purchasePrice != null ? `${eur(p.purchasePrice * p.share)}${p.share < 1 ? " pour la part détenue" : ""}` : null, accountId: null });
    if (p.saleDate) push({ id: `vente-bien:${p.id}`, date: p.saleDate, category: "immobilier", title: `Vente de ${quoted(p.name)}`, detail: p.salePrice != null ? `${eur(p.salePrice * p.share)}${p.share < 1 ? " pour la part détenue" : ""}` : null, accountId: null });
  }
  for (const l of data.loans ?? []) {
    push({ id: `credit:${l.id}`, date: l.firstPayment, category: "immobilier", title: `Première échéance du crédit ${quoted(l.name)}`, detail: `${eur(l.principal * l.share)} empruntés${l.share < 1 ? " pour votre part" : ""}`, accountId: null });
    if (l.closedOn) push({ id: `credit-fin:${l.id}`, date: l.closedOn, category: "immobilier", title: `Crédit ${quoted(l.name)} soldé`, detail: null, accountId: null });
    else if (!l.archived) {
      const s = loanState(l, asOf);
      if (s.paymentsLeft === 0) push({ id: `credit-fin:${l.id}`, date: s.endDate, category: "immobilier", title: `Crédit ${quoted(l.name)} remboursé`, detail: "Dernière échéance payée", accountId: null });
    }
  }

  const order = (c: MilestoneCategory) => MILESTONE_CATEGORIES.indexOf(c);
  return out.sort((a, b) => a.date.localeCompare(b.date) || order(a.category) - order(b.category));
}

// ——— Ce qui s'est passé entre deux dates ———

export interface PeriodFlows {
  /** Apports, versements ponctuels et versements programmés. */
  deposits: number;
  withdrawals: number;
  /** Transferts depuis ou vers un compte hors du périmètre ; nuls sur tout le patrimoine. */
  transfersIn: number;
  transfersOut: number;
}

export interface PeriodChange {
  startValue: number;
  endValue: number;
  flows: PeriodFlows;
  /** Le gain de la période, ligne par ligne : la somme redonne `endValue − startValue − argent net apporté`. */
  sources: GainSources;
}

const sumOf = (ids: readonly string[], f: (id: string) => number) => ids.reduce((t, id) => t + f(id), 0);

/**
 * Valeur de départ, argent apporté ou retiré, gain, valeur d'arrivée, pour un ensemble de comptes,
 * entre la fin d'un mois et une date suivante. `from` null : depuis le tout début.
 * La valeur de départ plus toutes les lignes redonne toujours la valeur d'arrivée.
 */
export function periodChange(data: EngineData, from: HistoryPoint | null, to: HistoryPoint, accountIds: readonly string[]): PeriodChange {
  const ids = new Set(accountIds);
  const start = from?.date ?? "";
  const flows: PeriodFlows = { deposits: 0, withdrawals: 0, transfersIn: 0, transfersOut: 0 };
  for (const t of data.transactions) {
    if (t.date <= start || t.date > to.date) continue;
    const inFrom = ids.has(t.accountId);
    if (t.type === "transfert") {
      const inTo = t.counterAccountId != null && ids.has(t.counterAccountId);
      if (inFrom && !inTo) flows.transfersOut += t.amount;
      if (!inFrom && inTo) flows.transfersIn += t.amount;
    } else if (inFrom && (t.type === "apport_initial" || t.type === "versement")) flows.deposits += t.amount;
    else if (inFrom && t.type === "retrait") flows.withdrawals += t.amount;
  }
  const schedule = new Schedule(data.plans, data.skips, data.params.profile.startMonth, data.params.profile.contributionDay);
  flows.deposits += sumOf(accountIds, (id) => schedule.paidTotal(id, to.date) - (from ? schedule.paidTotal(id, from.date) : 0));
  const value = (h: HistoryPoint | null) => (h ? sumOf(accountIds, (id) => h.byAccount[id] ?? 0) : 0);
  return {
    startValue: roundCents(value(from)),
    endValue: roundCents(value(to)),
    flows: { deposits: roundCents(flows.deposits), withdrawals: roundCents(flows.withdrawals), transfersIn: roundCents(flows.transfersIn), transfersOut: roundCents(flows.transfersOut) },
    sources: gainSources(from, to, accountIds),
  };
}

// ——— La situation à deux dates ———

export interface SnapshotTotals {
  value: number;
  netContrib: number;
  gain: number;
  realEstate: number;
  otherAssets: number;
  debts: number;
  netWorth: number;
}

export interface AccountChange {
  accountId: string;
  startValue: number;
  endValue: number;
  /** Argent apporté net sur la période, transferts compris. */
  contribChange: number;
  /** Variation de valeur moins l'argent apporté. */
  gainChange: number;
}

/** Ce qui est arrivé à une ligne de titres : jugé sur son prix de revient, qui ne bouge qu'avec les achats et les ventes. */
export type PositionMove = "nouveau" | "vendu" | "renforce" | "allege" | "inchange";
export const POSITION_MOVE_LABELS: Record<PositionMove, string> = {
  nouveau: "Nouveau",
  vendu: "Vendu",
  renforce: "Renforcé",
  allege: "Allégé",
  inchange: "Inchangé",
};

export interface PositionChange {
  accountId: string;
  assetId: string;
  start: { value: number; cost: number } | null;
  end: { value: number; cost: number } | null;
  move: PositionMove;
}

export interface BucketChange {
  bucket: Bucket;
  start: number;
  end: number;
  startShare: number;
  endShare: number;
}

export interface SnapshotComparison {
  start: SnapshotTotals | null;
  end: SnapshotTotals;
  accounts: AccountChange[];
  positions: PositionChange[];
  buckets: BucketChange[];
}

/** Sous cet écart de prix de revient (en euros, ou en part), la ligne n'a pas bougé : arrondis, frais d'un centime. */
const COST_EPS = 0.5;
const COST_EPS_SHARE = 0.001;

/** Les comptes clôturés comptent : leur argent versé et leur gain font partie de l'histoire. */
function totalsOf(h: HistoryPoint): SnapshotTotals {
  const netContrib = Object.values(h.contribByAccount).reduce((t, v) => t + v, 0);
  return { value: h.value, netContrib: roundCents(netContrib), gain: roundCents(h.value - netContrib), realEstate: h.realEstate, otherAssets: h.otherAssets, debts: h.debts, netWorth: h.netWorth };
}

export function positionMove(start: { cost: number } | null, end: { cost: number } | null): PositionMove {
  if (!start) return end ? "nouveau" : "inchange";
  if (!end) return "vendu";
  const d = end.cost - start.cost;
  if (Math.abs(d) <= Math.max(COST_EPS, COST_EPS_SHARE * start.cost)) return "inchange";
  return d > 0 ? "renforce" : "allege";
}

/** Compare deux points de l'historique ; `from` null : comparaison avec le tout début, où rien n'existait. */
export function compareSnapshots(from: HistoryPoint | null, to: HistoryPoint): SnapshotComparison {
  const accountIds = [...new Set([...Object.keys(from?.byAccount ?? {}), ...Object.keys(to.byAccount)])];
  const accounts = accountIds
    .map((id): AccountChange => {
      const startValue = from?.byAccount[id] ?? 0;
      const endValue = to.byAccount[id] ?? 0;
      const contribChange = (to.contribByAccount[id] ?? 0) - (from?.contribByAccount[id] ?? 0);
      return { accountId: id, startValue, endValue, contribChange: roundCents(contribChange), gainChange: roundCents(endValue - startValue - contribChange) };
    })
    .filter((a) => a.startValue !== 0 || a.endValue !== 0 || a.contribChange !== 0);

  const keys = [...new Set([...Object.keys(from?.byPosition ?? {}), ...Object.keys(to.byPosition)])];
  const positions = keys.map((key): PositionChange => {
    const [accountId, assetId] = key.split(":") as [string, string];
    const start = from?.byPosition[key] ?? null;
    const end = to.byPosition[key] ?? null;
    return { accountId, assetId, start, end, move: positionMove(start, end) };
  });

  const total = (h: HistoryPoint | null) => (h ? BUCKETS.reduce((t, b) => t + Math.max(0, h.buckets[b]), 0) : 0);
  const startTotal = total(from);
  const endTotal = total(to);
  const buckets = BUCKETS.map((b): BucketChange => {
    const start = Math.max(0, from?.buckets[b] ?? 0);
    const end = Math.max(0, to.buckets[b]);
    return { bucket: b, start, end, startShare: startTotal > 0 ? start / startTotal : 0, endShare: endTotal > 0 ? end / endTotal : 0 };
  }).filter((b) => b.start !== 0 || b.end !== 0);

  return { start: from ? totalsOf(from) : null, end: totalsOf(to), accounts, positions, buckets };
}

// ——— Mois par mois ———

export interface MonthChange {
  month: Month;
  /** Argent apporté net : versements moins retraits (les transferts entre comptes s'annulent). */
  money: number;
  /** Versements bruts du mois : nuls, c'est un mois sans versement. */
  deposits: number;
  /** Ce que les placements ont rapporté (ou fait perdre) dans le mois. */
  gain: number;
}

/** Chaque mois de la période (après `from`, jusqu'à `to` compris) : l'argent apporté et le gain. */
export function monthByMonth(data: EngineData, history: readonly HistoryPoint[], from: Month | null, to: Month): MonthChange[] {
  const ids = data.accounts.map((a) => a.id);
  const out: MonthChange[] = [];
  history.forEach((h, i) => {
    if ((from != null && h.month <= from) || h.month > to) return;
    const c = periodChange(data, i > 0 ? history[i - 1]! : null, h, ids);
    out.push({ month: h.month, money: roundCents(c.flows.deposits - c.flows.withdrawals), deposits: c.flows.deposits, gain: c.sources.total });
  });
  return out;
}

// ——— Par rapport au plan ———

/**
 * Rendement annuel attendu de chaque classe, d'après les réglages de la projection : les quatre lignes de base,
 * puis le rendement saisi sur la ligne de la répartition cible pour les matières premières, l'immobilier, le crowdlending et la crypto.
 * Les liquidités, argent en attente, ne rapportent rien. null : aucun rendement attendu, la classe est supposée ne rien rapporter.
 */
export function expectedRates(params: EngineData["params"]): Record<Bucket, number | null> {
  const line = (key: Bucket) => params.targets.find((l) => l.key === key)?.expectedReturn ?? null;
  return {
    precaution: params.returns.livrets,
    liquidites: 0,
    garanti: params.returns.fondsEuros,
    obligations: params.returns.obligations,
    croissance: params.returns.actions,
    matieres_premieres: line("matieres_premieres"),
    immobilier: line("immobilier"),
    crowdlending: line("crowdlending"),
    speculatif: line("speculatif"),
  };
}

export interface PlanPoint {
  month: Month;
  expected: number;
  actual: number;
}

export interface PlanComparison {
  expectedEnd: number;
  actualEnd: number;
  /** Positif : en avance sur le plan. Égal à `moneyGap + gainGap`. */
  gap: number;
  plannedMoney: number;
  actualMoney: number;
  /** Argent apporté en plus (ou en moins) du calendrier des versements. */
  moneyGap: number;
  expectedGain: number;
  actualGain: number;
  /** Gain des placements au-dessus (ou en dessous) des rendements attendus. */
  gainGap: number;
  path: PlanPoint[];
  /** Classes détenues sans rendement attendu, comptées sans gain dans le plan. */
  unrated: Bucket[];
}

/**
 * Ce que le plan prévoyait pour la période, avec les réglages actuels : la valeur de départ de chaque classe
 * grandit à son rendement attendu, et les versements du calendrier s'y ajoutent chaque mois, dans la classe
 * où le plan place l'argent de leur compte (comme la projection), ainsi que les apports initiaux, point de départ du plan.
 * Les mois déclarés manqués comptent : c'est l'écart d'épargne.
 * null si la période ne contient aucun mois.
 */
export function planComparison(data: EngineData, history: readonly HistoryPoint[], from: Month | null, to: Month): PlanComparison | null {
  const start = from == null ? null : (history.find((h) => h.month === from) ?? null);
  const end = history.find((h) => h.month === to);
  const months = history.filter((h) => (from == null || h.month > from) && h.month <= to);
  if (!end || !months.length) return null;
  const rates = expectedRates(data.params);
  const schedule = new Schedule(data.plans, data.skips, data.params.profile.startMonth, data.params.profile.contributionDay);
  const plan = Object.fromEntries(BUCKETS.map((b) => [b, Math.max(0, start?.buckets[b] ?? 0)])) as Record<Bucket, number>;
  let plannedMoney = 0;
  const path: PlanPoint[] = start ? [{ month: start.month, expected: start.value, actual: start.value }] : [];
  for (const h of months) {
    for (const b of BUCKETS) plan[b] *= Math.pow(1 + (rates[b] ?? 0), 1 / 12);
    // Les apports initiaux sont le point de départ du plan, pas une épargne en plus.
    for (const t of data.transactions) {
      if (t.type !== "apport_initial" || monthOf(t.date) !== h.month || t.date > h.date) continue;
      const account = data.accounts.find((a) => a.id === t.accountId);
      if (!account) continue;
      plan[plannedBucketOf(account)] += t.amount;
      plannedMoney += t.amount;
    }
    // Le mois en cours ne compte son versement qu'une fois son jour passé.
    if (schedule.isPaid(h.month, h.date)) {
      for (const a of data.accounts) {
        const amount = schedule.planned(a.id, h.month);
        if (amount <= 0) continue;
        plan[plannedBucketOf(a)] += amount;
        plannedMoney += amount;
      }
    }
    path.push({ month: h.month, expected: roundCents(BUCKETS.reduce((t, b) => t + plan[b], 0)), actual: h.value });
  }
  const startValue = start?.value ?? 0;
  const expectedEnd = path.at(-1)!.expected;
  const change = periodChange(data, start, end, data.accounts.map((a) => a.id));
  const actualMoney = roundCents(change.flows.deposits - change.flows.withdrawals);
  const expectedGain = roundCents(expectedEnd - startValue - plannedMoney);
  const unrated = BUCKETS.filter((b) => rates[b] == null && months.some((h) => h.buckets[b] > 0));
  return {
    expectedEnd,
    actualEnd: end.value,
    gap: roundCents(end.value - expectedEnd),
    plannedMoney: roundCents(plannedMoney),
    actualMoney,
    moneyGap: roundCents(actualMoney - plannedMoney),
    expectedGain,
    actualGain: change.sources.total,
    gainGap: roundCents(change.sources.total - expectedGain),
    path,
    unrated,
  };
}
