import { RpcError, type CompositionAdmin, type CompositionLookup, type EquivalentSuggestion, type EtfExposure, type ExposureData } from "@hamac/api";
import { resolveComposition, suggestEquivalent, summarizeComposition, usableComposition, type CompositionInfo } from "@hamac/core";
import type { BackendContext } from "./context";
import { nowIso } from "./repo";

/**
 * Exposition réelle derrière les ETF : quelle composition sert pour chaque ETF de l'utilisateur.
 * Les compositions et les liens communs sont dans la base de l'instance (« marche ») ;
 * le choix d'un équivalent propre à l'utilisateur est dans son schéma (assets.composition_isin) et l'emporte.
 */

const suggestionFor = (own: CompositionInfo, name: string | null, isin: string): EquivalentSuggestion | null => {
  if (usableComposition(own)) return null;
  const ref = suggestEquivalent([own.fundName, name], isin);
  return ref ? { isin: ref.isin, name: ref.name, index: ref.index } : null;
};

/** Lance en tâche de fond les téléchargements dus : l'appel n'attend pas le réseau. */
function requestInBackground(ctx: BackendContext, isins: readonly string[]): void {
  ctx.market.compositions.request(isins).catch((err) => console.error("[hamac] compositions des ETF :", err));
}

export async function loadExposure(ctx: BackendContext): Promise<ExposureData> {
  const store = ctx.market.compositions;
  const rows = await ctx.raw.all<{ id: string; name: string; isin: string; choice: string | null }>(
    "SELECT id, name, isin, composition_isin AS choice FROM assets WHERE NOT archived AND kind = 'etf' AND isin IS NOT NULL ORDER BY name",
  );
  const links = await store.links(rows.map((r) => r.isin));
  const isins = [...new Set(rows.flatMap((r) => [r.isin, r.choice, links.get(r.isin)?.proxyIsin].filter((i): i is string => !!i)))];
  requestInBackground(ctx, isins);
  const info = await store.info(isins);
  const etfs = rows.map((r): EtfExposure => {
    const own = info.get(r.isin)!;
    const link = links.get(r.isin)?.proxyIsin ?? null;
    const { used, gap } = resolveComposition(own, r.choice ? info.get(r.choice)! : null, link ? info.get(link)! : null);
    return { assetId: r.id, isin: r.isin, name: r.name, own, choice: r.choice, link, used, gap, suggestion: suggestionFor(own, r.name, r.isin) };
  });
  const lines = await store.lines(etfs.flatMap((e) => (e.used ? [e.used.info.isin] : [])));
  return { etfs, summaries: Object.fromEntries([...lines].map(([isin, l]) => [isin, summarizeComposition(l)])) };
}

export async function lookupComposition(ctx: BackendContext, isin: string): Promise<CompositionLookup> {
  const store = ctx.market.compositions;
  const link = (await store.links([isin])).get(isin) ?? null;
  const isins = link ? [isin, link.proxyIsin] : [isin];
  requestInBackground(ctx, isins);
  const info = await store.info(isins);
  const own = info.get(isin)!;
  return { own, link: link ? { proxyIsin: link.proxyIsin, info: info.get(link.proxyIsin)! } : null, suggestion: suggestionFor(own, null, isin) };
}

/**
 * Un équivalent doit être physique, avec une composition récupérable. Il est téléchargé tout de suite s'il le faut :
 * l'utilisateur attend la réponse, comme pour un historique de comparaison.
 */
async function verifyEquivalent(ctx: BackendContext, isin: string, proxyIsin: string): Promise<CompositionInfo> {
  if (proxyIsin === isin) throw new RpcError("VALIDATION", "Choisissez un autre ETF que celui-ci.");
  const info = await ctx.market.compositions.ensure(proxyIsin);
  if (info.state === "unknown") throw new RpcError("VALIDATION", "Ni Amundi ni iShares ne publient la composition de cet ETF : choisissez-en un autre.");
  if (info.state !== "ok") throw new RpcError("VALIDATION", `La composition de cet ETF n'a pas pu être récupérée${info.message ? ` (${info.message})` : ""}. Réessayez plus tard.`);
  if (info.replication === "synthetique") throw new RpcError("VALIDATION", "Cet ETF est lui aussi synthétique : sa composition est le panier qu'il détient. Choisissez un ETF physique.");
  if (info.replication !== "physique") throw new RpcError("VALIDATION", "Hamac n'a pas pu vérifier que cet ETF est physique : choisissez-en un autre ou réessayez plus tard.");
  return info;
}

export async function chooseEquivalent(ctx: BackendContext, assetId: string, proxyIsin: string | null): Promise<void> {
  const asset = await ctx.raw.get<{ isin: string | null; kind: string }>("SELECT isin, kind FROM assets WHERE id = ?", [assetId]);
  if (!asset) throw new RpcError("NOT_FOUND", "Titre introuvable.");
  if (asset.kind !== "etf" || !asset.isin) throw new RpcError("VALIDATION", "Seuls les ETF avec un ISIN ont une composition.");
  if (proxyIsin) await verifyEquivalent(ctx, asset.isin, proxyIsin);
  await ctx.raw.run("UPDATE assets SET composition_isin = ?, updated_at = ? WHERE id = ?", [proxyIsin, nowIso(), assetId]);
  if (!proxyIsin) return;
  // Le premier équivalent vérifié devient la proposition commune, seulement pour un ETF dont la composition ne sert pas telle quelle.
  const own = (await ctx.market.compositions.info([asset.isin])).get(asset.isin)!;
  if (!usableComposition(own)) await ctx.market.compositions.setLink(asset.isin, proxyIsin);
}

export async function compositionAdmin(ctx: BackendContext): Promise<CompositionAdmin> {
  // Les liens disent quels ETF sont détenus sur l'instance : réservés à l'administrateur.
  if (!ctx.isAdmin) return { canEdit: false, links: [], failures: [] };
  const store = ctx.market.compositions;
  const links = await store.allLinks();
  const info = await store.info(links.flatMap((l) => [l.isin, l.proxyIsin]));
  return {
    canEdit: true,
    links: links.map((l) => ({ ...l, name: info.get(l.isin)?.fundName ?? null, proxyName: info.get(l.proxyIsin)?.fundName ?? null })),
    failures: await store.failures(),
  };
}

export async function setAdminLink(ctx: BackendContext, isin: string, proxyIsin: string | null): Promise<CompositionAdmin> {
  if (!ctx.isAdmin) throw new RpcError("UNAUTHORIZED", "Réservé à l'administrateur de l'instance.");
  if (proxyIsin) {
    await verifyEquivalent(ctx, isin, proxyIsin);
    await ctx.market.compositions.setLink(isin, proxyIsin, true);
  } else await ctx.market.compositions.deleteLink(isin);
  return compositionAdmin(ctx);
}

/** Un ETF vient d'être enregistré : sa composition est demandée en tâche de fond. */
export function assetSaved(ctx: BackendContext, asset: { kind: string; isin: string | null; archived: boolean }): void {
  if (asset.kind === "etf" && asset.isin && !asset.archived) requestInBackground(ctx, [asset.isin]);
}
