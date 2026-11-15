/**
 * Vocabulaire métier de Hamac.
 *
 * Enveloppe = le cadre fiscal et juridique, c'est-à-dire un type : livret réglementé, assurance-vie,
 *             PEA, PEA-PME, compte-titres, PER, épargne salariale. Les plateformes crypto et de
 *             crowdlending ne sont pas des enveloppes : ce sont des placements détenus en direct.
 * Compte    = une enveloppe précise ouverte chez un établissement (« PEA Bourso »), ou une plateforme
 *             (« Binance »), avec ses propres espèces. On dit « contrat » pour l'assurance-vie et le PER.
 * Support / placement = ce qu'on met dans un compte (fonds euros, ETF, action, obligation, crypto…).
 * Titre     = un support identifié, acheté dans un compte (entité `Asset`).
 * Classe d'actifs = le regroupement des supports pour l'allocation cible.
 * Opération = un mouvement daté dans un compte (versement, achat, coupon, transfert…).
 */

export const ACCOUNT_KINDS = ["livret", "assurance_vie", "pea", "pea_pme", "cto", "per", "epargne_salariale", "crowdlending", "crypto"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  livret: "Livret",
  assurance_vie: "Assurance-vie",
  pea: "PEA",
  pea_pme: "PEA-PME",
  cto: "Compte-titres",
  per: "PER (retraite)",
  epargne_salariale: "Épargne salariale (PEE, PERCO)",
  crowdlending: "Crowdlending",
  crypto: "Plateforme crypto",
};

/**
 * PER assurantiel (contrat chez un assureur : fonds euros et unités de compte) ou bancaire (compte-titres
 * chez une banque ou un courtier, sans fonds euros). Un PER sans type, d'avant ce choix, est assurantiel.
 */
export const PER_KINDS = ["assurantiel", "bancaire"] as const;
export type PerKind = (typeof PER_KINDS)[number];
export const PER_KIND_LABELS: Record<PerKind, string> = { assurantiel: "PER assurantiel", bancaire: "PER bancaire" };

/** Ce qu'il faut savoir d'un compte pour son vocabulaire et ses supports. */
export type AccountLike = { kind: AccountKind; perKind?: PerKind | null };
const like = (a: AccountKind | AccountLike): AccountLike => (typeof a === "string" ? { kind: a } : a);

export function isBankPer(a: AccountKind | AccountLike): boolean {
  const x = like(a);
  return x.kind === "per" && x.perKind === "bancaire";
}

/** Types de compte qui sont des enveloppes fiscales ; les autres sont des plateformes de placement. */
export const ENVELOPE_KINDS: readonly AccountKind[] = ["livret", "assurance_vie", "pea", "pea_pme", "cto", "per", "epargne_salariale"];

export function isEnvelope(kind: AccountKind): boolean {
  return ENVELOPE_KINDS.includes(kind);
}

/** « contrat » pour l'assurance-vie et le PER assurantiel, « compte » pour le reste (PER bancaire compris). */
export function accountNoun(a: AccountKind | AccountLike): "contrat" | "compte" {
  const x = like(a);
  return x.kind === "assurance_vie" || (x.kind === "per" && !isBankPer(x)) ? "contrat" : "compte";
}

export const LIVRET_TYPES = ["LEP", "LDDS", "LIVRET_A", "AUTRE"] as const;
export type LivretType = (typeof LIVRET_TYPES)[number];
export const LIVRET_LABELS: Record<LivretType, string> = {
  LEP: "LEP",
  LDDS: "LDDS",
  LIVRET_A: "Livret A",
  AUTRE: "Autre livret",
};
/** Plafonds légaux de dépôt (hors intérêts capitalisés). */
export const LIVRET_LEGAL_CEILINGS: Record<LivretType, number | null> = {
  LEP: 10_000,
  LDDS: 12_000,
  LIVRET_A: 22_950,
  AUTRE: null,
};

/**
 * Classes d'actifs (regroupements des supports). L'allocation cible se règle classe par classe
 * dans « Ma répartition cible », et chaque élément peut y déroger.
 * Identifiants techniques inchangés, libellés concrets.
 */
export const BUCKETS = ["precaution", "liquidites", "garanti", "obligations", "croissance", "matieres_premieres", "immobilier", "crowdlending", "speculatif"] as const;
export type Bucket = (typeof BUCKETS)[number];
export const BUCKET_LABELS: Record<Bucket, string> = {
  precaution: "Livrets",
  liquidites: "Liquidités",
  garanti: "Fonds euros",
  obligations: "Obligations",
  croissance: "Actions",
  matieres_premieres: "Matières premières",
  immobilier: "Immobilier",
  crowdlending: "Crowdlending",
  speculatif: "Crypto",
};

/**
 * Classe où le plan place l'argent d'un compte : la projection y verse ses versements programmés,
 * et l'écart au plan y fait grandir ses espèces et ses versements. Le compte-titres reste celui des obligations du plan.
 */
const PLANNED_BUCKET: Record<AccountKind, Bucket> = {
  livret: "precaution",
  assurance_vie: "garanti",
  pea: "croissance",
  pea_pme: "croissance",
  cto: "obligations",
  per: "garanti", // PER assurantiel, comme une assurance-vie ; un PER bancaire : voir plannedBucketOf
  epargne_salariale: "croissance",
  crowdlending: "crowdlending",
  crypto: "speculatif",
};

/** ETC : titre coté adossé à une matière première (or, argent…), sans composition de titres. */
export const ASSET_KINDS = ["etf", "etc", "action", "obligation", "crypto", "fonds", "scpi", "fonds_euros"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  etf: "ETF",
  etc: "ETC (matières premières)",
  action: "Action",
  obligation: "Obligation",
  crypto: "Crypto",
  fonds: "Fonds / OPCVM",
  scpi: "SCPI",
  fonds_euros: "Fonds euros",
};
/**
 * Le nom désigne-t-il un ETC (or, argent, métaux… physiques) ? Les émetteurs l'écrivent en toutes lettres
 * (« iShares Physical Gold ETC », « Amundi Physical Gold »). Les ETN sur crypto, cotés à côté, n'en sont pas.
 */
export function looksLikeEtc(name: string | null | undefined): boolean {
  const n = name ?? "";
  if (/bitcoin|\bbtc\b|ether|crypto|solana/i.test(n)) return false;
  return /\bETC\b/i.test(n) || /\bphys(ical|ique)?\b.*\b(gold|silver|platinum|palladium|precious|metals?|or|argent)\b/i.test(n);
}

export const ASSET_BUCKET: Record<AssetKind, Bucket> = {
  etf: "croissance",
  etc: "matieres_premieres",
  action: "croissance",
  fonds: "croissance",
  obligation: "obligations",
  crypto: "speculatif",
  scpi: "immobilier",
  fonds_euros: "garanti",
};

/**
 * Fonds euros : support d'un contrat d'assurance-vie ou de PER, à capital garanti. Il n'a pas de cours :
 * une part vaut 1 €, sa valeur est son solde. Il est propre à l'assureur et peut figurer dans plusieurs contrats.
 */
export const EURO_FUND_ACCOUNT_KINDS: readonly AccountKind[] = ["assurance_vie", "per"];

/** Un PER bancaire n'a pas de fonds euros. */
export function holdsEuroFunds(a: AccountKind | AccountLike): boolean {
  const x = like(a);
  return EURO_FUND_ACCOUNT_KINDS.includes(x.kind) && !isBankPer(x);
}

/**
 * Classe d'actifs des espèces de ce compte. Le solde d'un livret est le placement lui-même, et l'argent d'un contrat
 * à fonds euros (assurance-vie, PER assurantiel) sans support précisé est celui du fonds euros, comme avant les supports.
 * Ailleurs, les espèces sont de l'argent disponible, qui n'appartient à aucune classe de titres : un compte-titres peut
 * aussi bien acheter des actions que des obligations. Les titres, eux, comptent dans la classe de leur type.
 */
export function cashBucketOf(a: AccountLike): Bucket {
  if (a.kind === "livret") return "precaution";
  return holdsEuroFunds(a) ? "garanti" : "liquidites";
}

/** Classe où le plan place l'argent de ce compte (projection, écart au plan) : un PER bancaire investit comme un PEA. */
export function plannedBucketOf(a: AccountLike): Bucket {
  return isBankPer(a) ? "croissance" : PLANNED_BUCKET[a.kind];
}

/** Les espèces de ce compte comptent-elles dans l'allocation cible ? Le choix du compte prime sur celui de sa classe. */
export function cashInAllocation(account: AccountLike & Pick<Account, "inAllocation">, enabled: (key: string) => boolean): boolean {
  return account.inAllocation ?? enabled(cashBucketOf(account));
}

/** Ce titre compte-t-il dans l'allocation cible ? Son choix prime sur celui du compte, puis de sa classe. */
export function positionInAllocation(asset: Pick<Asset, "inAllocation">, account: Pick<Account, "inAllocation">, classKey: string, enabled: (key: string) => boolean): boolean {
  return asset.inAllocation ?? account.inAllocation ?? enabled(classKey);
}

export const BOND_KINDS = ["etat", "entreprise"] as const;
export type BondKind = (typeof BOND_KINDS)[number];
export const BOND_KIND_LABELS: Record<BondKind, string> = { etat: "OAT (État)", entreprise: "Obligation d'entreprise" };

export const PRICE_SOURCES = ["auto", "manuel", "modele"] as const;
/** auto = fournisseur de cours ; manuel = saisi ; modele = calculé (obligation détenue à l'échéance). */
export type PriceSource = (typeof PRICE_SOURCES)[number];

/** Fournisseurs de cours automatiques. « url » : adresse propre à un titre. */
export const PRICE_PROVIDERS = ["justetf", "euronext", "twelvedata", "yahoo", "coingecko", "url"] as const;
export type PriceProvider = (typeof PRICE_PROVIDERS)[number];
export const PRICE_PROVIDER_LABELS: Record<PriceProvider, string> = {
  justetf: "justETF",
  euronext: "Euronext",
  twelvedata: "Twelve Data",
  yahoo: "Yahoo Finance",
  coingecko: "CoinGecko",
  url: "URL personnalisée",
};

export const TX_TYPES = [
  "apport_initial",
  "versement",
  "retrait",
  "interets",
  "dividende",
  "achat",
  "vente",
  "arbitrage",
  "transfert",
  "frais",
  "impots",
  "correction",
] as const;
export type TxType = (typeof TX_TYPES)[number];

export const TX_LABELS: Record<TxType, string> = {
  apport_initial: "Apport initial",
  versement: "Versement",
  retrait: "Retrait",
  interets: "Intérêts / coupon",
  dividende: "Dividende",
  achat: "Achat",
  vente: "Vente",
  arbitrage: "Arbitrage",
  transfert: "Transfert",
  frais: "Frais",
  impots: "Impôts",
  correction: "Correction",
};

export const TX_HELP: Record<TxType, string> = {
  apport_initial: "Argent déjà présent au démarrage du plan.",
  versement: "Versement ponctuel en plus des versements mensuels.",
  retrait: "Argent qui sort du plan.",
  interets: "Intérêts d'un livret ou d'un fonds euros (datés du 31/12), coupon d'obligation. Montant net, tel que crédité.",
  dividende: "Dividende versé en espèces sur le compte.",
  achat: "Montant = total débité, frais compris. Quantité = parts, BTC, ou nominal pour une obligation.",
  vente: "Montant = total reçu, frais déduits.",
  arbitrage: "D'un support à un autre dans le même compte, sans passer par les espèces : du fonds euros vers une unité de compte, ou d'une crypto à une autre. Montant = valeur du support cédé, en euros. Rien d'imposable : l'argent reste dans le contrat, ou en crypto.",
  transfert: "D'un compte vers un autre, en une seule opération (ex. excédent des livrets vers le fonds euros).",
  frais: "Frais facturés à part (droits de garde, frais de gestion…).",
  impots: "Impôts ou prélèvements sociaux débités à part, par exemple ceux qu'une plateforme de crowdlending retient sur ses intérêts.",
  correction: "Aligne le calcul sur la valeur réelle (relevé). Peut être négative.",
};

/** Types qui exigent un titre et une quantité. */
export const TX_NEEDS_ASSET: readonly TxType[] = ["achat", "vente"];
/** Types qui acceptent un titre optionnel (coupon d'une obligation, dividende d'un ETF). */
export const TX_OPTIONAL_ASSET: readonly TxType[] = ["interets", "dividende"];
/** Types qui comptent dans le « versé net » (argent apporté ou retiré par l'épargnant). */
export const TX_CONTRIBUTION: readonly TxType[] = ["apport_initial", "versement", "retrait"];

// ——— Entités ———

export interface Account {
  id: string;
  kind: AccountKind;
  livretType: LivretType | null;
  name: string;
  /** Établissement qui tient le compte (grille de frais). */
  institutionId: string | null;
  openedOn: string | null;
  /** Plafond de dépôt (livrets), en euros. */
  depositCeiling: number | null;
  /** Taux actuel (livrets) ou taux servi attendu. */
  rate: number | null;
  role: string;
  /** Assurance-vie : clause bénéficiaire rédigée. */
  beneficiaryClause: boolean;
  /**
   * Assurance-vie et PER : fonds euros qui reçoit l'argent du contrat quand une opération ne précise pas
   * de support (versements, intérêts, frais, achats et ventes d'unités de compte, versements programmés).
   */
  defaultAssetId?: string | null;
  /** PER : assurantiel ou bancaire ; null pour les autres comptes (et un PER d'avant ce choix, assurantiel). */
  perKind?: PerKind | null;
  entryFeeRate: number | null;
  managementFeeRate: number | null;
  /** PEA : nombre de mois pour investir l'apport de départ (achat conseillé). */
  monthsToInvest: number | null;
  /** Dans ou hors de l'allocation cible ; null = selon le type (livrets et crypto hors, le reste dedans). */
  inAllocation: boolean | null;
  /** Part détenue (fraction) d'un compte joint : seule cette part compte dans le patrimoine et la répartition. */
  share: number;
  sortOrder: number;
  archived: boolean;
}

/** Comptes qui peuvent être ouverts à plusieurs : les autres (PEA, assurance-vie, livrets réglementés…) sont individuels. */
export function canBeJoint(a: Pick<Account, "kind" | "livretType">): boolean {
  return a.kind === "cto" || a.kind === "crypto" || (a.kind === "livret" && (a.livretType ?? "AUTRE") === "AUTRE");
}

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  isin: string | null;
  /** Symbole chez le fournisseur de cours (ex. PSP5.PA, bitcoin). */
  symbol: string | null;
  priceSource: PriceSource;
  /** Source imposée pour ce titre ; null = la chaîne de sources (Paramètres › Cours). */
  priceProvider: PriceProvider | null;
  /** Source « url » : adresse ({isin}, {symbol}) renvoyant du JSON, et chemin du prix (ex. data.0.close). */
  priceUrl: string | null;
  pricePath: string | null;
  manualPrice: number | null;
  manualPriceDate: string | null;
  /** Classe d'actifs personnalisée (Paramètres › Plan) ; null = classe par défaut selon le type. */
  classId: string | null;
  /** Dans ou hors de l'allocation cible ; null = comme son compte, sinon selon le type. */
  inAllocation: boolean | null;
  /** Poids cible parmi les actions (somme = 100 %). */
  targetWeight: number | null;
  /** Frais de gestion annuels (TER), déjà déduits du cours. */
  ter: number | null;
  /** Obligations : taux du coupon annuel (fraction) et échéance. */
  couponRate: number | null;
  maturityDate: string | null;
  couponFrequency: number | null;
  /** Une date de coupon connue ; null = déduite de l'échéance. */
  nextCouponDate: string | null;
  issuer: string | null;
  /** Obligations : d'État (OAT…) ou d'entreprise. */
  bondKind: BondKind | null;
  archived: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  type: TxType;
  accountId: string;
  assetId: string | null;
  /** Compte de destination d'un transfert. */
  counterAccountId: string | null;
  /** Fonds euros d'arrivée d'un transfert vers un contrat ; null = son support par défaut. Arbitrage : support reçu. */
  counterAssetId?: string | null;
  /** Arbitrage : quantité reçue du support d'arrivée (null pour un fonds euros, qui reçoit des euros). */
  counterQuantity?: number | null;
  /** Montant en euros, toujours positif sauf pour une correction. */
  amount: number;
  quantity: number | null;
  /** Frais inclus dans le montant (achat/vente), en euros. */
  fee: number | null;
  /** Obligation, achat ou vente : coupon couru compris dans le montant, saisi à la main ; null = calculé d'après la date. */
  accrued?: number | null;
  comment: string;
  /** Identifiant dans un fichier importé : réimporter le même fichier ne crée pas de doublon. */
  externalId?: string | null;
  /** Dividende ou intérêts : revenu brut avant toute retenue ; `amount` reste le net crédité, sauf quand les retenues sont débitées à part (crowdlending). */
  gross?: number | null;
  /** Acompte d'impôt (prélèvement forfaitaire non libératoire) retenu à la source. */
  withheldIncomeTax?: number | null;
  /** Prélèvements sociaux retenus à la source. */
  withheldSocial?: number | null;
  /** Retenue à la source prélevée à l'étranger. */
  withheldForeign?: number | null;
}

/** Versement mensuel programmé : à partir du mois `fromMonth` (AAAA-MM), `amount` €/mois. 0 = arrêt. */
export interface ContributionPlan {
  id: string;
  accountId: string;
  fromMonth: string;
  amount: number;
  comment: string;
}

/** Mois où un versement programmé n'a pas eu lieu (en tout ou partie). */
export interface ContributionSkip {
  id: string;
  accountId: string;
  month: string;
  amount: number;
  comment: string;
}

/** Achat d'obligation prévu (pas encore réalisé). */
export interface BondPlan {
  id: string;
  accountId: string | null;
  label: string;
  targetYear: number;
  nominal: number;
  comment: string;
}

/** Taux servi par un fonds euros dans un contrat, pour une année (il peut être bonifié selon le contrat). */
export interface FundRate {
  accountId: string;
  assetId: string;
  year: number;
  rate: number;
  comment: string;
}

export interface Statement {
  id: string;
  accountId: string;
  date: string;
  value: number;
  comment: string;
}

export interface PricePoint {
  assetId: string;
  date: string;
  price: number;
  source: string;
}

export interface PlannedExpense {
  id: string;
  year: number;
  amount: number;
  label: string;
  accountId: string | null;
}
