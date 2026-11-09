import { activeAccountIds, PERF_GROUPS, type AssetPerformance, type CompareSide, type EnvelopePerformance, type PortfolioState } from "@hamac/core";

/** Logique d'affichage de la page Performance, sans React pour pouvoir la tester. */

export interface ScopeOption {
  key: string;
  label: string;
  accountIds: string[];
}

export interface ScopeOptions {
  all: ScopeOption;
  groups: ScopeOption[];
  accounts: ScopeOption[];
}

export const ALL_SCOPE = "all";

export function scopeOptions(state: PortfolioState): ScopeOptions {
  const active = new Set(activeAccountIds(state));
  const states = state.accounts.filter((a) => active.has(a.account.id));
  return {
    all: { key: ALL_SCOPE, label: "Tout le patrimoine financier", accountIds: [...active] },
    groups: PERF_GROUPS.flatMap((g) => {
      const accountIds = states.filter((a) => g.kinds.includes(a.account.kind)).map((a) => a.account.id);
      return accountIds.length ? [{ key: `group:${g.key}`, label: g.label, accountIds }] : [];
    }),
    accounts: states.map((a) => ({ key: `account:${a.account.id}`, label: a.account.name, accountIds: [a.account.id] })),
  };
}

export function findScope(options: ScopeOptions, key: string): ScopeOption | null {
  return [options.all, ...options.groups, ...options.accounts].find((o) => o.key === key) ?? null;
}

export const assetKey = (assetId: string) => `asset:${assetId}`;

/** Élément à comparer d'après sa clé ; null s'il n'existe plus. */
export function compareSide(options: ScopeOptions, key: string): CompareSide | null {
  if (key.startsWith("asset:")) return { kind: "asset", assetId: key.slice(6) };
  const scope = findScope(options, key);
  return scope ? { kind: "accounts", accountIds: scope.accountIds } : null;
}

/** Lignes du tableau pour le filtre choisi : le total n'a de sens que sur l'ensemble. */
export function envelopesForScope(rows: readonly EnvelopePerformance[], key: string): EnvelopePerformance[] {
  if (key === ALL_SCOPE) return [...rows];
  if (key.startsWith("group:")) return rows.filter((r) => r.key === key.slice(6));
  const id = key.slice(8);
  return rows.filter((r) => r.accounts.some((a) => a.key === id)).map((r) => ({ ...r, accounts: r.accounts.filter((a) => a.key === id) }));
}

/** Les `n` meilleurs, puis les `n` moins bons parmi les autres, le moins bon d'abord. */
export function rankingView(rows: readonly AssetPerformance[], n = 5): { best: AssetPerformance[]; worst: AssetPerformance[] } {
  return { best: rows.slice(0, n), worst: rows.slice(n).reverse().slice(0, n) };
}

/** Variation à partir de laquelle la case du calendrier atteint sa couleur la plus forte. */
const HEAT_SCALE = 0.06;

/** Intensité de la couleur d'une case du calendrier, en %. */
export function heatShare(rate: number): number {
  return Math.round(10 + Math.min(1, Math.abs(rate) / HEAT_SCALE) * 50);
}

export function pctText(rate: number, digits = 1, signed = true): string {
  const text = (rate * 100).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${signed && rate > 0 ? "+" : ""}${text} %`;
}

const COMPARE_KEY = "hamac.performance.comparaison";

export function loadCompareChoice(): { left: string; right: string } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(COMPARE_KEY) ?? "null") as { left?: unknown; right?: unknown } | null;
    return typeof raw?.left === "string" && typeof raw.right === "string" ? { left: raw.left, right: raw.right } : null;
  } catch {
    return null;
  }
}

export function saveCompareChoice(choice: { left: string; right: string }): void {
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(choice));
  } catch {
    // Stockage indisponible : le choix ne sera simplement pas retenu.
  }
}
