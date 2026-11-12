import { roundCents } from "../base";
import { loanState, type Loan, type LoanState } from "../loans";
import type { EnergyLetter } from "./energy";
import type { RentalMode } from "./lots";
import { dismembermentRatio, type Company, type DismembermentFields } from "../model";

/** Biens immobiliers et crédits : hors comptes, ils forment avec le patrimoine financier le patrimoine net. */

export const PROPERTY_KINDS = ["residence_principale", "residence_secondaire", "locatif", "autre"] as const;
export type PropertyKind = (typeof PROPERTY_KINDS)[number];
export const PROPERTY_KIND_LABELS: Record<PropertyKind, string> = {
  residence_principale: "Résidence principale",
  residence_secondaire: "Résidence secondaire",
  locatif: "Investissement locatif",
  autre: "Autre bien",
};

/** Statut de détention. En location vide, il fixe aussi la durée légale du bail. */
export const PROPERTY_OWNERSHIPS = ["nom_propre", "indivision", "sci_familiale", "sci", "autre"] as const;
export type PropertyOwnership = (typeof PROPERTY_OWNERSHIPS)[number];
export const PROPERTY_OWNERSHIP_LABELS: Record<PropertyOwnership, string> = {
  nom_propre: "En nom propre",
  indivision: "En indivision",
  sci_familiale: "SCI familiale",
  sci: "Autre SCI",
  autre: "Autre statut",
};

/** Nature du bien, indépendante de son utilisation. */
export const PROPERTY_TYPES = ["appartement", "maison", "parking", "local", "terrain", "autre"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  appartement: "Appartement",
  maison: "Maison",
  parking: "Parking ou box",
  local: "Local",
  terrain: "Terrain",
  autre: "Autre",
};

export interface Property extends DismembermentFields {
  id: string;
  kind: PropertyKind;
  ownership: PropertyOwnership;
  name: string;
  /** Valeur estimée du bien entier. */
  value: number;
  valueDate: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  /** Acheté neuf ou en construction ; sinon ancien. Sert à estimer les frais de notaire. */
  newBuild: boolean;
  /** Frais d'achat du bien entier, quel que soit son usage. */
  notaryFees: number;
  agencyFees: number;
  initialWorks: number;
  otherFees: number;
  // Fiche descriptive, entièrement facultative.
  propertyType: PropertyType | null;
  address: string;
  postalCode: string;
  city: string;
  /** Surface habitable, en m². */
  surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  floor: number | null;
  buildYear: number | null;
  outdoor: string;
  parking: boolean;
  cellar: boolean;
  heating: string;
  coOwnership: boolean;
  syndic: string;
  dpe: EnergyLetter | null;
  ges: EnergyLetter | null;
  dpeDate: string | null;
  /** Alerter avant l'expiration du DPE et si sa note interdit de louer. */
  dpeReminders: boolean;
  /** Comment le bien est loué (investissement locatif) : il décide des lots et des baux proposés. */
  rentalMode: RentalMode;
  /** Vente : le bien sort du patrimoine à cette date. */
  saleDate: string | null;
  /** Prix et frais de vente du bien entier. */
  salePrice: number | null;
  saleFees: number;
  /** Part détenue (fraction) : 0,5 pour un bien à deux ; pour un bien de SCI, la part du bien détenue par la société. */
  share: number;
  /** Société (SCI) qui détient le bien : sa part s'applique en plus, une fois les parts de société appliquées (`withCompanyShares`). */
  companyId: string | null;
  /** Dans ou hors de l'allocation cible ; null = comme la classe Immobilier. */
  inAllocation: boolean | null;
  classId: string | null;
  comment: string;
  archived: boolean;
}

/** Fiche vide d'un nouveau bien. */
export const NO_PROPERTY_DETAILS = {
  propertyType: null,
  address: "",
  postalCode: "",
  city: "",
  surface: null,
  rooms: null,
  bedrooms: null,
  floor: null,
  buildYear: null,
  outdoor: "",
  parking: false,
  cellar: false,
  heating: "",
  coOwnership: false,
  syndic: "",
  dpe: null,
  ges: null,
  dpeDate: null,
  dpeReminders: true,
  rentalMode: "vide",
  saleDate: null,
  salePrice: null,
  saleFees: 0,
  companyId: null,
  dismemberment: "pleine",
  usufructBirthDate: null,
  usufructEnd: null,
} satisfies Partial<Property>;

/** Valeur de la part détenue à une date : part du bien, puis part du droit en cas d'usufruit ou de nue-propriété (barème fiscal). */
export const propertyValue = (p: Pick<Property, "value" | "share"> & Partial<DismembermentFields>, date: string) =>
  roundCents(p.value * p.share * (p.dismemberment ? dismembermentRatio(p as DismembermentFields, date) : 1));

/** Repères au m² ; null sans surface connue. */
export function propertySqm(p: Pick<Property, "surface" | "purchasePrice" | "value">, monthlyRent: number | null): { purchase: number | null; value: number; rent: number | null } | null {
  if (p.surface == null || p.surface <= 0) return null;
  const surface = p.surface;
  const per = (amount: number) => roundCents(amount / surface);
  return { purchase: p.purchasePrice == null ? null : per(p.purchasePrice), value: per(p.value), rent: monthlyRent == null ? null : per(monthlyRent) };
}

type PropertyCosts = Pick<Property, "purchasePrice" | "notaryFees" | "agencyFees" | "initialWorks" | "otherFees">;

export const propertyFees = (p: PropertyCosts) => roundCents(p.notaryFees + p.agencyFees + p.initialWorks + p.otherFees);

/** Coût d'achat complet du bien entier, frais compris ; null tant que le prix d'achat est inconnu. */
export const propertyTotalCost = (p: PropertyCosts) => (p.purchasePrice == null ? null : roundCents(p.purchasePrice + propertyFees(p)));

export interface PropertySummary {
  heldValue: number;
  /** Coût d'achat complet, pour la part détenue ; null tant que le prix d'achat est inconnu. */
  heldCost: number | null;
  /** Valeur détenue moins coût d'achat complet de cette part, avant impôt. */
  gain: number | null;
  /** Crédits rattachés au bien. */
  loans: LoanState[];
  /** Capital restant dû des crédits rattachés, pour la part à charge de l'utilisateur. */
  heldDebt: number;
  heldMonthly: number;
  /** Valeur détenue moins capital restant dû. */
  netValue: number;
}

/** Synthèse d'un bien, à partir des crédits en cours (non archivés) déjà calculés. `improvements` : travaux qui s'ajoutent au coût. */
export function propertySummary(property: Property, loanStates: readonly LoanState[], improvements: number, date: string): PropertySummary {
  const heldValue = propertyValue(property, date);
  const totalCost = propertyTotalCost(property);
  const heldCost = totalCost == null ? null : roundCents((totalCost + improvements) * property.share);
  const loans = loanStates.filter((l) => l.loan.propertyId === property.id);
  const heldDebt = roundCents(loans.reduce((s, l) => s + l.heldBalance, 0));
  return {
    heldValue,
    heldCost,
    gain: heldCost == null ? null : roundCents(heldValue - heldCost),
    loans,
    heldDebt,
    heldMonthly: roundCents(loans.reduce((s, l) => s + l.heldMonthly, 0)),
    netValue: roundCents(heldValue - heldDebt),
  };
}

/**
 * Barème des émoluments du notaire pour une vente, hors taxes (art. A444-91 du code de commerce) :
 * chaque taux s'applique à la tranche de prix correspondante.
 * Source : service-public.gouv.fr, fiche F17701 (exemple : 1 995,25 € HT pour 200 000 €).
 */
const NOTARY_FEE_BRACKETS = [
  { upTo: 6_500, rate: 0.0387 },
  { upTo: 17_000, rate: 0.01596 },
  { upTo: 60_000, rate: 0.01064 },
  { upTo: Infinity, rate: 0.00799 },
] as const;
const NOTARY_VAT = 0.2;
/** Contribution de sécurité immobilière. */
const LAND_SECURITY_RATE = 0.001;
/** Formalités et débours : forfait approximatif, le montant réel dépend du dossier. */
const NOTARY_FORMALITIES = 1_000;
/**
 * Droits de mutation : taux départemental majoré des frais d'assiette (2,37 %), plus la taxe communale (1,2 %).
 * Depuis le 1er avril 2025, la plupart des départements appliquent 5 % au lieu de 4,5 %, soit 6,3185 % au lieu de 5,80665 %.
 * Sources : art. 1594 D du CGI, art. 116 de la loi n° 2025-127, BOI-ENR-DMTOI-10-20 et tableau des taux de la DGFiP (impots.gouv.fr).
 */
const TRANSFER_TAX_OLD = 0.0580665;
const TRANSFER_TAX_FROM_2025 = 0.063185;
const TRANSFER_TAX_2025_START = "2025-04-01";
/** Taux réduit du neuf et de la vente en l'état futur d'achèvement. */
const TRANSFER_TAX_NEW = 0.00715;

/**
 * Estimation des frais de notaire à l'achat, à l'euro près.
 * Hypothèses : taux le plus courant à la date d'achat (date inconnue : taux actuel), TVA de métropole, sans remise du notaire.
 * Le taux réel dépend du département, et un primo-accédant peut échapper à la hausse de 2025 : le montant reste modifiable.
 */
export function estimateNotaryFees(price: number, newBuild: boolean, purchaseDate: string | null): number {
  if (price <= 0) return 0;
  const transferRate = newBuild ? TRANSFER_TAX_NEW : purchaseDate != null && purchaseDate < TRANSFER_TAX_2025_START ? TRANSFER_TAX_OLD : TRANSFER_TAX_FROM_2025;
  let from = 0;
  let fees = 0;
  for (const { upTo, rate } of NOTARY_FEE_BRACKETS) {
    fees += Math.max(0, Math.min(price, upTo) - from) * rate;
    from = upTo;
  }
  return Math.round(price * transferRate + fees * (1 + NOTARY_VAT) + price * LAND_SECURITY_RATE + NOTARY_FORMALITIES);
}

/** Ancienne estimation d'un bien ; la plus récente reste sur le bien lui-même. */
export interface PropertyValue {
  id: string;
  propertyId: string;
  date: string;
  value: number;
}

/** Valeur de la part détenue à une date : 0 hors de la période de détention, sinon la dernière estimation connue. */
export function propertyHeldValueAt(p: Property, estimates: readonly PropertyValue[], date: string): number {
  if (p.purchaseDate != null && date < p.purchaseDate) return 0;
  if (p.saleDate != null ? date >= p.saleDate : p.archived) return 0;
  const points = [...estimates.filter((e) => e.propertyId === p.id).map((e) => ({ date: e.date, value: e.value })), ...(p.valueDate != null ? [{ date: p.valueDate, value: p.value }] : [])].sort((a, b) => a.date.localeCompare(b.date));
  const known = points.filter((x) => x.date <= date).at(-1);
  const value = known?.value ?? (points.length === 0 ? p.value : (p.purchasePrice ?? points[0].value));
  return propertyValue({ ...p, value }, date);
}

/** Capital restant à rembourser, pour la part à charge, sur les crédits d'un bien vendu à cette date. */
export function loanPayoffAt(loans: readonly Loan[], propertyId: string, date: string): number {
  return roundCents(loans.filter((l) => l.propertyId === propertyId && (!l.archived || l.closedOn === date)).reduce((sum, l) => sum + (date < l.firstPayment ? l.principal * l.share : loanState(l, date).heldBalance), 0));
}

export interface PropertySale {
  /** Prix et frais, pour la part détenue. */
  price: number;
  fees: number;
  /** Coût complet de la part détenue, travaux d'amélioration compris ; null sans prix d'achat. */
  cost: number | null;
  /** Prix moins frais et coût, avant impôt. */
  gain: number | null;
  loanPayoff: number;
  /** Ce qu'il reste après frais et remboursement du crédit. */
  net: number;
}

/** Bilan de la vente ; null si le bien n'est pas vendu. */
export function propertySale(p: Property, improvements: number, loanPayoff: number): PropertySale | null {
  if (p.saleDate == null || p.salePrice == null) return null;
  const price = roundCents(p.salePrice * p.share);
  const fees = roundCents(p.saleFees * p.share);
  const totalCost = propertyTotalCost(p);
  const cost = totalCost == null ? null : roundCents((totalCost + improvements) * p.share);
  return { price, fees, cost, gain: cost == null ? null : roundCents(price - fees - cost), loanPayoff, net: roundCents(price - fees - loanPayoff) };
}

export interface CompanySummary {
  /** Biens de la société (non vendus), pour la part qu'elle en détient. */
  properties: Property[];
  value: number;
  /** Capital restant dû des crédits de ses biens. */
  debt: number;
  /** Actif net de la société : biens − crédits. */
  net: number;
  /** Valeur des parts de l'utilisateur. */
  held: number;
}

/**
 * Une SCI vue de l'extérieur : ses biens et ses crédits tels que saisis (avant les parts de société),
 * son actif net, et ce que valent les parts de l'utilisateur.
 */
export function companySummary(company: Pick<Company, "id" | "share">, properties: readonly Property[], loans: readonly Loan[], date: string): CompanySummary {
  const own = properties.filter((p) => p.companyId === company.id && !p.archived);
  const ids = new Set(own.map((p) => p.id));
  const value = roundCents(own.reduce((s, p) => s + propertyValue(p, date), 0));
  const debt = roundCents(loans.filter((l) => !l.archived && l.propertyId != null && ids.has(l.propertyId)).reduce((s, l) => s + loanState(l, date).heldBalance, 0));
  const net = roundCents(value - debt);
  return { properties: own, value, debt, net, held: roundCents(net * company.share) };
}
