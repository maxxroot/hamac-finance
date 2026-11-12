import { chooseEquivalent, compositionAdmin, loadExposure, lookupComposition, setAdminLink } from "../market/compositions/exposure";
import { OK, type DomainHandlers } from "./_types";
import type { exposureProcedures } from "@hamac/api";

/** Composition des ETF et choix d'un équivalent physique. */

export const exposureHandlers: DomainHandlers<typeof exposureProcedures> = {
  async "exposure.load"(_input, ctx) {
    return loadExposure(ctx);
  },

  async "exposure.lookup"({ isin }, ctx) {
    return lookupComposition(ctx, isin);
  },

  async "exposure.choose"({ assetId, proxyIsin }, ctx) {
    await chooseEquivalent(ctx, assetId, proxyIsin);
    return OK;
  },

  async "exposure.admin"(_input, ctx) {
    return compositionAdmin(ctx);
  },

  async "exposure.adminLink"({ isin, proxyIsin }, ctx) {
    return setAdminLink(ctx, isin, proxyIsin);
  },
};
