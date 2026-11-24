import type { Asset, AssetKind, PriceSource } from "@hamac/core";
import * as t from "../../db/schema";

/** Lignes de la base → titres. */

export function mapAsset(r: typeof t.assets.$inferSelect): Asset {
  return {
    id: r.id,
    kind: r.kind as AssetKind,
    name: r.name,
    isin: r.isin,
    symbol: r.symbol,
    priceSource: r.priceSource as PriceSource,
    priceProvider: (r.priceProvider as Asset["priceProvider"]) ?? null,
    priceUrl: r.priceUrl,
    pricePath: r.pricePath,
    classId: r.classId,
    inAllocation: r.inAllocation,
    manualPrice: r.manualPrice,
    manualPriceDate: r.manualPriceDate,
    targetWeight: r.targetWeight,
    ter: r.ter,
    couponRate: r.couponRate,
    maturityDate: r.maturityDate,
    couponFrequency: r.couponFrequency,
    nextCouponDate: r.nextCouponDate,
    issuer: r.issuer,
    bondKind: (r.bondKind as Asset["bondKind"]) ?? null,
    issuerCountry: r.issuerCountry,
    currency: r.currency,
    archived: r.archived,
  };
}
