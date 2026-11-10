import type { Account, AccountKind, Asset, AssetKind, Transaction, TxType } from "./domain";
import { TX_LABELS, TX_NEEDS_ASSET, TX_OPTIONAL_ASSET } from "./domain";

/** Titres qu'on peut détenir dans chaque type de compte. */
export const ALLOWED_ASSETS: Record<AccountKind, readonly AssetKind[]> = {
  livret: [],
  assurance_vie: ["etf", "fonds", "obligation", "scpi"],
  pea: ["etf", "action", "fonds"],
  pea_pme: ["etf", "action", "fonds"],
  cto: ["etf", "action", "obligation", "fonds", "scpi"],
  per: ["etf", "action", "obligation", "fonds", "scpi"],
  epargne_salariale: ["etf", "fonds"],
  crowdlending: [],
  crypto: ["crypto"],
};

/** Opérations possibles selon le type de compte. */
export const ALLOWED_TYPES: Record<AccountKind, readonly TxType[]> = {
  livret: ["apport_initial", "versement", "retrait", "interets", "transfert", "frais", "impots", "correction"],
  assurance_vie: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "transfert", "frais", "impots", "correction"],
  pea: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "transfert", "frais", "impots", "correction"],
  pea_pme: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "transfert", "frais", "impots", "correction"],
  per: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "transfert", "frais", "impots", "correction"],
  crowdlending: ["apport_initial", "versement", "retrait", "interets", "transfert", "frais", "impots", "correction"],
  epargne_salariale: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "transfert", "frais", "impots", "correction"],
  cto: ["apport_initial", "versement", "retrait", "interets", "dividende", "achat", "vente", "transfert", "frais", "impots", "correction"],
  crypto: ["apport_initial", "versement", "retrait", "interets", "achat", "vente", "transfert", "frais", "impots", "correction"],
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
  if (needsAsset && !tx.assetId) errors.push({ field: "assetId", message: "Choisissez le titre." });
  if (!needsAsset && !optionalAsset && tx.assetId) errors.push({ field: "assetId", message: "Ce type d'opération ne porte pas sur un titre." });

  if (tx.assetId) {
    const asset = assets.get(tx.assetId);
    if (!asset) errors.push({ field: "assetId", message: "Titre introuvable." });
    else if (!ALLOWED_ASSETS[account.kind].includes(asset.kind)) {
      errors.push({ field: "assetId", message: "Ce titre ne peut pas être détenu dans ce type de compte." });
    }
  }

  if (needsAsset && !(tx.quantity && tx.quantity > 0)) {
    errors.push({ field: "quantity", message: "Indiquez la quantité (parts, BTC ou nominal pour une obligation)." });
  }
  if (!needsAsset && tx.quantity != null) errors.push({ field: "quantity", message: "Pas de quantité pour ce type d'opération." });

  const isIncome = tx.type === "dividende" || tx.type === "interets";
  if (!isIncome && (tx.gross != null || tx.withheldIncomeTax != null || tx.withheldSocial != null || tx.withheldForeign != null)) {
    errors.push({ field: "gross", message: "Le brut et les retenues ne concernent que les dividendes et les intérêts." });
  }
  if (isIncome && tx.gross != null && tx.gross < tx.amount - 0.01) {
    errors.push({ field: "gross", message: "Le brut ne peut pas être inférieur au montant reçu." });
  }

  if (tx.type === "transfert") {
    if (!tx.counterAccountId) errors.push({ field: "counterAccountId", message: "Choisissez le compte de destination." });
    else if (tx.counterAccountId === tx.accountId) errors.push({ field: "counterAccountId", message: "Le compte de destination doit être différent." });
    else if (!accounts.get(tx.counterAccountId)) errors.push({ field: "counterAccountId", message: "Compte de destination introuvable." });
  } else if (tx.counterAccountId) {
    errors.push({ field: "counterAccountId", message: "Seul un transfert a un compte de destination." });
  }

  if (tx.fee != null) {
    if (tx.type !== "achat" && tx.type !== "vente") errors.push({ field: "fee", message: "Les frais inclus ne concernent que les achats et ventes." });
    else if (tx.fee >= Math.abs(tx.amount)) errors.push({ field: "fee", message: "Les frais dépassent le montant." });
  }

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
