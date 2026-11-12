import type { Account, AccountKind, Asset, AssetKind, Transaction, TxType } from "./domain";
import { holdsEuroFunds, TX_LABELS, TX_NEEDS_ASSET, TX_OPTIONAL_ASSET } from "./domain";

/** Ce titre peut-il être détenu dans ce compte ? Un PER bancaire n'a pas de fonds euros. */
function allowedIn(account: Account, asset: Asset): boolean {
  return ALLOWED_ASSETS[account.kind].includes(asset.kind) && (asset.kind !== "fonds_euros" || holdsEuroFunds(account));
}

/** Opérations qui peuvent viser un fonds euros (le support qui reçoit ou d'où part l'argent). */
export const EURO_FUND_TYPES: readonly TxType[] = ["apport_initial", "versement", "retrait", "interets", "transfert", "frais", "impots", "correction"];

/** Titres qu'on peut détenir dans chaque type de compte. */
export const ALLOWED_ASSETS: Record<AccountKind, readonly AssetKind[]> = {
  livret: [],
  assurance_vie: ["fonds_euros", "etf", "fonds", "obligation", "scpi"],
  pea: ["etf", "action", "fonds"],
  pea_pme: ["etf", "action", "fonds"],
  cto: ["etf", "action", "obligation", "fonds", "scpi"],
  per: ["fonds_euros", "etf", "action", "obligation", "fonds", "scpi"],
  epargne_salariale: ["etf", "fonds"],
  crowdlending: [],
  crypto: ["crypto"],
};

/** Opérations possibles selon le type de compte. */
export const ALLOWED_TYPES: Record<AccountKind, readonly TxType[]> = {
  livret: ["apport_initial", "versement", "retrait", "interets", "transfert", "frais", "impots", "correction"],
  assurance_vie: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "arbitrage", "transfert", "frais", "impots", "correction"],
  pea: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "transfert", "frais", "impots", "correction"],
  pea_pme: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "transfert", "frais", "impots", "correction"],
  per: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "arbitrage", "transfert", "frais", "impots", "correction"],
  crowdlending: ["apport_initial", "versement", "retrait", "interets", "transfert", "frais", "impots", "correction"],
  epargne_salariale: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "arbitrage", "transfert", "frais", "impots", "correction"],
  cto: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "transfert", "frais", "impots", "correction"],
  crypto: ["apport_initial", "versement", "retrait", "interets", "achat", "vente", "arbitrage", "transfert", "frais", "impots", "correction"],
};

export interface FieldError {
  field: keyof Transaction | "form";
  message: string;
}

export function validateTransaction(
  tx: Omit<Transaction, "id"> & { id?: string },
  accounts: ReadonlyMap<string, Account>,
  assets: ReadonlyMap<string, Asset>,
): FieldError[] {
  const errors: FieldError[] = [];
  const account = accounts.get(tx.accountId);
  if (!account) return [{ field: "accountId", message: "Compte introuvable." }];

  if (!ALLOWED_TYPES[account.kind].includes(tx.type)) {
    errors.push({ field: "type", message: `« ${TX_LABELS[tx.type]} » n'est pas possible sur ce compte.` });
  }

  if (tx.type === "correction") {
    if (tx.amount === 0) errors.push({ field: "amount", message: "Une correction ne peut pas être nulle." });
  } else if (!(tx.amount > 0)) {
    errors.push({ field: "amount", message: "Le montant doit être positif (le type donne le sens)." });
  }

  const needsAsset = TX_NEEDS_ASSET.includes(tx.type);
  const optionalAsset = TX_OPTIONAL_ASSET.includes(tx.type);
  // Un fonds euros est le support d'un mouvement d'argent : il ne s'achète ni ne se vend.
  const euroFund = tx.assetId != null && assets.get(tx.assetId)?.kind === "fonds_euros";
  const isArbitrage = tx.type === "arbitrage";
  if (needsAsset && !tx.assetId) errors.push({ field: "assetId", message: "Choisissez le titre." });
  if (isArbitrage) errors.push(...arbitrageErrors(tx, account, assets));
  else if (euroFund && !EURO_FUND_TYPES.includes(tx.type)) {
    errors.push({ field: "assetId", message: "Un fonds euros ne s'achète pas et ne se vend pas : faites un versement, un retrait ou un transfert sur ce support." });
  } else if (!needsAsset && !optionalAsset && tx.assetId && !euroFund) errors.push({ field: "assetId", message: "Ce type d'opération ne porte pas sur un titre." });

  if (tx.assetId && !isArbitrage) {
    const asset = assets.get(tx.assetId);
    if (!asset) errors.push({ field: "assetId", message: "Titre introuvable." });
    else if (!allowedIn(account, asset)) {
      errors.push({ field: "assetId", message: asset.kind === "fonds_euros" ? "Ce compte n'a pas de fonds euros (un PER bancaire n'en a pas)." : "Ce titre ne peut pas être détenu dans ce type de compte." });
    }
  }

  if (needsAsset && !(tx.quantity && tx.quantity > 0)) {
    errors.push({ field: "quantity", message: "Indiquez la quantité (parts, BTC ou nominal pour une obligation)." });
  }
  if (!needsAsset && !isArbitrage && tx.quantity != null) errors.push({ field: "quantity", message: "Pas de quantité pour ce type d'opération." });

  const isIncome = tx.type === "dividende" || tx.type === "interets";
  if (!isIncome && (tx.gross != null || tx.withheldIncomeTax != null || tx.withheldSocial != null || tx.withheldForeign != null)) {
    errors.push({ field: "gross", message: "Le brut et les retenues ne concernent que les dividendes et les intérêts." });
  }
  if (isIncome && tx.gross != null && tx.gross < tx.amount - 0.01) {
    errors.push({ field: "gross", message: "Le brut ne peut pas être inférieur au montant reçu." });
  }

  if (tx.type === "transfert") {
    const target = tx.counterAccountId ? accounts.get(tx.counterAccountId) : undefined;
    if (!tx.counterAccountId) errors.push({ field: "counterAccountId", message: "Choisissez le compte de destination." });
    else if (tx.counterAccountId === tx.accountId) errors.push({ field: "counterAccountId", message: "Le compte de destination doit être différent." });
    else if (!target) errors.push({ field: "counterAccountId", message: "Compte de destination introuvable." });
    if (tx.counterAssetId) {
      const fund = assets.get(tx.counterAssetId);
      if (fund?.kind !== "fonds_euros") errors.push({ field: "counterAssetId", message: "Le support d'arrivée doit être un fonds euros." });
      else if (target && !holdsEuroFunds(target)) errors.push({ field: "counterAssetId", message: "Ce compte de destination n'a pas de fonds euros." });
    }
  } else if (tx.counterAccountId) {
    errors.push({ field: "counterAccountId", message: "Seul un transfert a un compte de destination." });
  } else if (tx.counterAssetId && !isArbitrage) {
    errors.push({ field: "counterAssetId", message: "Seul un transfert ou un arbitrage a un support d'arrivée." });
  }
  if (!isArbitrage && tx.counterQuantity != null) errors.push({ field: "counterQuantity", message: "Seul un arbitrage a une quantité reçue." });

  if (tx.fee != null) {
    if (tx.type !== "achat" && tx.type !== "vente" && !isArbitrage) errors.push({ field: "fee", message: "Les frais inclus ne concernent que les achats, les ventes et les arbitrages." });
    else if (tx.fee >= Math.abs(tx.amount)) errors.push({ field: "fee", message: "Les frais dépassent le montant." });
  }

  return errors;
}

/**
 * Arbitrage : d'un support à un autre du même compte. Un fonds euros donne ou reçoit des euros (pas de quantité) ;
 * un titre, une quantité. Une obligation s'achète et se vend : son prix de revient suit ses lots.
 */
function arbitrageErrors(tx: Omit<Transaction, "id">, account: Account, assets: ReadonlyMap<string, Asset>): FieldError[] {
  const errors: FieldError[] = [];
  const side = (assetId: string | null | undefined, field: "assetId" | "counterAssetId", quantity: number | null | undefined, quantityField: "quantity" | "counterQuantity", what: string) => {
    if (!assetId) return errors.push({ field, message: what === "cédé" ? "Choisissez le support cédé." : "Choisissez le support reçu." });
    const asset = assets.get(assetId);
    if (!asset) return errors.push({ field, message: "Support introuvable." });
    if (!allowedIn(account, asset)) return errors.push({ field, message: "Ce support ne peut pas être détenu dans ce compte." });
    if (asset.kind === "obligation") return errors.push({ field, message: "Une obligation s'achète et se vend : l'arbitrage ne la prend pas." });
    if (asset.kind === "fonds_euros") {
      if (quantity != null) errors.push({ field: quantityField, message: "Un fonds euros se compte en euros : pas de quantité." });
    } else if (!(quantity && quantity > 0)) errors.push({ field: quantityField, message: what === "cédé" ? "Indiquez la quantité cédée." : "Indiquez la quantité reçue." });
    return 0;
  };
  side(tx.assetId, "assetId", tx.quantity, "quantity", "cédé");
  side(tx.counterAssetId, "counterAssetId", tx.counterQuantity, "counterQuantity", "reçu");
  if (tx.assetId && tx.assetId === tx.counterAssetId) errors.push({ field: "counterAssetId", message: "Le support reçu doit être différent du support cédé." });
  return errors;
}

/**
 * Comptes limités à un seul par personne (règle légale) : PEA, LEP, LDDS, Livret A.
 * Les comptes-titres, assurances-vie et autres livrets sont illimités. Un compte archivé ne compte pas.
 * Renvoie le compte existant qui bloque, sinon null.
 */
export function uniqueAccountConflict(accounts: readonly Account[], candidate: Pick<Account, "kind" | "livretType"> & { id?: string; archived?: boolean }): Account | null {
  if (candidate.archived) return null;
  const single = candidate.kind === "pea" || candidate.kind === "pea_pme";
  const limited = single || (candidate.kind === "livret" && candidate.livretType != null && candidate.livretType !== "AUTRE");
  if (!limited) return null;
  return (
    accounts.find(
      (a) => a.id !== candidate.id && !a.archived && a.kind === candidate.kind && (single || a.livretType === candidate.livretType),
    ) ?? null
  );
}
