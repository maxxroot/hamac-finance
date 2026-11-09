import { roundCents } from "@hamac/core";

/** Le champ que la personne a rempli : l'autre s'en déduit. */
export type PriceBasis = "unit" | "total";

export interface TradeAmounts {
  side: "achat" | "vente";
  basis: PriceBasis;
  quantity: number | null;
  /** Prix d'une unité, hors frais. */
  unitPrice: number | null;
  /** Total débité (achat, frais compris) ou reçu (vente, frais déduits). */
  amount: number | null;
  fee: number | null;
  /** Coupon couru, compris dans le total d'une obligation. */
  accrued?: number;
  /** 100 pour un prix en % du nominal. */
  per?: number;
}

const round6 = (v: number) => Math.round(v * 1_000_000) / 1_000_000;

/** Calcule le total depuis le prix unitaire, ou le prix unitaire depuis le total, selon ce qui a été saisi. */
export function syncTradeAmounts(t: TradeAmounts): { amount: number | null; unitPrice: number | null } {
  const per = t.per ?? 1;
  const accrued = t.accrued ?? 0;
  const fee = (t.side === "achat" ? 1 : -1) * (t.fee ?? 0);
  if (t.basis === "unit") {
    if (!t.quantity || t.unitPrice == null) return { amount: null, unitPrice: t.unitPrice };
    return { amount: roundCents((t.quantity * t.unitPrice) / per + accrued + fee), unitPrice: t.unitPrice };
  }
  if (!t.quantity || t.amount == null) return { amount: t.amount, unitPrice: null };
  return { amount: t.amount, unitPrice: round6(((t.amount - fee - accrued) * per) / t.quantity) };
}
