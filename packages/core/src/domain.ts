/**
 * Vocabulaire métier de Hamac.
 *
 * Compte  = un contenant avec ses propres espèces (un livret, un contrat d'assurance-vie, un PEA,
 *           un compte-titres, une plateforme crypto).
 * Titre   = ce qu'on achète dans un compte (ETF, action, obligation, crypto, fonds).
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
 * Classes d'actifs (ce que contiennent les enveloppes). L'allocation cible se règle classe par classe
 * dans « Ma répartition cible », et chaque élément peut y déroger.
 * Identifiants techniques inchangés, libellés concrets.
 */
export const BUCKETS = ["precaution", "garanti", "obligations", "croissance", "immobilier", "crowdlending", "speculatif"] as const;
export type Bucket = (typeof BUCKETS)[number];
export const BUCKET_LABELS: Record<Bucket, string> = {
  precaution: "Livrets",
  garanti: "Fonds euros",
  obligations: "Obligations",
  croissance: "Actions",
  immobilier: "Immobilier",
  crowdlending: "Crowdlending",
  speculatif: "Crypto",
};

/** Classe d'actifs des espèces d'un compte (le titre détermine celle des positions). */
export const CASH_BUCKET: Record<AccountKind, Bucket> = {
  livret: "precaution",
  assurance_vie: "garanti", // les espèces d'une assurance-vie = le fonds euros
  pea: "croissance",
  pea_pme: "croissance",
  cto: "obligations",
  per: "garanti", // comme une assurance-vie : les espèces = le fonds en euros
  epargne_salariale: "garanti", // fonds monétaire ou en attente d'arbitrage
  crowdlending: "crowdlending",
  crypto: "speculatif",
};

export const ASSET_KINDS = ["etf", "action", "obligation", "crypto", "fonds", "scpi"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  etf: "ETF",
  action: "Action",
  obligation: "Obligation",
  crypto: "Crypto",
  fonds: "Fonds / OPCVM",
  scpi: "SCPI",
};
export const ASSET_BUCKET: Record<AssetKind, Bucket> = {
  etf: "croissance",
  action: "croissance",
  fonds: "croissance",
  obligation: "obligations",
  crypto: "speculatif",
  scpi: "immobilier",
};

/** Les espèces de ce compte comptent-elles dans l'allocation cible ? Le choix du compte prime sur celui de sa classe. */
export function cashInAllocation(account: Pick<Account, "kind" | "inAllocation">, enabled: (key: string) => boolean): boolean {
  return account.inAllocation ?? enabled(CASH_BUCKET[account.kind]);
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
  "transfert",
  "frais",
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
  transfert: "Transfert",
  frais: "Frais",
  correction: "Correction",
};

export const TX_HELP: Record<TxType, string> = {
  apport_initial: "Argent déjà présent au démarrage du plan.",
  versement: "Versement ponctuel en plus des versements mensuels.",
  retrait: "Argent qui sort du plan.",
  interets: "Intérêts d'un livret ou du fonds euros (datés du 31/12), coupon d'obligation. Montant net, tel que crédité.",
  dividende: "Dividende versé en espèces sur le compte.",
  achat: "Montant = total débité, frais compris. Quantité = parts, BTC, ou nominal pour une obligation.",
  vente: "Montant = total reçu, frais déduits.",
  transfert: "D'un compte vers un autre, en une seule opération (ex. excédent des livrets vers le fonds euros).",
  frais: "Frais facturés à part (droits de garde, frais de gestion…).",
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
  entryFeeRate: number | null;
  managementFeeRate: number | null;
  /** PEA : nombre de mois pour investir l'apport de départ (achat conseillé). */
  monthsToInvest: number | null;
  /** Dans ou hors de l'allocation cible ; null = selon le type (livrets et crypto hors, le reste dedans). */
  inAllocation: boolean | null;
  sortOrder: number;
  archived: boolean;
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
  /** Montant en euros, toujours positif sauf pour une correction. */
  amount: number;
  quantity: number | null;
  /** Frais inclus dans le montant (achat/vente), en euros. */
  fee: number | null;
  comment: string;
  /** Identifiant dans un fichier importé : réimporter le même fichier ne crée pas de doublon. */
  externalId?: string | null;
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

/** Ligne prévue de l'échelle d'obligations (pas encore achetée). */
export interface BondPlan {
  id: string;
  accountId: string | null;
  label: string;
  targetYear: number;
  nominal: number;
  comment: string;
}

export interface FundRate {
  accountId: string;
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
