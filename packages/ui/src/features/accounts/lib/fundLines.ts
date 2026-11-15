import type { AccountState, Asset, FundRate, PositionState } from "@hamac/core";

/** Un fonds euros dans un contrat : une ligne de la page Fonds euros. */
export interface FundLine {
  key: string;
  s: AccountState;
  fund: Asset;
  position: PositionState | undefined;
  /** Taux servis saisis, de l'année la plus ancienne à la plus récente. */
  rates: FundRate[];
  isDefault: boolean;
  balance: number;
  income: number;
  lastRate: FundRate | null;
  avgRate: number | null;
}

/**
 * Les fonds euros de chaque contrat : son support par défaut, ceux qui ont un solde et ceux qui ont des taux saisis,
 * même sans solde (un fonds vidé par arbitrage garde ses taux).
 */
export function fundLines(contracts: readonly AccountState[], fundRates: readonly FundRate[], assetById: ReadonlyMap<string, Asset>): FundLine[] {
  return contracts.flatMap((s) => {
    const { account } = s;
    const rates = fundRates.filter((r) => r.accountId === account.id);
    const ids = [account.defaultAssetId, ...s.positions.filter((p) => p.asset.kind === "fonds_euros").map((p) => p.asset.id), ...rates.map((r) => r.assetId)];
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    return unique.flatMap((id) => {
      const fund = assetById.get(id);
      if (!fund) return [];
      const position = s.positions.find((p) => p.asset.id === id);
      const own = rates.filter((r) => r.assetId === id).sort((a, b) => a.year - b.year);
      return [
        {
          key: `${account.id}:${id}`,
          s,
          fund,
          position,
          rates: own,
          isDefault: account.defaultAssetId === id,
          balance: position?.value ?? 0,
          income: position?.income ?? 0,
          lastRate: own.at(-1) ?? null,
          avgRate: own.length ? own.reduce((t, r) => t + r.rate, 0) / own.length : null,
        },
      ];
    });
  });
}

/** Taux moyen servi de l'ensemble : la moyenne de chaque fonds, pondérée par son solde. */
export function weightedAverageRate(lines: readonly FundLine[]): number | null {
  const rated = lines.filter((l) => l.avgRate != null && l.balance > 0);
  const total = rated.reduce((t, l) => t + l.balance, 0);
  return total > 0 ? rated.reduce((t, l) => t + l.avgRate! * l.balance, 0) / total : null;
}
