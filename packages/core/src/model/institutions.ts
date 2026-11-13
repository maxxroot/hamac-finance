import { z } from "zod";
import type { Account, AccountKind } from "./domain";
import { roundCents } from "../base";
import { withholdingDispensed, type PlanParams } from "./params";
import type { InstitutionProtection } from "./institutionProtection";

/**
 * Établissements (banques, courtiers, assureurs, plateformes crypto) et leurs grilles de frais,
 * déclarées par type de compte. Un compte est rattaché à un établissement : ses frais en découlent.
 */

export const INSTITUTION_KINDS = ["banque", "courtier", "assureur", "crowdlending", "crypto"] as const;
export type InstitutionKind = (typeof INSTITUTION_KINDS)[number];
export const INSTITUTION_KIND_LABELS: Record<InstitutionKind, string> = {
  banque: "Banque",
  courtier: "Courtier",
  assureur: "Assureur / courtier en assurance-vie",
  crowdlending: "Plateforme de crowdlending",
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

/** Anciens réglages d'impôts des plateformes, gardés pour les fiches d'avant le réglage commun (`InstitutionTax.withholds`). */
export const CrowdOffer = z.object({
  /** Ancien réglage : la plateforme prélève elle-même les impôts sur les intérêts. */
  taxWithheld: z.boolean().default(false),
  /** Ancien taux prélevé ; null = prélèvement forfaitaire des paramètres. */
  taxRate: z.number().min(0).max(0.9).nullable().default(null),
});
export type CrowdOffer = z.infer<typeof CrowdOffer>;

export const LivretOffer = z.object({});

export const Offers = z.object({
  pea: BrokerOffer.optional(),
  cto: BrokerOffer.optional(),
  assurance_vie: AvOffer.optional(),
  crypto: CryptoOffer.optional(),
  crowdlending: CrowdOffer.optional(),
  livret: LivretOffer.optional(),
});
export type Offers = z.infer<typeof Offers>;

/** Fiscalité d'un établissement, pour le récapitulatif fiscal. */
export const InstitutionTax = z.object({
  /** Cochée : Hamac rédige le récapitulatif de cet établissement, ses lignes sont à saisir. Sinon, on attend son IFU. */
  report: z.boolean().default(false),
  /**
   * L'établissement prélève les impôts sur les intérêts et dividendes (acompte et prélèvements sociaux).
   * null : fiche enregistrée avant ce réglage, déduit par `institutionWithholds`.
   */
  withholds: z.boolean().nullable().default(null),
  /** Taux retenus sur les revenus, seulement s'ils diffèrent : null = taux par défaut (Paramètres › Plan), 0 = rien n'est retenu. */
  withheldIncomeTax: z.number().min(0).max(0.9).nullable().default(null),
  withheldSocial: z.number().min(0).max(0.9).nullable().default(null),
});
export type InstitutionTax = z.infer<typeof InstitutionTax>;

export const NO_INSTITUTION_TAX: InstitutionTax = { report: false, withholds: null, withheldIncomeTax: null, withheldSocial: null };

/** Brut et retenues d'un revenu d'après des taux de retenue. */
export function grossFromNet(net: number, rates: { incomeTax: number; social: number }): { gross: number; incomeTax: number; social: number } {
  const gross = roundCents(net / (1 - rates.incomeTax - rates.social));
  return { gross, incomeTax: roundCents(gross * rates.incomeTax), social: roundCents(gross * rates.social) };
}

/**
 * L'établissement prélève-t-il les impôts sur les revenus ? Le réglage de la fiche s'il existe ; sinon, pour une fiche
 * plus ancienne, ce que Hamac supposait : la case de la plateforme de crowdlending, rien pour une plateforme crypto
 * ou un établissement hors de France, rien quand les deux taux de retenue sont à 0, et oui dans les autres cas.
 */
export function institutionWithholds(inst: Pick<Institution, "kind" | "offers"> & { tax?: Partial<InstitutionTax>; protection?: { country: string } }): boolean {
  const tax = inst.tax ?? {};
  if (tax.withholds != null) return tax.withholds;
  if (inst.kind === "crowdlending" || inst.offers.crowdlending) return inst.offers.crowdlending?.taxWithheld ?? false;
  if (inst.kind === "crypto") return false;
  if (inst.protection && inst.protection.country !== "france") return false;
  return !(tax.withheldIncomeTax === 0 && tax.withheldSocial === 0);
}

/** Retenues d'une plateforme de crowdlending sur des intérêts : prélevées ou non, taux de l'acompte et des prélèvements sociaux. */
export interface CrowdTax {
  withheld: boolean;
  /** Taux total retenu : acompte + prélèvements sociaux. */
  rate: number;
  incomeTax: number;
  social: number;
}

/**
 * Impôts d'une plateforme de crowdlending sur les intérêts d'une année : prélevés ou non (fiche de l'établissement), à quels taux.
 * Taux de la fiche s'ils sont réglés, sinon l'ancien taux total de la plateforme (acompte d'abord, au plus le PFU),
 * sinon le prélèvement forfaitaire. Année de dispense : pas d'acompte, seuls les prélèvements sociaux restent retenus.
 */
export function crowdTaxOf(data: { params: PlanParams; institutions?: readonly Institution[] }, account: Pick<Account, "institutionId">, year: number): CrowdTax {
  const inst = data.institutions?.find((i) => i.id === account.institutionId);
  const p = data.params.tax;
  const dispensed = withholdingDispensed(data.params, year, inst?.id);
  const make = (withheld: boolean, incomeTax: number, social: number): CrowdTax => {
    const it = dispensed ? 0 : incomeTax;
    return { withheld, rate: it + social, incomeTax: it, social };
  };
  if (!inst) return make(false, p.pfuIncomeTax, p.socialGeneral);
  const tax = inst.tax ?? NO_INSTITUTION_TAX;
  const withheld = institutionWithholds(inst);
  if (tax.withheldIncomeTax != null || tax.withheldSocial != null) return make(withheld, tax.withheldIncomeTax ?? p.pfuIncomeTax, tax.withheldSocial ?? p.socialGeneral);
  const legacy = inst.offers.crowdlending?.taxRate;
  if (legacy != null) return make(withheld, Math.min(legacy, p.pfuIncomeTax), Math.max(0, legacy - p.pfuIncomeTax));
  return make(withheld, p.pfuIncomeTax, p.socialGeneral);
}

/**
 * Ce qu'une plateforme qui prélève les impôts retient sur des intérêts bruts, d'après ses taux.
 * Un total saisi à la main, pour coller aux centimes près au relevé de la plateforme, est réparti
 * entre acompte et prélèvements sociaux dans les proportions des taux.
 */
export function crowdWithholding(gross: number, rates: Pick<CrowdTax, "incomeTax" | "social">, total: number = roundCents(gross * (rates.incomeTax + rates.social))): { incomeTax: number; social: number; total: number } {
  const rate = rates.incomeTax + rates.social;
  const incomeTax = rate > 0 ? roundCents((total * rates.incomeTax) / rate) : 0;
  return { incomeTax, social: roundCents(total - incomeTax), total: roundCents(total) };
}

export interface Institution {
  id: string;
  name: string;
  kind: InstitutionKind;
  website: string;
  score: number | null;
  comment: string;
  offers: Offers;
  tax: InstitutionTax;
  /** Établissement garant et pays, pour la protection en cas de faillite. */
  protection: InstitutionProtection;
}

/** Offres proposées par défaut selon le type d'établissement. */
export type OfferKind = keyof Offers;

/** Grille de frais applicable à un type de compte : le PEA-PME suit celle du PEA ; PER et épargne salariale n'en ont pas. */
export function offerKindOf(kind: AccountKind): OfferKind | null {
  if (kind === "pea_pme") return "pea";
  return kind === "per" || kind === "epargne_salariale" ? null : kind;
}

export const DEFAULT_OFFER_KINDS: Record<InstitutionKind, OfferKind[]> = {
  banque: ["livret"],
  courtier: ["pea", "cto"],
  assureur: ["assurance_vie"],
  crowdlending: ["crowdlending"],
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
    case "crowdlending":
      return CrowdOffer.parse({});
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
