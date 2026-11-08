import type { BondTerms } from "./bonds";
import { accruedFraction, heldToMaturityValue, yieldToMaturity } from "./bonds";
import { addMonths, monthsBetween, yearsBetween } from "./dates";
import {
  ASSET_BUCKET,
  cashInAllocation,
  positionInAllocation,
  BUCKETS,
  CASH_BUCKET,
  type Account,
  type AccountKind,
  type Asset,
  type BondPlan,
  type Bucket,
  type ContributionPlan,
  type ContributionSkip,
  type FundRate,
  type PricePoint,
  type Statement,
  type Transaction,
  type TxType,
} from "./domain";
import { formatEur, roundCents } from "./money";
import type { Institution } from "./institutions";
import { ageInYear, classEnabled, classLabel, classTargets, type PlanParams } from "./params";
import { crowdProjectState, type CrowdProject, type CrowdProjectState } from "./crowdlending";
import { loanState, propertyValue, type Loan, type LoanState, type Property } from "./realestate";
import { PriceBook } from "./prices";
import { Schedule, monthOf } from "./schedule";
import { type Flow, xirr, daysBetween } from "./xirr";

/** Données brutes nécessaires au calcul (= l'espace de travail). */
export interface EngineData {
  params: PlanParams;
  accounts: readonly Account[];
  assets: readonly Asset[];
  transactions: readonly Transaction[];
  plans: readonly ContributionPlan[];
  skips: readonly ContributionSkip[];
  statements?: readonly Statement[];
  fundRates?: readonly FundRate[];
  bondPlans?: readonly BondPlan[];
  properties?: readonly Property[];
  crowdProjects?: readonly CrowdProject[];
  loans?: readonly Loan[];
  /** Historique des cours (ou au moins le dernier cours de chaque titre). */
  prices: readonly PricePoint[];
  /** Établissements et leurs grilles de frais (facultatif). */
  institutions?: readonly Institution[];
}

export type PriceUsed = "marche" | "manuel" | "modele" | "cout";

export interface BondInfo {
  terms: BondTerms;
  nominal: number;
  annualCoupon: number;
  accrued: number;
  /** Rendement actuariel de l'achat (frais compris), moyenne pondérée des lots. */
  ytm: number | null;
  yearsLeft: number;
  ageAtMaturity: number;
  matured: boolean;
}

export interface PositionState {
  asset: Asset;
  accountId: string;
  quantity: number;
  /** Prix de revient restant (frais compris). */
  cost: number;
  /** Prix de revient unitaire (PRU / PMP). */
  pru: number;
  price: number | null;
  priceDate: string | null;
  priceUsed: PriceUsed;
  value: number;
  gain: number;
  gainPct: number;
  realizedGain: number;
  feesPaid: number;
  income: number;
  bucket: Bucket;
  /** Classe personnalisée de ce titre, si elle existe encore. */
  classId: string | null;
  /** Compte dans l'allocation cible. */
  inAllocation: boolean;
  bond: BondInfo | null;
}

export interface AccountState {
  account: Account;
  cash: number;
  positions: PositionState[];
  /** Obligations arrivées à échéance (pour l'échelle). */
  maturedBonds: PositionState[];
  positionsValue: number;
  value: number;
  initial: number;
  scheduledPaid: number;
  currentMonthly: number;
  netContrib: number;
  gain: number;
  interests: number;
  dividends: number;
  fees: number;
  corrections: number;
  realizedGain: number;
  byBucket: Partial<Record<Bucket, number>>;
  /** Crowdlending : état de chaque projet commencé. */
  crowdProjects: CrowdProjectState[];
  lastStatement: Statement | null;
  statementGap: number | null;
}

export interface AllocationRow {
  /** La classe de base, ou l'identifiant de la classe personnalisée. */
  key: string;
  /** Classe de base ; null pour une classe créée par l'utilisateur. */
  bucket: Bucket | null;
  label: string;
  /** Couleur d'une classe personnalisée ; null = couleur de la classe de base. */
  color: string | null;
  value: number;
  share: number;
  target: number;
  drift: number;
  action: "ok" | "renforcer" | "alleger";
}

export interface PerformanceRow {
  key: string;
  label: string;
  value: number;
  netContrib: number;
  gain: number;
  gainPct: number;
  /** TRI annualisé ; null si moins d'un an d'historique ou incalculable. */
  irr: number | null;
  irrReason: string | null;
  assumption: number | null;
}

export interface PortfolioState {
  asOf: string;
  age: number;
  accounts: AccountState[];
  accountById: Map<string, AccountState>;
  totals: { value: number; netContrib: number; gain: number; monthly: number; cash: number };
  buckets: Record<Bucket, number>;
  allocation: { invested: number; rows: AllocationRow[] };
  /** Patrimoine financier + biens immobiliers (part détenue) − capital restant dû des crédits. */
  netWorth: { financial: number; realEstate: number; debts: number; net: number; monthlyLoans: number; loans: LoanState[] };
  livrets: {
    total: number;
    floor: number;
    ceiling: number;
    status: "sous_plancher" | "ok" | "au_dessus";
    excess: number;
  };
  performance: PerformanceRow[];
  warnings: string[];
}

// ——— Reconstitution chronologique ———

interface Lot {
  qty: number;
  cost: number;
  date: string;
  clean: number;
}

interface PosAcc {
  asset: Asset;
  qty: number;
  cost: number;
  realized: number;
  fees: number;
  income: number;
  lots: Lot[];
  matured: boolean;
}

interface AccAcc {
  cash: number;
  initial: number;
  contrib: number;
  interests: number;
  dividends: number;
  fees: number;
  corrections: number;
  positions: Map<string, PosAcc>;
}

type Event =
  | { kind: "tx"; date: string; rank: number; tx: Transaction; side: "from" | "to" }
  | { kind: "maturity"; date: string; rank: number; accountId: string; assetId: string };

const RANK: Record<TxType, number> = {
  apport_initial: 0,
  versement: 1,
  transfert: 2,
  interets: 3,
  dividende: 4,
  correction: 5,
  vente: 6,
  achat: 7,
  retrait: 8,
  frais: 9,
};

export function bondTerms(asset: Asset): BondTerms | null {
  if (asset.kind !== "obligation" || asset.couponRate == null || !asset.maturityDate) return null;
  return { couponRate: asset.couponRate, maturityDate: asset.maturityDate, frequency: asset.couponFrequency ?? 1 };
}

function newAcc(): AccAcc {
  return { cash: 0, initial: 0, contrib: 0, interests: 0, dividends: 0, fees: 0, corrections: 0, positions: new Map() };
}

function position(acc: AccAcc, asset: Asset): PosAcc {
  let p = acc.positions.get(asset.id);
  if (!p) {
    p = { asset, qty: 0, cost: 0, realized: 0, fees: 0, income: 0, lots: [], matured: false };
    acc.positions.set(asset.id, p);
  }
  return p;
}

export function computePortfolio(data: EngineData, asOf: string): PortfolioState {
  const { params } = data;
  const warnings: string[] = [];
  const assetById = new Map(data.assets.map((a) => [a.id, a]));
  const accs = new Map<string, AccAcc>(data.accounts.map((a) => [a.id, newAcc()]));
  const schedule = new Schedule(data.plans, data.skips, params.profile.startMonth, params.profile.contributionDay);
  const book = new PriceBook(data.prices, data.assets);

  // Événements jusqu'à la date de calcul, + remboursements d'obligations échues.
  const events: Event[] = [];
  for (const tx of data.transactions) {
    if (tx.date > asOf) continue;
    events.push({ kind: "tx", date: tx.date, rank: RANK[tx.type], tx, side: "from" });
    if (tx.type === "transfert" && tx.counterAccountId) events.push({ kind: "tx", date: tx.date, rank: RANK.transfert, tx, side: "to" });
  }
  const bondHolders = new Set<string>();
  for (const tx of data.transactions) {
    const a = tx.assetId ? assetById.get(tx.assetId) : null;
    if (tx.date <= asOf && a?.kind === "obligation" && a.maturityDate && a.maturityDate <= asOf) bondHolders.add(`${tx.accountId}|${a.id}`);
  }
  for (const key of bondHolders) {
    const [accountId, assetId] = key.split("|");
    events.push({ kind: "maturity", date: assetById.get(assetId)!.maturityDate!, rank: 10, accountId, assetId });
  }
  events.sort((x, y) => (x.date === y.date ? x.rank - y.rank : x.date.localeCompare(y.date)));

  for (const ev of events) {
    if (ev.kind === "maturity") {
      const acc = accs.get(ev.accountId);
      const p = acc?.positions.get(ev.assetId);
      if (!acc || !p || p.qty <= 1e-9) continue;
      acc.cash += p.qty; // remboursement du nominal à 100 %
      p.realized += p.qty - p.cost;
      p.qty = 0;
      p.cost = 0;
      p.lots = [];
      p.matured = true;
      continue;
    }
    const { tx, side } = ev;
    const acc = accs.get(side === "to" ? tx.counterAccountId! : tx.accountId);
    if (!acc) continue;
    const asset = tx.assetId ? assetById.get(tx.assetId) : undefined;
    switch (tx.type) {
      case "apport_initial":
        acc.cash += tx.amount;
        acc.initial += tx.amount;
        acc.contrib += tx.amount;
        break;
      case "versement":
        acc.cash += tx.amount;
        acc.contrib += tx.amount;
        break;
      case "retrait":
        acc.cash -= tx.amount;
        acc.contrib -= tx.amount;
        break;
      case "transfert":
        if (side === "from") {
          acc.cash -= tx.amount;
          acc.contrib -= tx.amount;
        } else {
          acc.cash += tx.amount;
          acc.contrib += tx.amount;
        }
        break;
      case "interets":
        acc.cash += tx.amount;
        acc.interests += tx.amount;
        if (asset) position(acc, asset).income += tx.amount;
        break;
      case "dividende":
        acc.cash += tx.amount;
        acc.dividends += tx.amount;
        if (asset) position(acc, asset).income += tx.amount;
        break;
      case "frais":
        acc.cash -= tx.amount;
        acc.fees += tx.amount;
        break;
      case "correction":
        acc.cash += tx.amount;
        acc.corrections += tx.amount;
        break;
      case "achat": {
        if (!asset || !tx.quantity) break;
        const p = position(acc, asset);
        acc.cash -= tx.amount;
        p.qty += tx.quantity;
        p.cost += tx.amount;
        p.fees += tx.fee ?? 0;
        acc.fees += tx.fee ?? 0;
        const terms = bondTerms(asset);
        if (terms) {
          const clean = (tx.amount - (tx.fee ?? 0)) / tx.quantity - accruedFraction(terms, tx.date);
          p.lots.push({ qty: tx.quantity, cost: tx.amount, date: tx.date, clean });
        }
        break;
      }
      case "vente": {
        if (!asset || !tx.quantity) break;
        const p = position(acc, asset);
        acc.cash += tx.amount;
        p.fees += tx.fee ?? 0;
        acc.fees += tx.fee ?? 0;
        if (tx.quantity > p.qty + 1e-9) {
          warnings.push(`Vente du ${tx.date} : ${tx.quantity} « ${asset.name} » vendus, mais seulement ${roundQty(p.qty)} détenus.`);
        }
        const sold = Math.min(tx.quantity, p.qty);
        const frac = p.qty > 0 ? sold / p.qty : 0;
        const costOut = p.cost * frac;
        p.realized += tx.amount - costOut;
        p.cost -= costOut;
        p.qty -= sold;
        for (const lot of p.lots) {
          lot.cost *= 1 - frac;
          lot.qty *= 1 - frac;
        }
        if (p.qty < 1e-9) {
          p.qty = 0;
          p.cost = 0;
          p.lots = [];
        }
        break;
      }
    }
  }

  // ——— Valorisation ———
  const age = ageInYear(params, +asOf.slice(0, 4));
  const accountStates: AccountState[] = [];
  const buckets = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>;
  // Allocation cible : uniquement les éléments inclus (par défaut ou par choix).
  const allocated = new Map<string, number>();
  const allocate = (key: string, value: number) => allocated.set(key, (allocated.get(key) ?? 0) + value);
  const enabled = (key: string) => classEnabled(params, key);

  for (const account of data.accounts) {
    const acc = accs.get(account.id)!;
    const scheduledPaid = schedule.paidTotal(account.id, asOf);
    const currentMonthly = schedule.current(account.id, asOf);
    // Crowdlending : l'argent investi quitte les espèces et y revient à mesure des remboursements.
    const crowdProjects = (data.crowdProjects ?? []).filter((c) => c.accountId === account.id && c.startDate <= asOf).map((c) => crowdProjectState(c, asOf));
    const crowdValue = roundCents(crowdProjects.reduce((s, c) => s + c.value, 0));
    const crowdNet = crowdProjects.reduce((s, c) => s + c.project.amount - c.repaid, 0);
    const cash = roundCents(acc.cash + scheduledPaid - crowdNet);
    const positions: PositionState[] = [];
    const maturedBonds: PositionState[] = [];
    for (const p of acc.positions.values()) {
      const state = valuePosition(p, account, asOf, book, params);
      if (p.qty > 1e-12) positions.push(state);
      else if (p.matured) maturedBonds.push(state);
    }
    positions.sort((a, b) => b.value - a.value);
    const positionsValue = roundCents(positions.reduce((s, p) => s + p.value, 0));
    const value = roundCents(cash + positionsValue + crowdValue);
    const netContrib = roundCents(acc.contrib + scheduledPaid);
    const byBucket: Partial<Record<Bucket, number>> = {};
    const cashBucket = CASH_BUCKET[account.kind];
    byBucket[cashBucket] = cash;
    for (const p of positions) byBucket[p.bucket] = (byBucket[p.bucket] ?? 0) + p.value;
    if (crowdValue) byBucket.crowdlending = (byBucket.crowdlending ?? 0) + crowdValue;
    if (!account.archived || value !== 0) {
      for (const [b, v] of Object.entries(byBucket)) buckets[b as Bucket] += v ?? 0;
      if (cash !== 0 && cashInAllocation(account, enabled)) allocate(cashBucket, cash);
      for (const p of positions) if (p.inAllocation) allocate(p.classId ?? p.bucket, p.value);
      for (const c of crowdProjects) if (c.project.inAllocation ?? account.inAllocation ?? enabled("crowdlending")) allocate("crowdlending", c.value);
    }
    if (cash < -0.01) warnings.push(`Espèces négatives sur « ${account.name} » (${formatEur(cash)}) : un versement manque probablement dans le journal.`);

    const statements = (data.statements ?? []).filter((s) => s.accountId === account.id && s.date <= asOf).sort((a, b) => b.date.localeCompare(a.date));
    const lastStatement = statements[0] ?? null;

    accountStates.push({
      account,
      cash,
      positions,
      maturedBonds,
      positionsValue,
      value,
      initial: roundCents(acc.initial),
      scheduledPaid,
      currentMonthly,
      netContrib,
      gain: roundCents(value - netContrib),
      interests: roundCents(acc.interests),
      dividends: roundCents(acc.dividends),
      fees: roundCents(acc.fees),
      corrections: roundCents(acc.corrections),
      realizedGain: roundCents([...acc.positions.values()].reduce((s, p) => s + p.realized, 0)),
      byBucket,
      crowdProjects,
      lastStatement,
      statementGap: lastStatement ? roundCents(lastStatement.value - value) : null,
    });
  }
  for (const b of BUCKETS) buckets[b] = roundCents(buckets[b]);

  // ——— Allocation de la partie investie ———
  const properties = (data.properties ?? []).filter((x) => !x.archived);
  for (const x of properties) {
    const key = params.customClasses.find((c) => c.id === x.classId)?.id ?? "immobilier";
    if (x.inAllocation ?? enabled(key)) allocate(key, propertyValue(x));
  }
  const invested = [...allocated.values()].reduce((s, v) => s + v, 0);
  const targetsNow = classTargets(params, age);
  // Une classe hors allocation apparaît quand même si un de ses éléments y est inclus.
  const rowKeys = [...new Set([...targetsNow.filter((t) => t.inAllocation).map((t) => t.key), ...allocated.keys()])];
  const rows: AllocationRow[] = rowKeys
    .map((key): AllocationRow => {
      const custom = params.customClasses.find((c) => c.id === key);
      const value = roundCents(allocated.get(key) ?? 0);
      const target = targetsNow.find((t) => t.key === key)?.target ?? 0;
      const share = invested > 0 ? value / invested : 0;
      const drift = share - target;
      const action = invested <= 0 ? "renforcer" : drift > params.livrets.driftAlert ? "alleger" : drift < -params.livrets.driftAlert ? "renforcer" : "ok";
      return { key, bucket: custom ? null : (key as Bucket), label: classLabel(params, key), color: custom?.color ?? null, value, share, target, drift, action };
    })
    .filter((r) => r.target > 0 || r.value !== 0);

  // ——— Livrets ———
  const livretsTotal = roundCents(accountStates.filter((s) => s.account.kind === "livret").reduce((s, a) => s + a.value, 0));
  const { floor, ceiling } = params.livrets;

  const active = accountStates.filter((s) => !s.account.archived || s.value !== 0);
  const totals = {
    value: roundCents(active.reduce((s, a) => s + a.value, 0)),
    netContrib: roundCents(active.reduce((s, a) => s + a.netContrib, 0)),
    gain: 0,
    monthly: roundCents(active.reduce((s, a) => s + a.currentMonthly, 0)),
    cash: roundCents(active.reduce((s, a) => s + a.cash, 0)),
  };
  totals.gain = roundCents(totals.value - totals.netContrib);

  const realEstate = roundCents(properties.reduce((s, x) => s + propertyValue(x), 0));
  const loans = (data.loans ?? []).filter((l) => !l.archived).map((l) => loanState(l, asOf));
  const debts = roundCents(loans.reduce((s, l) => s + l.balance, 0));

  const state: PortfolioState = {
    asOf,
    age,
    accounts: accountStates,
    accountById: new Map(accountStates.map((s) => [s.account.id, s])),
    totals,
    buckets,
    allocation: { invested: roundCents(invested), rows },
    netWorth: { financial: totals.value, realEstate, debts, net: roundCents(totals.value + realEstate - debts), monthlyLoans: roundCents(loans.reduce((s, l) => s + l.monthly, 0)), loans },
    livrets: {
      total: livretsTotal,
      floor,
      ceiling,
      status: livretsTotal < floor ? "sous_plancher" : livretsTotal > ceiling ? "au_dessus" : "ok",
      excess: roundCents(Math.max(0, livretsTotal - ceiling)),
    },
    performance: [],
    warnings,
  };
  state.performance = computePerformance(data, state, schedule);
  return state;
}

function roundQty(q: number): string {
  return String(Math.round(q * 1e8) / 1e8).replace(".", ",");
}

function valuePosition(p: PosAcc, account: Account, asOf: string, book: PriceBook, params: PlanParams): PositionState {
  const accountId = account.id;
  const { asset } = p;
  const custom = params.customClasses.find((c) => c.id === asset.classId);
  const inAllocation = positionInAllocation(asset, account, custom?.id ?? ASSET_BUCKET[asset.kind], (key) => classEnabled(params, key));
  const terms = bondTerms(asset);
  let price: number | null = null;
  let priceDate: string | null = null;
  let priceUsed: PriceUsed = "cout";
  let value = p.cost;
  let bond: BondInfo | null = null;

  if (terms) {
    const point = asset.priceSource === "manuel" ? book.at(asset.id, asOf) : null;
    const accrued = accruedFraction(terms, asOf);
    if (point) {
      price = point.price;
      priceDate = point.date;
      priceUsed = "manuel";
      value = p.qty * (point.price / 100 + accrued);
    } else if (p.lots.length) {
      priceUsed = "modele";
      value = p.lots.reduce((s, l) => s + l.qty * heldToMaturityValue(terms, l.date, l.clean, asOf), 0);
      price = p.qty > 0 ? ((value / p.qty - accrued) * 100) : null;
      priceDate = asOf;
    }
    const nominal = p.qty;
    const ytmNum = p.lots.reduce((s, l) => {
      const y = yieldToMaturity(terms, l.date, l.cost / l.qty);
      return y == null ? s : s + y * l.cost;
    }, 0);
    const ytmDen = p.lots.reduce((s, l) => (yieldToMaturity(terms, l.date, l.cost / l.qty) == null ? s : s + l.cost), 0);
    bond = {
      terms,
      nominal,
      annualCoupon: roundCents(nominal * terms.couponRate),
      accrued: roundCents(nominal * accrued),
      ytm: ytmDen > 0 ? ytmNum / ytmDen : null,
      yearsLeft: Math.max(0, daysBetween(asOf, terms.maturityDate) / 365.25),
      ageAtMaturity: ageInYear(params, +terms.maturityDate.slice(0, 4)),
      matured: p.matured || terms.maturityDate <= asOf,
    };
  } else {
    const point = book.at(asset.id, asOf);
    if (point) {
      price = point.price;
      priceDate = point.date;
      priceUsed = point.source === "manuel" ? "manuel" : "marche";
      value = p.qty * point.price;
    }
  }
  value = roundCents(value);
  const cost = roundCents(p.cost);
  return {
    asset,
    accountId,
    quantity: p.qty,
    cost,
    pru: p.qty > 0 ? p.cost / p.qty : 0,
    price,
    priceDate,
    priceUsed,
    value,
    gain: roundCents(value - cost),
    gainPct: cost > 0 ? (value - cost) / cost : 0,
    realizedGain: roundCents(p.realized),
    feesPaid: roundCents(p.fees),
    income: roundCents(p.income),
    bucket: ASSET_BUCKET[asset.kind],
    classId: inAllocation ? (custom?.id ?? null) : null,
    inAllocation,
    bond,
  };
}

// ——— Performance (TRI) ———

export const PERF_GROUPS: Array<{ key: string; label: string; kinds: AccountKind[]; assumption: (p: PlanParams) => number | null }> = [
  { key: "livret", label: "Livrets", kinds: ["livret"], assumption: (p) => p.returns.livrets },
  { key: "assurance_vie", label: "Assurance-vie", kinds: ["assurance_vie"], assumption: (p) => p.returns.fondsEuros },
  { key: "cto", label: "Compte-titres", kinds: ["cto"], assumption: (p) => p.returns.obligations },
  { key: "pea", label: "PEA", kinds: ["pea", "pea_pme"], assumption: (p) => p.returns.actions },
  { key: "per", label: "PER", kinds: ["per"], assumption: () => null },
  { key: "epargne_salariale", label: "Épargne salariale", kinds: ["epargne_salariale"], assumption: () => null },
  { key: "crowdlending", label: "Crowdlending", kinds: ["crowdlending"], assumption: () => null },
  { key: "crypto", label: "Crypto", kinds: ["crypto"], assumption: () => null },
];

/** Flux d'apports et de retraits d'un ensemble de comptes (transferts internes à l'ensemble ignorés). */
export function contributionFlows(data: EngineData, accountIds: ReadonlySet<string>, asOf: string, schedule: Schedule, includeTransfers: boolean): Flow[] {
  const flows: Flow[] = [];
  for (const tx of data.transactions) {
    if (tx.date > asOf) continue;
    const inFrom = accountIds.has(tx.accountId);
    if (tx.type === "transfert") {
      if (!includeTransfers) continue;
      const inTo = tx.counterAccountId ? accountIds.has(tx.counterAccountId) : false;
      if (inFrom && !inTo) flows.push({ date: tx.date, amount: tx.amount });
      if (!inFrom && inTo) flows.push({ date: tx.date, amount: -tx.amount });
      continue;
    }
    if (!inFrom) continue;
    if (tx.type === "apport_initial" || tx.type === "versement") flows.push({ date: tx.date, amount: -tx.amount });
    if (tx.type === "retrait") flows.push({ date: tx.date, amount: tx.amount });
  }
  for (const id of accountIds) for (const f of schedule.paidFlows(id, asOf)) flows.push({ date: f.date, amount: -f.amount });
  return flows;
}

function irrOf(flows: Flow[], value: number, asOf: string): { irr: number | null; reason: string | null } {
  if (value <= 0) return { irr: null, reason: "Valeur nulle" };
  if (!flows.length) return { irr: null, reason: "Aucun versement" };
  const first = flows.reduce((m, f) => (f.date < m ? f.date : m), flows[0].date);
  if (daysBetween(first, asOf) < 365) return { irr: null, reason: "Moins d'un an d'historique" };
  const irr = xirr([...flows, { date: asOf, amount: value }]);
  return irr == null ? { irr: null, reason: "Incalculable" } : { irr, reason: null };
}

function computePerformance(data: EngineData, state: PortfolioState, schedule: Schedule): PerformanceRow[] {
  const rows: PerformanceRow[] = [];
  for (const g of PERF_GROUPS) {
    const members = state.accounts.filter((a) => g.kinds.includes(a.account.kind));
    if (!members.length) continue;
    const ids = new Set(members.map((m) => m.account.id));
    const value = roundCents(members.reduce((s, m) => s + m.value, 0));
    const netContrib = roundCents(members.reduce((s, m) => s + m.netContrib, 0));
    const { irr, reason } = irrOf(contributionFlows(data, ids, state.asOf, schedule, true), value, state.asOf);
    rows.push({ key: g.key, label: g.label, value, netContrib, gain: roundCents(value - netContrib), gainPct: netContrib > 0 ? (value - netContrib) / netContrib : 0, irr, irrReason: reason, assumption: g.assumption(data.params) });
  }
  const all = new Set(state.accounts.map((a) => a.account.id));
  const { irr, reason } = irrOf(contributionFlows(data, all, state.asOf, schedule, false), state.totals.value, state.asOf);
  const nonCrypto = rows.filter((r) => r.assumption != null);
  const wSum = nonCrypto.reduce((s, r) => s + r.value, 0);
  rows.push({
    key: "total",
    label: "Total",
    value: state.totals.value,
    netContrib: state.totals.netContrib,
    gain: state.totals.gain,
    gainPct: state.totals.netContrib > 0 ? state.totals.gain / state.totals.netContrib : 0,
    irr,
    irrReason: reason,
    assumption: wSum > 0 ? nonCrypto.reduce((s, r) => s + r.value * (r.assumption ?? 0), 0) / wSum : null,
  });
  return rows;
}

// ——— Aides pour les pages ———

/** Rendement annualisé d'un compte, pertes comprises (TRI) ; null si l'historique est trop court. */
export function accountIrr(data: EngineData, state: PortfolioState, accountId: string): { irr: number | null; reason: string | null } {
  const { params } = data;
  const schedule = new Schedule(data.plans, data.skips, params.profile.startMonth, params.profile.contributionDay);
  const value = state.accountById.get(accountId)?.value ?? 0;
  return irrOf(contributionFlows(data, new Set([accountId]), state.asOf, schedule, true), value, state.asOf);
}

/** Mois de versements écoulés depuis le début du calendrier, mois en cours compris (Paramètres!B12). */
export function monthsElapsed(params: PlanParams, asOf: string): number {
  const start = `${params.profile.startMonth}-01`;
  if (asOf < start) return 0;
  return monthsBetween(start, asOf) + 1;
}

/** Achat d'actions conseillé ce mois-ci : étale les espèces du PEA sur la durée choisie (Actions!B17). */
export function advisedMonthlyPurchase(cash: number, monthsToInvest: number | null, elapsed: number): number {
  if (cash <= 0) return 0;
  const n = monthsToInvest ?? 1;
  if (elapsed >= n) return roundCents(cash);
  return roundCents(cash / Math.max(1, n - elapsed));
}

/** Répartit un montant à investir entre titres pour se rapprocher des parts cibles. */
export function splitByTarget(amount: number, positions: ReadonlyArray<{ assetId: string; value: number; target: number }>): Map<string, number> {
  const out = new Map<string, number>();
  const withTarget = positions.filter((p) => p.target > 0);
  if (amount <= 0 || !withTarget.length) return out;
  const totalAfter = withTarget.reduce((s, p) => s + p.value, 0) + amount;
  const gaps = withTarget.map((p) => ({ id: p.assetId, gap: Math.max(0, p.target * totalAfter - p.value) }));
  const gapSum = gaps.reduce((s, g) => s + g.gap, 0);
  for (const g of gaps) out.set(g.id, roundCents(gapSum > 0 ? (amount * g.gap) / gapSum : amount / gaps.length));
  return out;
}

/** Date anniversaire fiscale (PEA 5 ans = 60 mois, assurance-vie 8 ans = 96 mois). */
export function fiscalAnniversary(openedOn: string | null, years: number): string | null {
  return openedOn ? addMonths(openedOn, years * 12) : null;
}

export function accountAgeYears(openedOn: string | null, asOf: string): number | null {
  return openedOn ? yearsBetween(openedOn, asOf) : null;
}

export { monthOf };
