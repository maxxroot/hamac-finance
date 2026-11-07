import { roundCents } from "./money";

/**
 * Frais contenus dans un montant d'achat ou de vente (Journal!G).
 * Achat : le montant est le total débité frais compris → frais = M × t / (1 + t).
 * Vente : le montant est le net reçu → frais = M × t / (1 − t).
 */
export function embeddedFee(type: "achat" | "vente", amount: number, rate: number, minFee: number): number {
  if (amount <= 0 || rate < 0) return 0;
  const fee = type === "achat" ? (amount * rate) / (1 + rate) : (amount * rate) / (1 - rate);
  return roundCents(Math.max(minFee, fee));
}

/** Frais d'un achat d'obligation calculés sur le prix payé (OAT!I) : max(min, t × nominal × prix%). */
export function bondPurchaseFee(nominal: number, pricePct: number, rate: number, minFee: number): number {
  return roundCents(Math.max(minFee, rate * nominal * (pricePct / 100)));
}
