import type { MarketSeries, MarketSeriesInput } from "@hamac/api";
import { activeAccountIds, isEnvelope, PERF_GROUPS, type Asset, type AssetKind, type AssetPerformance, type CompareSide, type EngineData, type EnvelopePerformance, type PortfolioState } from "@hamac/core";

/** Logique d'affichage de la page Performance, sans React pour pouvoir la tester. */

export interface ScopeOption {
  key: string;
  label: string;
  accountIds: string[];
  /** Regroupement par type : une enveloppe fiscale (PEA, assurance-vie…) ou un placement (crypto, crowdlending). */
  family?: "enveloppe" | "placement";
}

export interface ScopeOptions {
  all: ScopeOption;
  groups: ScopeOption[];
  accounts: ScopeOption[];
}

/** Rubriques du sélecteur : enveloppes, puis placements détenus en direct. */
export function groupSections(options: ScopeOptions): Array<{ label: string; options: ScopeOption[] }> {
  return [
    { label: "Enveloppes", options: options.groups.filter((g) => g.family === "enveloppe") },
    { label: "Placements", options: options.groups.filter((g) => g.family === "placement") },
  ].filter((s) => s.options.length > 0);
}

export const ALL_SCOPE = "all";

export function scopeOptions(state: PortfolioState): ScopeOptions {
  const active = new Set(activeAccountIds(state));
  const states = state.accounts.filter((a) => active.has(a.account.id));
  return {
    all: { key: ALL_SCOPE, label: "Tout le patrimoine financier", accountIds: [...active] },
    groups: PERF_GROUPS.flatMap((g) => {
      const accountIds = states.filter((a) => g.kinds.includes(a.account.kind)).map((a) => a.account.id);
      return accountIds.length ? [{ key: `group:${g.key}`, label: g.label, accountIds, family: isEnvelope(g.kinds[0]!) ? ("enveloppe" as const) : ("placement" as const) }] : [];
    }),
    accounts: states.map((a) => ({ key: `account:${a.account.id}`, label: a.account.name, accountIds: [a.account.id] })),
  };
}

export function findScope(options: ScopeOptions, key: string): ScopeOption | null {
  return [options.all, ...options.groups, ...options.accounts].find((o) => o.key === key) ?? null;
}

/**
 * Sous-lignes du tableau année par année : les enveloppes et placements sur tout le patrimoine,
 * les comptes d'un regroupement qui en a plusieurs ; rien pour un seul compte.
 */
export function breakdownParts(options: ScopeOptions, scope: ScopeOption): ScopeOption[] {
  if (scope.key === ALL_SCOPE) return options.groups;
  if (!scope.key.startsWith("group:") || scope.accountIds.length < 2) return [];
  const ids = new Set(scope.accountIds);
  return options.accounts.filter((a) => ids.has(a.accountIds[0]!));
}

export const assetKey = (assetId: string) => `asset:${assetId}`;

/** Titre recherché pour une comparaison : il n'est pas ajouté au portefeuille. */
export interface Reference {
  kind: "etf" | "etc" | "action" | "fonds" | "crypto";
  name: string;
  isin: string | null;
  symbol: string | null;
}

export const REFERENCE_KINDS: readonly AssetKind[] = ["etf", "etc", "action", "fonds", "crypto"];
const MAX_REFERENCES = 8;

export const referenceKey = (r: Pick<Reference, "kind" | "isin" | "symbol">) => `ref:${r.kind}|${r.isin ?? ""}|${r.symbol ?? ""}`;

/** Titres réellement passés par le portefeuille, seuls proposés sous « Mes titres ». */
export function ownedAssetIds(data: Pick<EngineData, "transactions">): Set<string> {
  return new Set(data.transactions.flatMap((t) => (t.assetId ? [t.assetId] : [])));
}

/** Historique à demander pour cette clé ; null si l'élément se lit dans le portefeuille (comptes, cours manuels…). */
export function seriesRequest(key: string, references: readonly Reference[], assetOf: (id: string) => Asset | undefined): MarketSeriesInput | null {
  if (key.startsWith("ref:")) {
    const r = references.find((x) => referenceKey(x) === key);
    return r ? { kind: r.kind, isin: r.isin, symbol: r.symbol } : null;
  }
  if (!key.startsWith("asset:")) return null;
  const a = assetOf(key.slice(6));
  if (!a || a.priceSource !== "auto" || a.priceUrl || !REFERENCE_KINDS.includes(a.kind) || (!a.isin && !a.symbol)) return null;
  return { kind: a.kind as Reference["kind"], isin: a.isin, symbol: a.symbol };
}

/** Élément à comparer d'après sa clé ; null s'il n'existe plus ou que ses cours manquent. */
export function compareSide(options: ScopeOptions, key: string, series?: MarketSeries): CompareSide | null {
  if (key.startsWith("ref:")) return series ? { kind: "series", points: series.points } : null;
  if (key.startsWith("asset:")) return series && series.points.length >= 2 ? { kind: "series", points: series.points } : { kind: "asset", assetId: key.slice(6) };
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

export interface CompareChoice {
  left: string;
  right: string;
  references: Reference[];
}

const isReference = (r: unknown): r is Reference => {
  const x = r as Partial<Reference> | null;
  return typeof x?.name === "string" && REFERENCE_KINDS.includes(x.kind as AssetKind) && (typeof x.isin === "string" || typeof x.symbol === "string");
};

export function loadCompareChoice(): CompareChoice | null {
  try {
    const raw = JSON.parse(localStorage.getItem(COMPARE_KEY) ?? "null") as { left?: unknown; right?: unknown; references?: unknown } | null;
    if (typeof raw?.left !== "string" || typeof raw.right !== "string") return null;
    return { left: raw.left, right: raw.right, references: Array.isArray(raw.references) ? raw.references.filter(isReference) : [] };
  } catch {
    return null;
  }
}

/** Place un titre recherché en tête des références, sans doublon. */
export function withReference(references: readonly Reference[], added: Reference): Reference[] {
  const key = referenceKey(added);
  return [added, ...references.filter((r) => referenceKey(r) !== key)].slice(0, MAX_REFERENCES);
}

export function saveCompareChoice(choice: CompareChoice): void {
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(choice));
  } catch {
    // Stockage indisponible : le choix ne sera simplement pas retenu.
  }
}
