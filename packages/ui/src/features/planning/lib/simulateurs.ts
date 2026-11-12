import {
  addMonths,
  bestRegime,
  reinvestToHorizon,
  simulateBond,
  simulateEquity,
  simulateEuroFund,
  simulateLending,
  simulateSavings,
  type BondSimInput,
  type EquitySimInput,
  type EuroFundSimInput,
  type LendingSimInput,
  type PlanParams,
  type SavingsSimInput,
  type SimComparison,
  type SimResult,
  type SimTax,
  type Tmi,
} from "@hamac/core";

/**
 * Logique de la page Simulateurs, sans React pour pouvoir la tester.
 * Tout l'état tient dans l'adresse de la page : rien n'est enregistré.
 */

export const SIM_KINDS = ["obligation", "actions", "fondsEuros", "pret", "livret"] as const;
export type SimKind = (typeof SIM_KINDS)[number];

export const SIM_KIND_LABELS: Record<SimKind, string> = {
  obligation: "Obligation",
  actions: "ETF et actions",
  fondsEuros: "Fonds euros",
  pret: "Crowdlending",
  livret: "Livret ou compte à terme",
};

/** Dates relatives à aujourd'hui : elles ne sont pas mises dans l'adresse quand elles valent la valeur par défaut. */
interface Inputs {
  obligation: BondSimInput;
  actions: EquitySimInput;
  fondsEuros: EuroFundSimInput;
  pret: LendingSimInput;
  livret: SavingsSimInput;
}

export type SimConfig = { [K in SimKind]: { id: string; kind: K; name: string; input: Inputs[K] } }[SimKind];

export type RegimeChoice = "auto" | "pfu" | "bareme";
export const REGIME_LABELS: Record<RegimeChoice, string> = {
  auto: "Le plus avantageux",
  pfu: "Prélèvement forfaitaire (12,8 %)",
  bareme: "Barème de l'impôt",
};

export interface SimState {
  amount: number;
  /** Même durée pour toutes les simulations, en années ; null : celle de chaque placement. */
  horizon: number | null;
  /** Taux net auquel l'argent reçu avant la fin est replacé (Livret A par défaut). */
  reinvestPct: number;
  regime: RegimeChoice;
  /** null : la tranche réglée dans les paramètres. */
  tmi: Tmi | null;
  couple: boolean | null;
  sims: SimConfig[];
  selected: string;
}

export const TMI_VALUES: readonly Tmi[] = [0, 0.11, 0.3, 0.41, 0.45];
/** Taux du Livret A, exonéré : ce que rapporte sans effort l'argent reçu avant la fin. */
export const DEFAULT_REINVEST = 1.7;
export const MAX_HORIZON = 50;

export function defaultInput<K extends SimKind>(kind: K, today: string): Inputs[K] {
  const all: Inputs = {
    obligation: { pricePct: 90, couponPct: 3, frequency: 1, maturityDate: addMonths(today, 60), buyDate: today, feePct: 0, feeFixed: 0, holdYears: 0, salePricePct: 0 },
    actions: { envelope: "pea", returnPct: 7, dividendPct: 0, feesPct: 0.2, entryFeePct: 0, entryFixed: 0, annualFixed: 0, salePct: 0, saleFixed: 0, years: 10, envelopeAgeYears: 0, startDate: today },
    fondsEuros: { ratePct: 2.5, entryFeePct: 0, years: 8, contractAgeYears: 0, startDate: today },
    pret: { ratePct: 9, months: 36, repayment: "amortissable", defaultPct: 3, startDate: today },
    livret: { kind: "reglemente", ratePct: 1.7, years: 5, startDate: today },
  };
  return all[kind];
}

let counter = 0;
export function newSim(kind: SimKind, today: string, existing: readonly SimConfig[]): SimConfig {
  const same = existing.filter((s) => s.kind === kind).length;
  const name = same ? `${SIM_KIND_LABELS[kind]} ${same + 1}` : SIM_KIND_LABELS[kind];
  return { id: `s${Date.now().toString(36)}${(counter++).toString(36)}`, kind, name, input: defaultInput(kind, today) } as SimConfig;
}

export function defaultState(today: string): SimState {
  const first = newSim("obligation", today, []);
  return { amount: 10_000, horizon: null, reinvestPct: DEFAULT_REINVEST, regime: "auto", tmi: null, couple: null, sims: [first], selected: first.id };
}

// ——— Adresse ———

const toBase64Url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/={1,2}$/, "");
const fromBase64Url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

export function encodeState(state: SimState): string {
  return toBase64Url(JSON.stringify(state));
}

/** Garde chaque champ connu du bon type, et complète le reste avec les valeurs par défaut. */
function cleanInput<K extends SimKind>(kind: K, raw: unknown, today: string): Inputs[K] {
  const base = defaultInput(kind, today) as unknown as Record<string, unknown>;
  const given = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(base)) {
    const g = given[k];
    if (typeof v === "number" && typeof g === "number" && Number.isFinite(g)) out[k] = g;
    if (typeof v === "string" && typeof g === "string" && g.length <= 40) out[k] = g;
  }
  return out as unknown as Inputs[K];
}

export function decodeState(encoded: string | null, today: string): SimState {
  const fallback = defaultState(today);
  if (!encoded) return fallback;
  try {
    const raw = JSON.parse(fromBase64Url(encoded)) as Partial<SimState>;
    const list = Array.isArray(raw.sims) ? raw.sims : [];
    const sims = list
      .filter((s): s is SimConfig => !!s && typeof s === "object" && SIM_KINDS.includes((s as SimConfig).kind))
      .slice(0, 8)
      .map((s, i) => ({ id: typeof s.id === "string" ? s.id : `s${i}`, kind: s.kind, name: typeof s.name === "string" ? s.name.slice(0, 60) : SIM_KIND_LABELS[s.kind], input: cleanInput(s.kind, s.input, today) }) as SimConfig);
    // Une liste vidée volontairement reste vide ; une liste absente ou illisible reprend l'exemple.
    if (!sims.length && list.length) return fallback;
    if (!Array.isArray(raw.sims)) return fallback;
    return {
      amount: typeof raw.amount === "number" && raw.amount > 0 ? raw.amount : fallback.amount,
      horizon: typeof raw.horizon === "number" && raw.horizon >= 1 && raw.horizon <= MAX_HORIZON ? Math.round(raw.horizon) : null,
      reinvestPct: typeof raw.reinvestPct === "number" && raw.reinvestPct >= 0 && raw.reinvestPct <= 20 ? raw.reinvestPct : DEFAULT_REINVEST,
      regime: raw.regime === "pfu" || raw.regime === "bareme" ? raw.regime : "auto",
      tmi: TMI_VALUES.includes(raw.tmi as Tmi) ? (raw.tmi as Tmi) : null,
      couple: typeof raw.couple === "boolean" ? raw.couple : null,
      sims,
      selected: sims.some((s) => s.id === raw.selected) ? raw.selected! : (sims[0]?.id ?? ""),
    };
  } catch {
    return fallback;
  }
}

// ——— Calcul ———

export function taxContext(state: Pick<SimState, "tmi" | "couple">, params: PlanParams): Omit<SimTax, "regime"> {
  return { tmi: state.tmi ?? params.tax.tmi, couple: state.couple ?? params.profile.couple, params };
}

/** Date de départ d'une simulation. */
export function simStart(sim: SimConfig): string {
  return sim.kind === "obligation" ? sim.input.buyDate : sim.input.startDate;
}

/** Avec une durée commune, chaque placement s'y plie : durée remplacée, obligation revendue, prêt arrêté. */
export function withHorizon(sim: SimConfig, years: number | null): SimConfig {
  if (years == null) return sim;
  switch (sim.kind) {
    case "obligation":
      return { ...sim, input: { ...sim.input, holdYears: years } };
    case "actions":
    case "fondsEuros":
    case "livret":
      return { ...sim, input: { ...sim.input, years } } as SimConfig;
    case "pret":
      return sim;
  }
}

function runner(sim: SimConfig, amount: number, horizon: number | null): (tax: SimTax) => SimResult {
  switch (sim.kind) {
    case "obligation":
      return (t) => simulateBond(sim.input, amount, t);
    case "actions":
      return (t) => simulateEquity(sim.input, amount, t);
    case "fondsEuros":
      return (t) => simulateEuroFund(sim.input, amount, t);
    case "pret":
      return (t) => simulateLending(sim.input, amount, t, horizon == null ? null : horizon * 12);
    case "livret":
      return (t) => simulateSavings(sim.input, amount, t);
  }
}

export interface SimOutcome {
  comparison: SimComparison;
  /** Résultat retenu selon le choix d'imposition. */
  shown: SimComparison["best"];
  shownRegime: "pfu" | "bareme";
}

/** Calcule une simulation ; null si ses données ne permettent aucun calcul (échéance passée…). */
export function runSim(sim: SimConfig, amount: number, regime: RegimeChoice, tax: Omit<SimTax, "regime">, horizon: { years: number; reinvestPct: number } | null = null): SimOutcome | null {
  try {
    const run = runner(withHorizon(sim, horizon?.years ?? null), amount, horizon?.years ?? null);
    const end = horizon ? addMonths(simStart(sim), 12 * horizon.years) : null;
    const comparison = bestRegime((t) => {
      const r = run(t);
      return end && horizon ? reinvestToHorizon(r, end, horizon.reinvestPct) : r;
    }, tax);
    if (comparison.pfu.lines.length < 2) return null;
    if (regime === "auto") return { comparison, shown: comparison.best, shownRegime: comparison.bestRegime };
    if (regime === "bareme" && comparison.bareme) return { comparison, shown: comparison.bareme, shownRegime: "bareme" };
    return { comparison, shown: comparison.pfu, shownRegime: "pfu" };
  } catch {
    return null;
  }
}

/** Lignes du détail regroupées par année. Les intérêts qui restent placés comptent pour l'impôt, pas dans l'argent reçu. */
export function linesByYear<T extends { date: string; gross: number; incomeTax: number; social: number; net: number; kept?: boolean }>(lines: readonly T[]): Array<{ year: string; lines: T[]; gross: number; incomeTax: number; social: number; net: number }> {
  const groups = new Map<string, T[]>();
  for (const l of lines) groups.set(l.date.slice(0, 4), [...(groups.get(l.date.slice(0, 4)) ?? []), l]);
  return [...groups.entries()].map(([year, ls]) => ({
    year,
    lines: ls,
    gross: ls.reduce((t, l) => t + (l.kept ? 0 : l.gross), 0),
    incomeTax: ls.reduce((t, l) => t + l.incomeTax, 0),
    social: ls.reduce((t, l) => t + l.social, 0),
    net: ls.reduce((t, l) => t + (l.kept ? 0 : l.net), 0),
  }));
}
