import type { AccountState, Alert, AllocationRow, HistoryPoint } from "@hamac/core";

/** Logique d'affichage du tableau de bord, sans React pour pouvoir la tester. */

export const PERIODS = [
  { key: "3M", months: 3 },
  { key: "1A", months: 12 },
  { key: "3A", months: 36 },
  { key: "Tout", months: null },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export type EvolutionPoint = Pick<HistoryPoint, "month" | "value" | "netContrib" | "gain">;

/** Historique d'un ou plusieurs comptes additionnés, à partir de leur premier mois non vide. */
export function accountHistory(history: readonly HistoryPoint[], accountIds: readonly string[]): EvolutionPoint[] {
  const sum = (byId: Record<string, number>) => accountIds.reduce((s, id) => s + (byId[id] ?? 0), 0);
  return fromFirstMonth(
    history.map((h) => {
      const value = sum(h.byAccount);
      const netContrib = sum(h.contribByAccount);
      return { month: h.month, value, netContrib, gain: value - netContrib };
    }),
  );
}

/** Retire les mois d'avant la première donnée. */
function fromFirstMonth(points: EvolutionPoint[]): EvolutionPoint[] {
  const first = points.findIndex((p) => p.value !== 0 || p.netContrib !== 0);
  return first < 0 ? [] : points.slice(first);
}

/** Historique d'un titre dans un compte : le montant investi est son prix de revient. */
export function positionHistory(history: readonly HistoryPoint[], accountId: string, assetId: string): EvolutionPoint[] {
  const key = `${accountId}:${assetId}`;
  return fromFirstMonth(
    history.map((h) => {
      const { value = 0, cost = 0 } = h.byPosition[key] ?? {};
      return { month: h.month, value, netContrib: cost, gain: value - cost };
    }),
  );
}

export interface AssetLine {
  key: string;
  name: string;
  /** Une valeur par point de l'évolution du compte. */
  values: number[];
}

/** Courbes affichées au plus : au-delà, les plus petits titres sont regroupés. */
const MAX_ASSET_LINES = 5;

/** Une courbe par titre du ou des comptes, plus les espèces : leur somme redonne la valeur totale. */
export function assetLines(history: readonly HistoryPoint[], points: readonly EvolutionPoint[], accountIds: readonly string[], nameOf: (assetId: string) => string): AssetLine[] {
  const byMonth = new Map(history.map((h) => [h.month, h]));
  const months = points.map((p) => byMonth.get(p.month));
  const assets = new Set<string>();
  const valueOf = (h: HistoryPoint | undefined, assetId: string) => accountIds.reduce((s, id) => s + (h?.byPosition[`${id}:${assetId}`]?.value ?? 0), 0);
  for (const h of months) {
    for (const key of Object.keys(h?.byPosition ?? {})) {
      const [accountId, assetId] = key.split(":");
      if (accountIds.includes(accountId!)) assets.add(assetId!);
    }
  }
  if (!assets.size) return [];
  const all = [...assets]
    .map((id) => ({ key: id, name: nameOf(id), values: months.map((h) => valueOf(h, id)) }))
    .sort((a, b) => (b.values.at(-1) ?? 0) - (a.values.at(-1) ?? 0));
  const lines: AssetLine[] = all.length <= MAX_ASSET_LINES ? all : all.slice(0, MAX_ASSET_LINES - 1);
  if (all.length > MAX_ASSET_LINES) {
    const rest = all.slice(MAX_ASSET_LINES - 1);
    lines.push({ key: "autres", name: `${rest.length} autres titres`, values: points.map((_, i) => rest.reduce((s, l) => s + l.values[i]!, 0)) });
  }
  const cash = points.map((p, i) => p.value - all.reduce((s, l) => s + l.values[i]!, 0));
  if (cash.some((v) => Math.abs(v) >= 1)) lines.push({ key: "especes", name: "Espèces", values: cash });
  return lines;
}

/**
 * Une courbe par compte, la plus grosse d'abord : leur somme redonne la valeur totale.
 * Les comptes restés vides sur tout l'historique sont omis ; deux comptes du même nom sont numérotés.
 */
export function accountLines(history: readonly HistoryPoint[], points: readonly EvolutionPoint[], accounts: readonly { id: string; name: string }[]): AssetLine[] {
  const byMonth = new Map(history.map((h) => [h.month, h]));
  const months = points.map((p) => byMonth.get(p.month));
  const seen = new Map<string, number>();
  return accounts
    .map((a) => ({ key: a.id, name: a.name, values: months.map((h) => h?.byAccount[a.id] ?? 0) }))
    .filter((l) => l.values.some((v) => Math.abs(v) >= 1))
    .sort((a, b) => (b.values.at(-1) ?? 0) - (a.values.at(-1) ?? 0))
    .map((l) => {
      const n = (seen.get(l.name) ?? 0) + 1;
      seen.set(l.name, n);
      return n > 1 ? { ...l, name: `${l.name} (${n})` } : l;
    });
}

/** Derniers points de la période ; un de plus que le nombre de mois, pour disposer du point de départ. */
export function historyForPeriod<T>(history: readonly T[], period: PeriodKey): T[] {
  const months = PERIODS.find((p) => p.key === period)?.months ?? null;
  return months == null ? [...history] : history.slice(-(months + 1));
}

/** Gain gagné ou perdu depuis la fin du mois précédent : les versements du mois ne comptent pas. */
export function gainSinceLastMonth(history: readonly EvolutionPoint[]): { gain: number; since: string } | null {
  const now = history.at(-1);
  const before = history.at(-2);
  return now && before ? { gain: now.gain - before.gain, since: before.month } : null;
}

/** Bande entre le patrimoine et l'argent versé : base transparente, puis épaisseur colorée, valable en gain comme en perte. */
export function gainBand(points: readonly EvolutionPoint[]): { base: number[]; band: number[] } {
  return { base: points.map((p) => Math.min(p.value, p.netContrib)), band: points.map((p) => Math.abs(p.value - p.netContrib)) };
}

/** Seulement ce qui demande une action, les plus graves d'abord (ordre donné par le moteur). */
export function alertsToReview(alerts: readonly Alert[]): Alert[] {
  return alerts.filter((a) => a.level !== "ok");
}

export interface AccountRow {
  key: string;
  name: string;
  value: number;
  /** Longueur de la barre, en % de la plus grande. */
  width: number;
  /** null : rien de versé, ou ligne regroupant plusieurs comptes. */
  gainPct: number | null;
}

/** Comptes par valeur décroissante ; au-delà de `max` lignes, les plus petits sont regroupés. */
export function accountRows(accounts: readonly AccountState[], max = 6): AccountRow[] {
  const held = accounts.filter((a) => a.value > 0).sort((a, b) => b.value - a.value);
  const largest = held[0]?.value ?? 0;
  const row = (key: string, name: string, value: number, gainPct: number | null): AccountRow => ({ key, name, value, width: largest > 0 ? (value / largest) * 100 : 0, gainPct });
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
