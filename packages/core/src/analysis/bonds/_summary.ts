import { roundCents } from "../../base";
import type { PositionState } from "../../portfolio";
import { lineKey } from "./_coupons";

export interface BondGain {
  /** Valeur moins coût des lignes détenues. */
  latent: number;
  /** Gains réalisés : remboursements et ventes, coupons exclus. */
  realized: number;
  /** Coupons saisis dans le Journal, bruts quand le brut est connu. */
  coupons: number;
  total: number;
}

/** Ce que les obligations ont rapporté depuis l'achat : plus-value latente, gains réalisés et coupons reçus. */
export function bondGain(held: readonly PositionState[], matured: readonly PositionState[], receivedByLine: ReadonlyMap<string, number>): BondGain {
  const lines = [...held, ...matured];
  const latent = held.reduce((s, p) => s + p.gain, 0);
  const realized = lines.reduce((s, p) => s + p.realizedGain, 0);
  const coupons = lines.reduce((s, p) => s + (receivedByLine.get(lineKey(p.accountId, p.asset.id)) ?? 0), 0);
  return { latent: roundCents(latent), realized: roundCents(realized), coupons: roundCents(coupons), total: roundCents(latent + realized + coupons) };
}
