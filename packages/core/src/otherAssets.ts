import { addMonths, monthsBetween, yearsBetween } from "./dates";
import { roundCents } from "./money";
import { dismembermentRatio, type DismembermentFields } from "./ownership";
import { loanState, type Loan } from "./realestate";

/**
 * Biens qui ne sont ni des comptes ni de l'immobilier : or, objets de valeur, véhicules, parts de société
 * non cotée, compte courant d'associé, argent prêté. Ils complètent le patrimoine net.
 */

export const OTHER_ASSET_KINDS = ["metal", "objet", "vehicule", "societe", "compte_courant", "pret", "autre"] as const;
export type OtherAssetKind = (typeof OTHER_ASSET_KINDS)[number];
export const OTHER_ASSET_KIND_LABELS: Record<OtherAssetKind, string> = {
  metal: "Or et métaux précieux",
  objet: "Bijou, objet d'art, de collection ou d'antiquité",
  vehicule: "Véhicule",
  societe: "Parts de société non cotée",
  compte_courant: "Compte courant d'associé",
  pret: "Argent prêté à un proche",
  autre: "Autre bien",
};

/**
 * Seules les parts de société se démembrent couramment (usufruit et nue-propriété de parts sociales).
 * L'or, les objets, les véhicules et les sommes prêtées se détiennent en pleine propriété.
 */
export function canBeDismembered(kind: OtherAssetKind): boolean {
  return kind === "societe";
}

export interface OtherAsset extends DismembermentFields {
  id: string;
  kind: OtherAssetKind;
  name: string;
  /** Valeur estimée du bien entier (ou somme due, pour un prêt sans échéancier). */
  value: number;
  valueDate: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  /** Part détenue (fraction). */
  share: number;
  /** Baisse de valeur par an depuis la dernière estimation (fraction) : une voiture perd de la valeur. */
  depreciation: number | null;
  /** Décote en cas de vente rapide (fraction). */
  quickSaleDiscount: number | null;
  /** Délai pour vendre ou récupérer l'argent, en mois. */
  saleDelayMonths: number | null;
  /** Argent prêté avec un échéancier : la somme due se calcule comme le capital restant d'un crédit. */
  loanPrincipal: number | null;
  loanRate: number | null;
  loanTermMonths: number | null;
  loanFirstPayment: string | null;
  /** Classe d'actifs personnalisée : sans classe, le bien reste hors de la répartition. */
  classId: string | null;
  inAllocation: boolean | null;
  comment: string;
  archived: boolean;
}

export interface OtherAssetValue {
  id: string;
  assetId: string;
  date: string;
  value: number;
}

/** Échéancier de remboursement d'un prêt, s'il est complet. */
export function otherAssetLoan(a: OtherAsset): Loan | null {
  if (a.kind !== "pret" || a.loanPrincipal == null || a.loanTermMonths == null || a.loanFirstPayment == null) return null;
  return {
    id: a.id,
    kind: "autre",
    name: a.name,
    propertyId: null,
    share: 1,
    principal: a.loanPrincipal,
    rate: a.loanRate ?? 0,
    termMonths: a.loanTermMonths,
    firstPayment: a.loanFirstPayment,
    insuranceMode: "montant",
    insurance: 0,
    insuranceRate: 0,
    manualPayment: null,
    manualBalance: null,
    manualBalanceDate: null,
    archived: false,
    closedOn: null,
    deferredMonths: 0,
    deferredKind: "partiel",
    prepayments: [],
  };
}

/** Valeur du bien entier à une date : 0 avant l'achat ; dernière estimation connue, diminuée de la baisse annuelle. */
export function otherAssetValueAt(a: OtherAsset, estimates: readonly OtherAssetValue[], date: string): number {
  if (a.purchaseDate != null && date < a.purchaseDate) return 0;
  const loan = otherAssetLoan(a);
  if (loan) return date < loan.firstPayment ? loan.principal : loanState(loan, date).balance;
  const points = [...estimates.filter((e) => e.assetId === a.id).map((e) => ({ date: e.date, value: e.value })), ...(a.valueDate != null ? [{ date: a.valueDate, value: a.value }] : [])].sort((x, y) => x.date.localeCompare(y.date));
  const known = points.filter((x) => x.date <= date).at(-1);
  const base = known ?? (points.length === 0 ? { date: null, value: a.value } : { date: null, value: a.purchasePrice ?? points[0].value });
  if (!a.depreciation || base.date == null) return roundCents(base.value);
  const years = monthsBetween(base.date, date) / 12;
  return roundCents(base.value * Math.pow(1 - a.depreciation, Math.max(0, years)));
}

/** Valeur de la part détenue à une date (droit détenu compris) ; 0 pour un bien archivé. */
export function otherAssetHeldValueAt(a: OtherAsset, estimates: readonly OtherAssetValue[], date: string): number {
  if (a.archived) return 0;
  const ratio = canBeDismembered(a.kind) ? dismembermentRatio(a, date) : 1;
  return roundCents(otherAssetValueAt(a, estimates, date) * a.share * ratio);
}

/** Ce que rapporterait une vente rapide, pour la part détenue. */
export function quickSaleValue(held: number, a: Pick<OtherAsset, "quickSaleDiscount">): number {
  return roundCents(held * (1 - (a.quickSaleDiscount ?? 0)));
}

// ——— Impôt à la vente ———

/**
 * Règles vérifiées le 11 novembre 2026 :
 * - taxe forfaitaire sur le prix de vente : 11 % pour les métaux précieux, 6 % pour les bijoux, objets d'art,
 *   de collection ou d'antiquité, plus 0,5 % de CRDS (CGI, art. 150 VI à 150 VM ; douane, questions-réponses 2025) ;
 *   bijoux et objets vendus 5 000 € ou moins : exonérés ;
 * - option pour le régime des plus-values, si le prix et la date d'achat sont prouvés (CGI, art. 150 VL) :
 *   plus-value imposée à 19 % (art. 200 B) plus les prélèvements sociaux, après un abattement de 5 % par année
 *   de détention au-delà de la deuxième, exonération totale après 22 ans (art. 150 VC) ;
 * - autres meubles vendus 5 000 € ou moins, voitures et meubles meublants : exonérés (art. 150 UA, II) ;
 * - prélèvements sociaux sur ces plus-values : 17,2 %, taux non relevé en 2026 pour les plus-values des articles
 *   150 U à 150 UC (CSS, art. L136-7 et L136-8) — à confirmer.
 */
export const SALE_TAX_VERIFIED_ON = "2026-11-11";
export const SALE_TAX_SOURCES: Array<{ label: string; url: string }> = [
  { label: "BOFiP, taxe forfaitaire et option pour les plus-values (BOI-RPPM-PVBMC-20-20)", url: "https://bofip.impots.gouv.fr/doctrine/BOI-RPPM-PVBMC-20-20" },
  { label: "Douane, taxe sur les métaux précieux, bijoux et objets d'art (questions-réponses 2025)", url: "https://www.douane.gouv.fr/sites/default/files/uploads/files/2025/Annexe%20Q-R.pdf" },
];

const CRDS = 0.005;
const FLAT_METAL = 0.11 + CRDS;
const FLAT_ART = 0.06 + CRDS;
const GAIN_INCOME_TAX = 0.19;
const GAIN_SOCIAL = 0.172;
const SMALL_SALE = 5_000;

export interface SaleTaxOption {
  regime: "forfaitaire" | "plus_value";
  label: string;
  tax: number;
  detail: string;
}

export interface SaleTaxEstimate {
  /** null : non estimé ici (régime différent, ou prix d'achat inconnu). */
  tax: number | null;
  exempt: boolean;
  options: SaleTaxOption[];
  /** Option la plus avantageuse. */
  best: SaleTaxOption | null;
  note: string;
}

/** Abattement pour durée de détention sur la plus-value d'un meuble : 5 % par an au-delà de la deuxième année. */
export function movableGainAllowance(years: number): number {
  if (years >= 22) return 1;
  return Math.round(Math.max(0, years - 2) * 5) / 100;
}

function gainOption(price: number, cost: number | null, purchaseDate: string | null, date: string): SaleTaxOption | null {
  if (cost == null || purchaseDate == null) return null;
  const years = yearsBetween(purchaseDate, date);
  const gain = roundCents(price - cost);
  const allowance = movableGainAllowance(years);
  const taxed = gain > 0 ? roundCents(gain * (1 - allowance)) : 0;
  const tax = roundCents(taxed * (GAIN_INCOME_TAX + GAIN_SOCIAL));
  const pctLabel = Math.round(allowance * 100);
  return {
    regime: "plus_value",
    label: "Régime des plus-values",
    tax,
    detail: gain <= 0 ? "Pas de plus-value : rien à payer." : `Plus-value de ${fmt(gain)}, ${years} an${years > 1 ? "s" : ""} de détention, abattement de ${pctLabel} %, imposée à 19 % + 17,2 %.`,
  };
}

const fmt = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;

/** Impôt estimé si la part détenue était vendue à la date, au régime le plus avantageux. */
export function otherAssetSaleTax(a: OtherAsset, estimates: readonly OtherAssetValue[], date: string): SaleTaxEstimate {
  const price = roundCents(otherAssetValueAt(a, estimates, date) * a.share);
  const cost = a.purchasePrice == null ? null : roundCents(a.purchasePrice * a.share);
  const none = (note: string): SaleTaxEstimate => ({ tax: null, exempt: false, options: [], best: null, note });
  const exempt = (note: string): SaleTaxEstimate => ({ tax: 0, exempt: true, options: [], best: null, note });
  const pick = (options: SaleTaxOption[], note: string): SaleTaxEstimate => {
    const best = options.reduce<SaleTaxOption | null>((b, o) => (b == null || o.tax < b.tax ? o : b), null);
    return { tax: best?.tax ?? null, exempt: false, options, best, note };
  };
  switch (a.kind) {
    case "metal": {
      const flat: SaleTaxOption = { regime: "forfaitaire", label: "Taxe forfaitaire", tax: roundCents(price * FLAT_METAL), detail: `11,5 % du prix de vente (${fmt(price)}), quelle que soit la plus-value.` };
      const gain = gainOption(price, cost, a.purchaseDate, date);
      return pick(gain ? [flat, gain] : [flat], gain ? "Le régime des plus-values suppose de prouver le prix et la date d'achat (facture), et un lot identifiable." : "Indiquez le prix et la date d'achat pour comparer avec le régime des plus-values.");
    }
    case "objet": {
      if (price <= SMALL_SALE) return exempt("Vendu 5 000 € ou moins : exonéré.");
      const flat: SaleTaxOption = { regime: "forfaitaire", label: "Taxe forfaitaire", tax: roundCents(price * FLAT_ART), detail: `6,5 % du prix de vente (${fmt(price)}).` };
      const gain = gainOption(price, cost, a.purchaseDate, date);
      return pick(gain ? [flat, gain] : [flat], gain ? "Le régime des plus-values suppose de prouver le prix et la date d'achat." : "Indiquez le prix et la date d'achat pour comparer avec le régime des plus-values.");
    }
    case "vehicule":
      return exempt("Les voitures sont exonérées d'impôt à la vente (sauf véhicule de collection, imposé comme un objet de collection).");
    case "autre": {
      if (price <= SMALL_SALE) return exempt("Meuble vendu 5 000 € ou moins : exonéré.");
      const gain = gainOption(price, cost, a.purchaseDate, date);
      return gain ? pick([gain], "Plus-value d'un bien meuble.") : none("Indiquez le prix et la date d'achat pour estimer l'impôt.");
    }
    case "societe":
      return none("Plus-value de valeurs mobilières (prélèvement forfaitaire ou barème) : non estimée ici.");
    case "compte_courant":
    case "pret":
      return exempt("Le remboursement du capital n'est pas imposé ; les intérêts reçus le sont, l'année où ils sont versés.");
  }
}

/** Mois restants avant la dernière échéance d'un prêt, pour le délai de récupération ; null sans échéancier. */
export function loanMonthsLeft(a: OtherAsset, date: string): number | null {
  const loan = otherAssetLoan(a);
  if (!loan) return null;
  const end = addMonths(loan.firstPayment, loan.termMonths - 1);
  return end <= date ? 0 : monthsBetween(date, end);
}
