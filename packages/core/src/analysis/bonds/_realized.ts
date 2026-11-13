import { xirr, type Flow, type IsoDate } from "../../base";
import type { Transaction } from "../../model";
import type { PositionState } from "../../portfolio";

/**
 * Rendement annuel réellement obtenu sur une ligne remboursée : achats payés, ventes et coupons reçus
 * (bruts quand le brut est saisi), puis le nominal remboursé à l'échéance. Les coupons oubliés dans le Journal
 * manquent donc aussi ici.
 */
export function realizedBondYield(p: PositionState, transactions: readonly Transaction[]): number | null {
  const maturity = p.asset.maturityDate;
  if (!maturity) return null;
  const flows: Flow[] = [];
  let qty = 0;
  for (const tx of transactions) {
    if (tx.accountId !== p.accountId || tx.date > maturity) continue;
    if (tx.assetId === p.asset.id) {
      if (tx.type === "achat" && tx.quantity) {
        flows.push({ date: tx.date, amount: -tx.amount });
        qty += tx.quantity;
      } else if (tx.type === "vente" && tx.quantity) {
        flows.push({ date: tx.date, amount: tx.amount });
        qty -= tx.quantity;
      } else if (tx.type === "interets") flows.push({ date: tx.date, amount: tx.gross ?? tx.amount });
    }
  }
  if (qty > 1e-9) flows.push({ date: maturity as IsoDate, amount: qty });
  return xirr(flows);
}
