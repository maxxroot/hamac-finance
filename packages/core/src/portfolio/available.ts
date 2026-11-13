import { roundCents } from "../base";
import { holdsEuroFunds } from "../model";
import { computePortfolio, type EngineData } from "./engine";

export interface AvailableBalance {
  amount: number;
  /** D'où part l'argent : les espèces du compte, ou le fonds euros visé (celui de l'opération, sinon celui du contrat). */
  source: { kind: "especes" } | { kind: "fonds_euros"; assetId: string; name: string };
}

/**
 * Argent disponible pour une sortie d'argent (retrait) à une date : espèces du compte, ou fonds euros d'un contrat.
 * Les opérations du même jour sont comptées (les retraits passent en dernier dans la journée) ; `excludeTxId`
 * écarte l'opération en cours de modification. Versements programmés compris, comme dans `computePortfolio`.
 * null : compte inconnu.
 */
export function availableBalance(data: EngineData, accountId: string, date: string, opts: { supportId?: string | null; excludeTxId?: string } = {}): AvailableBalance | null {
  const account = data.accounts.find((a) => a.id === accountId);
  if (!account) return null;
  const transactions = opts.excludeTxId ? data.transactions.filter((t) => t.id !== opts.excludeTxId) : data.transactions;
  const state = computePortfolio({ ...data, transactions }, date).accountById.get(accountId);
  if (!state) return null;
  // Même choix que le moteur : le fonds euros de l'opération, sinon celui du contrat, sinon les espèces.
  const byId = (id: string | null | undefined) => (id ? data.assets.find((a) => a.id === id && a.kind === "fonds_euros") : undefined);
  const fund = holdsEuroFunds(account) ? (byId(opts.supportId) ?? byId(account.defaultAssetId)) : undefined;
  if (!fund) return { amount: roundCents(state.cash), source: { kind: "especes" } };
  const held = state.positions.find((p) => p.asset.id === fund.id)?.value ?? 0;
  return { amount: roundCents(held), source: { kind: "fonds_euros", assetId: fund.id, name: fund.name } };
}
