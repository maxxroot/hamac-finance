import { addMonth, type Milestone, type Month, type PeriodChange } from "@hamac/core";
import { capitalize, formatMonth } from "./numbers";

/** Logique d'affichage de la page Historique, sans React pour pouvoir la tester. */

/** Période comparée : de la fin du mois `from` (null = le tout début) au point `to`. */
export interface Range {
  from: Month | null;
  to: Month;
}

export const SHORTCUTS = [
  { key: "1m", label: "1 mois" },
  { key: "1a", label: "1 an" },
  { key: "janvier", label: "Depuis janvier" },
  { key: "debut", label: "Depuis le début" },
] as const;
export type ShortcutKey = (typeof SHORTCUTS)[number]["key"];

/** Départ d'un raccourci, compté depuis le point d'arrivée ; null si l'historique est plus court. */
function shortcutFrom(key: ShortcutKey, to: Month, months: readonly Month[]): Month | null {
  const pick = (m: Month) => (months.includes(m) && m < to ? m : null);
  switch (key) {
    case "1m":
      return pick(addMonth(to, -1));
    case "1a":
      return pick(addMonth(to, -12));
    case "janvier":
      return pick(`${+to.slice(0, 4) - 1}-12`);
    case "debut":
      return null;
  }
}

export function shortcutRange(key: ShortcutKey, to: Month, months: readonly Month[]): Range {
  return { from: shortcutFrom(key, to, months), to };
}

/** Le raccourci qui donne exactement cette période, s'il y en a un (le premier, si plusieurs coïncident). */
export function activeShortcut(range: Range, months: readonly Month[]): ShortcutKey | null {
  return SHORTCUTS.find((s) => shortcutFrom(s.key, range.to, months) === range.from)?.key ?? null;
}

/** Par défaut : la dernière année, ou tout l'historique s'il est plus court. */
export function defaultRange(months: readonly Month[]): Range {
  return shortcutRange("1a", months.at(-1)!, months);
}

/** Lit la période dans l'adresse (`du=2025-03` ou `du=debut`, `au=2026-11`), et retombe sur la valeur par défaut. */
export function parseRange(du: string | null, au: string | null, months: readonly Month[]): Range {
  const fallback = defaultRange(months);
  const to = au && months.includes(au) ? au : fallback.to;
  if (du === "debut") return { from: null, to };
  if (du && months.includes(du) && du < to) return { from: du, to };
  return au ? shortcutRange("1a", to, months) : fallback;
}

export function rangeParams(r: Range): Record<string, string> {
  return { du: r.from ?? "debut", au: r.to };
}

/** « Fin mars 2025 », « Aujourd'hui » pour le dernier point, « Au départ » pour le tout début. */
export function pointLabel(month: Month | null, last: Month): string {
  if (month == null) return "Au départ";
  return month === last ? "Aujourd'hui" : `Fin ${formatMonth(month)}`;
}

/** Libellé court d'une période, pour les titres de cartes. */
export function rangeLabel(r: Range, last: Month): string {
  const to = r.to === last ? "aujourd'hui" : `fin ${formatMonth(r.to)}`;
  return r.from == null ? `Du début à ${to}` : `De fin ${formatMonth(r.from)} à ${to}`;
}

/** Une étape appartient à la période si elle a lieu après le point de départ et au plus tard au point d'arrivée. */
export function inRange(m: Pick<Milestone, "date">, fromDate: string | null, toDate: string): boolean {
  return (fromDate == null || m.date > fromDate) && m.date <= toDate;
}

/** Pour voir ce qui a changé depuis une étape, on part de la fin du mois précédent, afin de l'inclure. */
export function rangeFromMilestone(m: Pick<Milestone, "month">, current: Range, months: readonly Month[]): Range {
  const before = addMonth(m.month, -1);
  const from = months.includes(before) ? before : null;
  const last = months.at(-1)!;
  const to = current.to >= m.month ? current.to : last;
  return { from: from != null && from >= to ? null : from, to };
}

/** Étapes regroupées par année, de la plus récente à la plus ancienne. */
export function byYear<T extends Pick<Milestone, "date">>(items: readonly T[]): Array<{ year: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const m of [...items].sort((a, b) => b.date.localeCompare(a.date))) {
    const y = m.date.slice(0, 4);
    groups.set(y, [...(groups.get(y) ?? []), m]);
  }
  return [...groups.entries()].map(([year, list]) => ({ year, items: list }));
}

// ——— Cascade ———

export type WaterfallKind = "total" | "money" | "gain";

export interface WaterfallRow {
  key: string;
  label: string;
  value: number;
  kind: WaterfallKind;
  /** Position de la barre : de `from` à `to`, dans l'unité des montants. */
  from: number;
  to: number;
}

export interface Waterfall {
  rows: WaterfallRow[];
  /** Argent apporté net, puis gain des placements, sur la période. */
  money: number;
  gain: number;
  lo: number;
  hi: number;
  /** L'échelle ne part pas de zéro : sans cela, les variations seraient invisibles à côté du total. */
  zoomed: boolean;
}

const VISIBLE = 0.005;

/** Lignes de la cascade : la valeur de départ, chaque cause d'écart, la valeur d'arrivée. Les lignes nulles sont omises. */
export function waterfall(c: PeriodChange, startLabel: string | null, endLabel: string): Waterfall {
  const s = c.sources;
  const money: Array<[string, string, number]> = [
    ["versements", "Versements", c.flows.deposits],
    ["transferts-recus", "Transferts reçus", c.flows.transfersIn],
    ["retraits", "Retraits", -c.flows.withdrawals],
    ["transferts-envoyes", "Transferts envoyés", -c.flows.transfersOut],
  ];
  const gains: Array<[string, string, number]> = [
    ["latentes", "Plus-values pas encore encaissées", s.unrealized],
    ["realisees", "Plus-values encaissées", s.realized],
    ["dividendes", "Dividendes", s.dividends],
    ["interets", "Intérêts", s.interests],
    ["frais", "Frais facturés à part", -s.billedFees],
    ["impots", "Impôts prélevés", -s.taxes],
    ["autres", "Corrections et autres", s.other],
  ];
  const rows: WaterfallRow[] = [];
  let run = c.startValue;
  if (startLabel != null) rows.push({ key: "depart", label: startLabel, value: c.startValue, kind: "total", from: 0, to: c.startValue });
  for (const [kind, list] of [["money", money], ["gain", gains]] as const) {
    for (const [key, label, value] of list) {
      if (Math.abs(value) < VISIBLE) continue;
      rows.push({ key, label, value, kind, from: run, to: run + value });
      run += value;
    }
  }
  rows.push({ key: "arrivee", label: endLabel, value: c.endValue, kind: "total", from: 0, to: c.endValue });

  const ends = rows.flatMap((r) => (r.kind === "total" ? [r.to] : [r.from, r.to]));
  const hi = Math.max(0, ...ends);
  const low = Math.min(...rows.filter((r) => r.kind !== "total").flatMap((r) => [r.from, r.to]), c.endValue, startLabel != null ? c.startValue : c.endValue);
  // Variations sous le quart du total : on resserre l'échelle autour d'elles.
  const zoomed = low > 0 && hi > 0 && (hi - low) / hi < 0.25 && rows.some((r) => r.kind !== "total");
  const lo = zoomed ? Math.max(0, low - (hi - low) * 0.6) : Math.min(0, ...ends);
  return {
    rows,
    money: money.reduce((t, [, , v]) => t + v, 0),
    gain: s.total,
    lo,
    hi,
    zoomed,
  };
}

/** Position d'une barre en pourcentage de la largeur. */
export function barSpan(r: Pick<WaterfallRow, "from" | "to" | "kind">, w: Pick<Waterfall, "lo" | "hi">): { left: number; width: number } {
  const span = w.hi - w.lo || 1;
  const a = r.kind === "total" ? w.lo : Math.min(r.from, r.to);
  const b = r.kind === "total" ? r.to : Math.max(r.from, r.to);
  const left = ((Math.max(a, w.lo) - w.lo) / span) * 100;
  const width = Math.max(0.6, ((Math.max(b, w.lo) - Math.max(a, w.lo)) / span) * 100);
  return { left, width: Math.min(width, 100 - left) };
}

export const monthTitle = (m: Month) => capitalize(formatMonth(m));
