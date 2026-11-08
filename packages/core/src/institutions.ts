import { z } from "zod";
import type { Account, AccountKind } from "./domain";
import { roundCents } from "./money";
import type { PlanParams } from "./params";

/**
 * Établissements (banques, courtiers, assureurs, plateformes crypto) et leurs grilles de frais,
 * déclarées par type de compte. Un compte est rattaché à un établissement : ses frais en découlent.
 */

export const INSTITUTION_KINDS = ["banque", "courtier", "assureur", "crypto"] as const;
export type InstitutionKind = (typeof INSTITUTION_KINDS)[number];
export const INSTITUTION_KIND_LABELS: Record<InstitutionKind, string> = {
  banque: "Banque",
  courtier: "Courtier",
  assureur: "Assureur / courtier en assurance-vie",
  crypto: "Plateforme crypto",
};

const rate = z.number().min(0).max(1);
const eur = z.number().min(0);
const opt = <T extends z.ZodTypeAny>(t: T) => t.nullable().default(null);

/** Palier de frais d'ordre : s'applique à un ordre dont le montant est ≤ `upTo` (null = au-delà). */
export const OrderFeeTier = z.object({ upTo: eur.nullable(), fixed: eur, rate });
export type OrderFeeTier = z.infer<typeof OrderFeeTier>;

export const OrderFees = z.object({
  tiers: z.array(OrderFeeTier).min(1),
  min: opt(eur),
  max: opt(eur),
});
export type OrderFees = z.infer<typeof OrderFees>;

/** PEA ou compte-titres. */
export const BrokerOffer = z.object({
  orderFees: OrderFees,
  /** Droits de garde / tenue de compte : montant fixe et part de l'encours, par an. */
  custodyFixed: eur.default(0),
  custodyRate: rate.default(0),
  etfWorld: opt(z.boolean()),
  directBonds: opt(z.boolean()),
  programmed: opt(z.boolean()),
  reachableSupport: opt(z.boolean()),
});
export type BrokerOffer = z.infer<typeof BrokerOffer>;

export const AvOffer = z.object({
  entryFee: rate.default(0),
  /** Frais de gestion annuels du fonds euros et des unités de compte. */
  euroFee: rate.default(0),
  ucFee: rate.default(0),
  arbitrageFee: rate.default(0),
  euroRateLast: opt(rate),
  euroRate5y: opt(rate),
  full100Euro: opt(z.boolean()),
  bonusConditioned: opt(z.boolean()),
  etfWorld: opt(z.boolean()),
  datedFunds: opt(z.boolean()),
  programmedFrom: opt(eur),
  insurer: z.string().trim().max(80).default(""),
});
export type AvOffer = z.infer<typeof AvOffer>;

export const CryptoOffer = z.object({
  /** Frais par achat ou vente, et écart de prix (spread) estimé. */
  tradeFee: rate.default(0),
  spread: rate.default(0),
});
export type CryptoOffer = z.infer<typeof CryptoOffer>;

export const LivretOffer = z.object({});

export const Offers = z.object({
  pea: BrokerOffer.optional(),
  cto: BrokerOffer.optional(),
  assurance_vie: AvOffer.optional(),
  crypto: CryptoOffer.optional(),
  livret: LivretOffer.optional(),
});
export type Offers = z.infer<typeof Offers>;

export interface Institution {
  id: string;
  name: string;
  kind: InstitutionKind;
  website: string;
  score: number | null;
  comment: string;
  offers: Offers;
}

/** Offres proposées par défaut selon le type d'établissement. */
export type OfferKind = keyof Offers;

/** Grille de frais applicable à un type de compte : le PEA-PME suit celle du PEA ; PER et épargne salariale n'en ont pas. */
export function offerKindOf(kind: AccountKind): OfferKind | null {
  if (kind === "pea_pme") return "pea";
  return kind === "per" || kind === "epargne_salariale" || kind === "crowdlending" ? null : kind;
}

export const DEFAULT_OFFER_KINDS: Record<InstitutionKind, OfferKind[]> = {
  banque: ["livret"],
  courtier: ["pea", "cto"],
  assureur: ["assurance_vie"],
  crypto: ["crypto"],
};

export function emptyBrokerOffer(): BrokerOffer {
  return BrokerOffer.parse({ orderFees: { tiers: [{ upTo: null, fixed: 0, rate: 0 }] } });
}
export function emptyOffer(kind: OfferKind): Offers[keyof Offers] {
  switch (kind) {
    case "pea":
    case "cto":
      return emptyBrokerOffer();
    case "assurance_vie":
      return AvOffer.parse({});
    case "crypto":
      return CryptoOffer.parse({});
    case "livret":
      return {};
  }
}

// ——— Calcul des frais ———

/** Frais d'un ordre d'un montant donné (hors frais) : palier applicable, puis minimum et maximum. */
export function orderFee(grid: OrderFees, orderAmount: number): number {
  if (orderAmount <= 0) return 0;
  const tiers = [...grid.tiers].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  const tier = tiers.find((t) => t.upTo == null || orderAmount <= t.upTo) ?? tiers[tiers.length - 1];
  let fee = tier.fixed + tier.rate * orderAmount;
  if (grid.min != null) fee = Math.max(grid.min, fee);
  if (grid.max != null) fee = Math.min(grid.max, fee);
  return roundCents(fee);
}

/**
 * Frais contenus dans un montant saisi : pour un achat, le montant est le total débité (ordre + frais) ;
 * pour une vente, le net reçu (ordre − frais). On retrouve le montant de l'ordre par bissection.
 */
export function embeddedOrderFee(grid: OrderFees, type: "achat" | "vente", amount: number): number {
  if (amount <= 0) return 0;
  const target = (v: number) => (type === "achat" ? v + orderFee(grid, v) : v - orderFee(grid, v)) - amount;
  let lo = 0;
  let hi = type === "achat" ? amount : amount * 2 + 1000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (target(mid) > 0) hi = mid;
    else lo = mid;
  }
  const order = (lo + hi) / 2;
  return roundCents(Math.abs(type === "achat" ? amount - order : order - amount));
}

/** Grille « par défaut » (compte sans établissement) tirée des paramètres. */
export function defaultOrderFees(p: PlanParams): OrderFees {
  return { tiers: [{ upTo: null, fixed: 0, rate: p.broker.feeRate }], min: p.broker.minFee || null, max: null };
}

export type FeeSource = { institution: Institution | null; label: string };

/** Frais applicables à un achat/vente sur ce compte, et d'où ils viennent. */
export function tradeFeeFor(
  account: Account,
  institutions: ReadonlyMap<string, Institution>,
  p: PlanParams,
): { order: OrderFees | null; cryptoRate: number | null; source: FeeSource } {
  const inst = account.institutionId ? (institutions.get(account.institutionId) ?? null) : null;
  if (account.kind === "crypto") {
    const offer = inst?.offers.crypto;
    if (offer) return { order: null, cryptoRate: offer.tradeFee, source: { institution: inst, label: `Grille de ${inst!.name}` } };
    return { order: null, cryptoRate: p.crypto.feeRate, source: { institution: null, label: "Frais par défaut" } };
  }
  if (account.kind === "pea" || account.kind === "pea_pme" || account.kind === "cto") {
    // Le PEA-PME suit la grille PEA de l'établissement.
    const offer = inst?.offers[account.kind === "cto" ? "cto" : "pea"];
    if (offer) return { order: offer.orderFees, cryptoRate: null, source: { institution: inst, label: `Grille de ${inst!.name}` } };
  }
  return { order: defaultOrderFees(p), cryptoRate: null, source: { institution: null, label: "Frais par défaut" } };
}

/** Frais d'un achat ou d'une vente saisi(e) en montant total (achat) ou net (vente). */
export function suggestTradeFee(account: Account, institutions: ReadonlyMap<string, Institution>, p: PlanParams, type: "achat" | "vente", amount: number): number {
  const f = tradeFeeFor(account, institutions, p);
  if (f.cryptoRate != null) {
    const r = f.cryptoRate;
    return roundCents(type === "achat" ? (amount * r) / (1 + r) : (amount * r) / (1 - r));
  }
  return embeddedOrderFee(f.order!, type, amount);
}

/** Frais d'un ordre dont on connaît le montant hors frais (achat d'obligation : nominal × prix). */
export function suggestOrderFee(account: Account, institutions: ReadonlyMap<string, Institution>, p: PlanParams, orderAmount: number): number {
  const f = tradeFeeFor(account, institutions, p);
  if (f.cryptoRate != null) return roundCents(orderAmount * f.cryptoRate);
  return orderFee(f.order!, orderAmount);
}

/** Description lisible d'une grille : « jusqu'à 500 € : 1,99 € · au-delà : 0,6 % (min. 1 €) ». */
export function describeOrderFees(g: OrderFees): string {
  const n = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const tiers = [...g.tiers].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  const part = (t: OrderFeeTier) => [t.fixed ? `${n(t.fixed)} €` : "", t.rate ? `${n(t.rate * 100)} %` : ""].filter(Boolean).join(" + ") || "gratuit";
  const body =
    tiers.length === 1
      ? part(tiers[0])
      : tiers.map((t, i) => (t.upTo == null ? `au-delà de ${n(tiers[i - 1]?.upTo ?? 0)} € : ${part(t)}` : `jusqu'à ${n(t.upTo)} € : ${part(t)}`)).join(" · ");
  const bounds = [g.min != null ? `min. ${n(g.min)} €` : "", g.max != null ? `max. ${n(g.max)} €` : ""].filter(Boolean).join(", ");
  return bounds ? `${body} (${bounds})` : body;
}
