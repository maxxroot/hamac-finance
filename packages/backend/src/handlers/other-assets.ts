import { eq } from "drizzle-orm";
import { one } from "../db/driver";
import { RpcError, type otherAssetsProcedures } from "@hamac/api";
import { canBeDismembered } from "@hamac/core";
import type { BackendContext } from "../context";
import * as t from "../db/schema";
import { newId, nowIso, toCents, mapOtherAsset } from "../repo";
import { OK, type DomainHandlers } from "./_types";

/** Autres biens et leurs estimations. */

export const otherAssetsHandlers: DomainHandlers<typeof otherAssetsProcedures> = {
  async "otherAssets.upsert"(input, ctx) {
    const id = input.id ?? newId();
    // Usufruit et nue-propriété : seulement pour des parts de société.
    const dismemberment = canBeDismembered(input.kind) ? input.dismemberment : "pleine";
    const pleine = dismemberment === "pleine";
    const loan = input.kind === "pret";
    const row = {
      kind: input.kind,
      name: input.name,
      valueCents: toCents(input.value),
      valueDate: input.valueDate,
      purchasePriceCents: input.purchasePrice == null ? null : toCents(input.purchasePrice),
      purchaseDate: input.purchaseDate,
      share: input.share,
      dismemberment,
      usufructBirthDate: pleine ? null : input.usufructBirthDate,
      usufructEnd: pleine ? null : input.usufructEnd,
      depreciation: input.depreciation,
      quickSaleDiscount: input.quickSaleDiscount,
      saleDelayMonths: input.saleDelayMonths,
      // L'échéancier ne concerne que l'argent prêté.
      loanPrincipalCents: loan && input.loanPrincipal != null ? toCents(input.loanPrincipal) : null,
      loanRate: loan ? input.loanRate : null,
      loanTermMonths: loan ? input.loanTermMonths : null,
      loanFirstPayment: loan ? input.loanFirstPayment : null,
      classId: input.classId,
      inAllocation: input.inAllocation,
      comment: input.comment,
      archived: input.archived,
      updatedAt: nowIso(),
    };
    if (input.id) {
      const before = await ctx.db.select().from(t.otherAssets).where(eq(t.otherAssets.id, id)).limit(1).then(one);
      if (!before) throw new RpcError("NOT_FOUND", "Bien introuvable.");
      // Une nouvelle date d'estimation : l'ancienne valeur rejoint l'historique.
      if (before.valueDate && before.valueDate !== input.valueDate) await keepPastOtherValue(ctx, id, before.valueDate, before.valueCents);
      await ctx.db.update(t.otherAssets).set(row).where(eq(t.otherAssets.id, id));
    } else await ctx.db.insert(t.otherAssets).values({ id, ...row });
    return mapOtherAsset((await ctx.db.select().from(t.otherAssets).where(eq(t.otherAssets.id, id)).limit(1).then(one))!);
  },

  async "otherAssets.delete"({ id }, ctx) {
    await ctx.db.delete(t.otherAssets).where(eq(t.otherAssets.id, id));
    return OK;
  },

  async "otherAssetValues.add"(input, ctx) {
    const asset = await ctx.db.select().from(t.otherAssets).where(eq(t.otherAssets.id, input.assetId)).limit(1).then(one);
    if (!asset) throw new RpcError("NOT_FOUND", "Bien introuvable.");
    // Une estimation plus ancienne rejoint l'historique ; une plus récente devient la valeur du bien.
    if (asset.valueDate != null && input.date < asset.valueDate) {
      await keepPastOtherValue(ctx, input.assetId, input.date, toCents(input.value));
      return OK;
    }
    if (asset.valueDate != null && input.date !== asset.valueDate) await keepPastOtherValue(ctx, input.assetId, asset.valueDate, asset.valueCents);
    await ctx.db.update(t.otherAssets).set({ valueCents: toCents(input.value), valueDate: input.date, updatedAt: nowIso() }).where(eq(t.otherAssets.id, input.assetId));
    return OK;
  },

  async "otherAssetValues.delete"({ id }, ctx) {
    await ctx.db.delete(t.otherAssetValues).where(eq(t.otherAssetValues.id, id));
    return OK;
  },
};

async function keepPastOtherValue(ctx: BackendContext, assetId: string, date: string, valueCents: number) {
  const set = { valueCents, updatedAt: nowIso() };
  await ctx.db.insert(t.otherAssetValues).values({ id: newId(), assetId, date, ...set }).onConflictDoUpdate({ target: [t.otherAssetValues.assetId, t.otherAssetValues.date], set });
}
