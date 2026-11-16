import { and, eq, or, sql } from "drizzle-orm";
import { countryFromIsin, DEFAULT_SOVEREIGN } from "@hamac/core";
import { one } from "../db/driver";
import { RpcError, type assetsProcedures, type MarketSettings } from "@hamac/api";
import type { BackendContext } from "../context";
import { searchAssets } from "../market";
import { MarketError } from "../market/http";
import { refreshPrices } from "../prices/refresh";
import { assetSaved } from "../market/compositions/exposure";
import { TwelveDataBudget } from "../market/sources/twelvedata";
import * as t from "../db/schema";
import { mapAsset } from "../repo";
import { newId, nowIso } from "../db/units";
import { OK, type DomainHandlers } from "./_types";
import { count } from "./_shared";

/** Titres, recherche d'un titre, cours manuels, actualisation des cours et réglages des sources. */

export const assetsHandlers: DomainHandlers<typeof assetsProcedures> = {
  async "assets.upsert"(input, ctx) {
    const id = input.id ?? newId();
    if (input.isin) {
      const dup = await ctx.db.select().from(t.assets).where(and(eq(t.assets.isin, input.isin), sql`${t.assets.id} <> ${id}`)).limit(1).then(one);
      if (dup) throw new RpcError("CONFLICT", `Un titre avec l'ISIN ${input.isin} existe déjà : « ${dup.name} ».`);
    }
    const isBond = input.kind === "obligation";
    // Un fonds euros n'a pas de cours : une part vaut 1 €.
    const isFund = input.kind === "fonds_euros";
    const row = {
      kind: input.kind,
      name: input.name,
      isin: isFund ? null : input.isin,
      symbol: isFund ? null : input.symbol,
      priceSource: isFund || (isBond && input.priceSource === "auto") ? "modele" : input.priceSource,
      priceProvider: input.priceProvider,
      priceUrl: input.priceUrl,
      pricePath: input.pricePath,
      classId: input.classId,
      inAllocation: input.inAllocation,
      manualPrice: input.manualPrice,
      manualPriceDate: input.manualPriceDate,
      targetWeight: input.targetWeight,
      ter: input.ter,
      couponRate: isBond ? input.couponRate : null,
      maturityDate: isBond ? input.maturityDate : null,
      couponFrequency: isBond ? (input.couponFrequency ?? 1) : null,
      nextCouponDate: isBond ? input.nextCouponDate : null,
      // Une obligation d'État se désigne par son pays : pas d'émetteur saisi à côté, qui pourrait le contredire.
      issuer: isBond && input.bondKind === "etat" ? null : input.issuer,
      bondKind: isBond ? (input.bondKind ?? null) : null,
      issuerCountry: isBond && input.bondKind === "etat" ? (input.issuerCountry ?? countryFromIsin(input.isin) ?? DEFAULT_SOVEREIGN) : null,
      archived: input.archived,
      updatedAt: nowIso(),
    };
    if (isBond && (row.couponRate == null || !row.maturityDate)) {
      throw new RpcError("VALIDATION", "Une obligation nécessite un taux de coupon et une date d'échéance.");
    }
    if (isBond && row.nextCouponDate && row.nextCouponDate > row.maturityDate!) {
      throw new RpcError("VALIDATION", "La date du prochain coupon doit précéder l'échéance.");
    }
    if (input.id) {
      const current = await ctx.db.select().from(t.assets).where(eq(t.assets.id, id)).limit(1).then(one);
      if (!current) throw new RpcError("NOT_FOUND", "Titre introuvable.");
      await ctx.db.update(t.assets).set(row).where(eq(t.assets.id, id));
    } else {
      await ctx.db.insert(t.assets).values({ id, ...row });
    }
    assetSaved(ctx, row);
    return mapAsset((await ctx.db.select().from(t.assets).where(eq(t.assets.id, id)).limit(1).then(one))!);
  },

  async "assets.delete"({ id }, ctx) {
    const used = await count(ctx.db.select({ n: sql<number>`count(*)` }).from(t.transactions).where(or(eq(t.transactions.assetId, id), eq(t.transactions.counterAssetId, id))).limit(1).then(one));
    if (used > 0) throw new RpcError("CONFLICT", `Ce titre apparaît dans ${used} opération(s) : archivez-le plutôt que de le supprimer.`);
    await ctx.db.delete(t.assets).where(eq(t.assets.id, id));
    return OK;
  },

  async "prices.setManual"({ assetId, date, price }, ctx) {
    const asset = await ctx.db.select().from(t.assets).where(eq(t.assets.id, assetId)).limit(1).then(one);
    if (!asset) throw new RpcError("NOT_FOUND", "Titre introuvable.");
    await ctx.db.update(t.assets).set({ manualPrice: price, manualPriceDate: date, updatedAt: nowIso() }).where(eq(t.assets.id, assetId));
    await ctx.db
      .insert(t.prices)
      .values({ assetId, date, price, source: "manuel" })
      .onConflictDoUpdate({ target: [t.prices.assetId, t.prices.date], set: { price, source: "manuel" } });
    return OK;
  },

  async "prices.refresh"(_input, ctx) {
    return refreshPrices(ctx);
  },

  async "market.settings"(_input, ctx) {
    return marketSettings(ctx);
  },

  async "market.configure"({ order }, ctx) {
    if (!ctx.isAdmin) throw new RpcError("UNAUTHORIZED", "Réservé à l'administrateur de l'instance.");
    await ctx.market.configure(order);
    return marketSettings(ctx);
  },

  async "assets.search"({ query }, ctx) {
    return searchAssets(ctx.fetcher, query);
  },

  async "market.irl"(_input, ctx) {
    return ctx.market.irl();
  },

  async "market.series"(input, ctx) {
    try {
      return await ctx.market.series(input);
    } catch (e) {
      if (e instanceof MarketError) throw new RpcError("NOT_FOUND", e.message);
      throw e;
    }
  },
};

async function marketSettings(ctx: BackendContext): Promise<MarketSettings> {
  const state = await ctx.market.state();
  const n = await ctx.market.twelveDataCount(state);
  const key = state.twelveDataKey;
  return {
    canEdit: ctx.isAdmin,
    order: state.order,
    twelveData: { configured: !!key, used: key ? new TwelveDataBudget(key, state.usage, ctx.market.dailyLimit).usage.used : 0, limit: ctx.market.dailyLimit, assets: n, intervalMinutes: ctx.market.intervalMinutes(n) },
  };
}
