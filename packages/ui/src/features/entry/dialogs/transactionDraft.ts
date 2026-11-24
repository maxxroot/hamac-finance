import type { AccountKind, AssetKind, Transaction, TxType } from "@hamac/core";
import { todayIso } from "@/shared/lib/numbers";
import type { PriceBasis } from "@/features/entry/lib/tradeAmounts";
import { fxDraftOf, NO_FX, type FxDraft } from "@/features/entry/lib/fxEntry";
import type { NewAsset } from "./NewAssetPanel";
import type { Deposit } from "./DepositElsewhere";

/** Brouillon du formulaire de saisie d'une opération : vierge (selon un préréglage) ou repris d'une opération. */

/** Titre en devise : taux de change et total en devise (`FxDraft`). */
export interface Draft extends FxDraft {
  id?: string;
  date: string;
  type: TxType;
  accountId: string;
  assetId: string | null;
  counterAccountId: string | null;
  /** Fonds euros d'arrivée d'un transfert vers un contrat ; null = son support par défaut. */
  counterAssetId: string | null;
  amount: number | null;
  quantity: number | null;
  /** Arbitrage : quantité reçue du support d'arrivée. */
  counterQuantity: number | null;
  fee: number | null;
  /** Les frais ont été saisis à la main : on ne les recalcule plus. */
  feeManual: boolean;
  /** Obligation : coupon couru saisi à la main ; null = calculé d'après la date. */
  accrued: number | null;
  /** Prix d'une unité hors frais, ou en % du nominal pour une obligation (aide à la saisie, non stocké). */
  unitPrice: number | null;
  /** Le prix unitaire ou le total a été saisi : l'autre se calcule. */
  priceBasis: PriceBasis;
  comment: string;
  /** Titre à créer avec l'opération (achat d'un titre pas encore connu). */
  newAsset: NewAsset | null;
  /** Fonds euros à créer avec l'opération : son nom (versement sur un nouveau support). */
  newFund: string | null;
  /** Dividendes et intérêts : brut et retenues, facultatifs. */
  gross: number | null;
  withheldIncomeTax: number | null;
  withheldSocial: number | null;
  withheldForeign: number | null;
  /** Retrait : versement de la même somme sur un autre compte, enregistré avec lui. */
  deposit: Deposit | null;
}

export interface TxPreset {
  accountId?: string;
  type?: TxType;
  assetId?: string;
  /** Titres proposés (ex. seulement des obligations depuis la page Obligations). */
  assetKinds?: AssetKind[];
  /** Comptes proposés (ex. PEA et comptes-titres depuis Actions & ETF). */
  accountKinds?: AccountKind[];
}

export function blank(preset: TxPreset, fallbackAccount: string): Draft {
  return {
    date: todayIso(),
    type: preset.type ?? "versement",
    accountId: preset.accountId ?? fallbackAccount,
    assetId: preset.assetId ?? null,
    counterAccountId: null,
    counterAssetId: null,
    amount: null,
    quantity: null,
    counterQuantity: null,
    fee: null,
    feeManual: false,
    accrued: null,
    unitPrice: null,
    priceBasis: "total",
    comment: "",
    newAsset: null,
    newFund: null,
    gross: null,
    withheldIncomeTax: null,
    withheldSocial: null,
    withheldForeign: null,
    deposit: null,
    ...NO_FX,
  };
}

export function fromTx(tx: Transaction): Draft {
  return { ...tx, counterAssetId: tx.counterAssetId ?? null, counterQuantity: tx.counterQuantity ?? null, feeManual: tx.fee != null, accrued: tx.accrued ?? null, unitPrice: null, priceBasis: "total", newAsset: null, newFund: null, gross: tx.gross ?? null, withheldIncomeTax: tx.withheldIncomeTax ?? null, withheldSocial: tx.withheldSocial ?? null, withheldForeign: tx.withheldForeign ?? null, deposit: null, ...fxDraftOf(tx.fxRate) };
}
