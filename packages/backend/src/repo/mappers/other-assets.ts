import type { OtherAsset, OtherAssetValue } from "@hamac/core";
import * as t from "../../db/schema";
import { fromCents, fromCentsOrNull } from "../../db/units";

/** Lignes de la base → autres biens et leurs estimations. */

export const mapOtherAsset = (r: typeof t.otherAssets.$inferSelect): OtherAsset => ({
  id: r.id,
  kind: r.kind as OtherAsset["kind"],
  name: r.name,
  value: fromCents(r.valueCents),
  valueDate: r.valueDate,
  purchasePrice: fromCentsOrNull(r.purchasePriceCents),
  purchaseDate: r.purchaseDate,
  share: r.share,
  dismemberment: r.dismemberment as OtherAsset["dismemberment"],
  usufructBirthDate: r.usufructBirthDate,
  usufructEnd: r.usufructEnd,
  depreciation: r.depreciation,
  quickSaleDiscount: r.quickSaleDiscount,
  saleDelayMonths: r.saleDelayMonths,
  loanPrincipal: fromCentsOrNull(r.loanPrincipalCents),
  loanRate: r.loanRate,
  loanTermMonths: r.loanTermMonths,
  loanFirstPayment: r.loanFirstPayment,
  classId: r.classId,
  inAllocation: r.inAllocation,
  comment: r.comment,
  archived: r.archived,
});

export const mapOtherAssetValue = (r: typeof t.otherAssetValues.$inferSelect): OtherAssetValue => ({ id: r.id, assetId: r.assetId, date: r.date, value: fromCents(r.valueCents) });
