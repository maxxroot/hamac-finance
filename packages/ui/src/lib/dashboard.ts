import type { AccountState, Alert, AllocationRow, HistoryPoint } from "@hamac/core";

/** Logique d'affichage du tableau de bord, sans React pour pouvoir la tester. */

export const PERIODS = [
  { key: "3M", months: 3 },
  { key: "1A", months: 12 },
  { key: "3A", months: 36 },
  { key: "Tout", months: null },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

/** Derniers points de la période ; un de plus que le nombre de mois, pour disposer du point de départ. */
export function historyForPeriod(history: readonly HistoryPoint[], period: PeriodKey): HistoryPoint[] {
  const months = PERIODS.find((p) => p.key === period)?.months ?? null;
  return months == null ? [...history] : history.slice(-(months + 1));
}

/** Gain gagné ou perdu depuis la fin du mois précédent : les versements du mois ne comptent pas. */
export function gainSinceLastMonth(history: readonly HistoryPoint[]): { gain: number; since: string } | null {
  const now = history.at(-1);
  const before = history.at(-2);
  return now && before ? { gain: now.gain - before.gain, since: before.month } : null;
}

/** Bande entre le patrimoine et l'argent versé : base transparente, puis épaisseur colorée, valable en gain comme en perte. */
export function gainBand(points: readonly HistoryPoint[]): { base: number[]; band: number[] } {
  return { base: points.map((p) => Math.min(p.value, p.netContrib)), band: points.map((p) => Math.abs(p.value - p.netContrib)) };
}

/** Bas de l'axe, arrondi vers le bas : sur une courbe, partir de zéro écraserait les variations. */
export function axisFloor(points: readonly HistoryPoint[]): number {
  const low = Math.min(...points.flatMap((p) => [p.value, p.netContrib]));
  if (!Number.isFinite(low) || low <= 0) return 0;
  const step = 10 ** Math.floor(Math.log10(low));
  return Math.floor((low * 0.9) / step) * step;
}

/** Seulement ce qui demande une action, les plus graves d'abord (ordre donné par le moteur). */
export function alertsToReview(alerts: readonly Alert[]): Alert[] {
  return alerts.filter((a) => a.level !== "ok");
}

export interface EnvelopeRow {
  key: string;
  name: string;
  value: number;
  /** Longueur de la barre, en % de la plus grande. */
  width: number;
  /** null : rien de versé, ou ligne regroupant plusieurs comptes. */
  gainPct: number | null;
}

/** Comptes par valeur décroissante ; au-delà de `max` lignes, les plus petits sont regroupés. */
export function envelopeRows(accounts: readonly AccountState[], max = 6): EnvelopeRow[] {
  const held = accounts.filter((a) => a.value > 0).sort((a, b) => b.value - a.value);
  const largest = held[0]?.value ?? 0;
  const row = (key: string, name: string, value: number, gainPct: number | null): EnvelopeRow => ({ key, name, value, width: largest > 0 ? (value / largest) * 100 : 0, gainPct });
  const fits = held.length <= max;
  const shown = fits ? held : held.slice(0, max - 1);
  const rest = fits ? [] : held.slice(max - 1);
  const rows = shown.map((a) => row(a.account.id, a.account.name, a.value, a.netContrib > 0 ? a.gain / a.netContrib : null));
  if (rest.length) rows.push(row("autres", `${rest.length} autres comptes`, rest.reduce((s, a) => s + a.value, 0), null));
  return rows;
}

export interface AllocationBar {
  row: AllocationRow;
  /** Longueur de la barre et position du repère de cible, sur une échelle commune en %. */
  width: number;
  targetAt: number;
}

export function allocationBars(rows: readonly AllocationRow[]): AllocationBar[] {
  const scale = Math.max(0, ...rows.flatMap((r) => [r.share, r.target]));
  const at = (v: number) => (scale > 0 ? (Math.max(0, v) / scale) * 100 : 0);
  return rows.map((row) => ({ row, width: at(row.share), targetAt: at(row.target) }));
}
