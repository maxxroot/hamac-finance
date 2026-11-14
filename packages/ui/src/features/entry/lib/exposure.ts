import type { CompositionLookup, EtfExposure, ExposureData } from "@hamac/api";
import { SECTOR_LABELS, type CompositionInfo, type CompositionIssuer, type CompositionSummary, type ExposureItem, type HoldingKind, type Sector } from "@hamac/core";
import { formatDate } from "@/shared/lib/numbers";

/** Clé des requêtes d'exposition (séparées de l'espace de travail, qu'elles ne rechargent pas). */
export const EXPOSURE_KEY = "exposure";

export const ISSUER_LABELS: Record<CompositionIssuer, string> = { amundi: "Amundi", ishares: "iShares" };

export const HOLDING_KIND_LABELS: Record<HoldingKind, string> = {
  action: "Actions",
  obligation: "Obligations",
  liquidites: "Liquidités",
  derive: "Dérivés (contrats à terme, change)",
  autre: "Autres",
};

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" });
  } catch {
    return null;
  }
})();

const currencyNames = (() => {
  try {
    return new Intl.DisplayNames(["fr"], { type: "currency" });
  } catch {
    return null;
  }
})();

export function countryLabel(code: string): string {
  if (!code) return "Sans pays (liquidités, dérivés)";
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function sectorLabel(key: string): string {
  return key ? (SECTOR_LABELS[key as Sector] ?? key) : "Non renseigné (liquidités, actions détenues en direct)";
}

export function currencyLabel(code: string): string {
  if (!code) return "Non renseignée";
  try {
    const name = currencyNames?.of(code);
    return name && name !== code ? `${code} · ${name}` : code;
  } catch {
    return code;
  }
}

export function kindLabel(key: string): string {
  return HOLDING_KIND_LABELS[key as HoldingKind] ?? key;
}

/** Les `n` premiers, puis le reste regroupé en « Autres ». */
export function withOthers(items: readonly ExposureItem[], n: number, othersKey = "__autres"): ExposureItem[] {
  if (items.length <= n + 1) return [...items];
  const rest = items.slice(n);
  return [...items.slice(0, n), { key: othersKey, value: rest.reduce((s, i) => s + i.value, 0), share: rest.reduce((s, i) => s + i.share, 0) }];
}

/** Résumés des compositions qui servent, par identifiant de titre. */
export function summariesByAsset(data: ExposureData | undefined): Map<string, CompositionSummary> {
  const out = new Map<string, CompositionSummary>();
  for (const e of data?.etfs ?? []) {
    const s = e.used ? data!.summaries[e.used.info.isin] : undefined;
    if (s) out.set(e.assetId, s);
  }
  return out;
}

/** Au moins une composition attendue : la page se recharge d'elle-même. */
export const hasPending = (data: ExposureData | undefined): boolean => !!data?.etfs.some((e) => e.gap === "pending" || e.gap === "equivalent-pending");

const fundName = (info: CompositionInfo) => info.fundName ?? info.isin;

const replicationLabel = (info: CompositionInfo) => (info.replication === "physique" ? "physique" : info.replication === "synthetique" ? "synthétique" : "réplication non précisée");

export interface CompositionStatus {
  text: string;
  tone: "ok" | "warning" | "muted";
  /** Le bouton « Choisir un équivalent » ou « Changer » a un sens. */
  canChoose: boolean;
}

/** État de la composition d'un ETF, en une phrase. */
export function compositionStatus(e: EtfExposure): CompositionStatus {
  if (e.used) {
    const info = e.used.info;
    const date = `au ${formatDate(info.asOf)}`;
    const stale = info.message ? ` · dernière mise à jour échouée (${info.message}), composition précédente gardée` : "";
    if (e.used.origin === "own") {
      const issuer = info.issuer ? ISSUER_LABELS[info.issuer] : "Émetteur";
      const manual = info.manual ? " (fichier déposé)" : "";
      // Une mise à jour qui échoue durablement laisse vieillir la composition : un équivalent peut la remplacer.
      return { text: `${issuer}${manual} · ${replicationLabel(info)} · ${info.lineCount.toLocaleString("fr-FR")} lignes · ${date}${stale}`, tone: "ok", canChoose: !!info.message };
    }
    const why = e.used.origin === "choice" ? "votre choix" : "même indice";
    return { text: `Composition reprise de l'ETF ${fundName(info)} (physique, ${why}), ${date}${stale}`, tone: "ok", canChoose: true };
  }
  switch (e.gap) {
    case "synthetic":
      return { text: "ETF synthétique : la composition qu'il publie est le panier qu'il détient, pas l'exposition qu'il donne. Choisissez un ETF physique qui suit le même indice.", tone: "warning", canChoose: true };
    case "unknown":
      return { text: "Hamac ne récupère que les compositions d'Amundi et d'iShares. Choisissez un ETF physique de l'un d'eux qui suit le même indice.", tone: "warning", canChoose: true };
    case "failed":
      return { text: `Composition non récupérée${e.own.message ? ` : ${e.own.message}` : ""}. Nouvel essai dans quelques heures, ou choisissez un ETF physique équivalent.`, tone: "warning", canChoose: true };
    case "equivalent-pending":
      return { text: `Récupération de la composition de l'équivalent ${e.choice ?? e.link}…`, tone: "muted", canChoose: true };
    case "equivalent-failed":
      return { text: `La composition de l'équivalent ${e.choice ?? e.link} n'a pas pu être récupérée. Choisissez-en un autre.`, tone: "warning", canChoose: true };
    default:
      return { text: "Récupération de la composition chez l'émetteur…", tone: "muted", canChoose: false };
  }
}

/**
 * L'administrateur peut déposer le fichier de l'émetteur : téléchargement en échec, ou émetteur qui ne répond plus
 * alors qu'une composition plus ancienne est gardée.
 */
export const canImportFile = (info: CompositionInfo): boolean => info.state === "failed" || (info.state === "ok" && !!info.message);

/** La composition de l'ETF, ou celle de son équivalent commun, est encore attendue. */
export const lookupPending = (l: CompositionLookup): boolean => l.own.state === "pending" || l.link?.info.state === "pending";

/** Annonce au moment où l'on choisit un ETF : ce que Hamac sait déjà de sa composition. */
export function lookupMessage(l: CompositionLookup): { text: string; tone: "ok" | "warning" | "muted" } {
  const own = l.own;
  const proxy = l.link?.info.state === "ok" ? l.link.info : null;
  if (own.state === "ok" && own.replication !== "synthetique") {
    const issuer = own.issuer ? ISSUER_LABELS[own.issuer] : "l'émetteur";
    return { text: `Composition connue : ${own.lineCount.toLocaleString("fr-FR")} lignes au ${formatDate(own.asOf)}, publiée par ${issuer}. Elle servira à l'exposition réelle.`, tone: "ok" };
  }
  if (proxy) {
    const why = own.state === "ok" ? "ETF synthétique : sa" : "Sa";
    return { text: `${why} composition sera reprise de l'ETF ${fundName(proxy)} (physique, même indice), au ${formatDate(proxy.asOf)}. Vous pourrez la changer dans Exposition réelle.`, tone: "ok" };
  }
  const suggestion = l.suggestion ? ` Hamac vous proposera ${l.suggestion.name} (${l.suggestion.index}).` : "";
  if (own.state === "ok") return { text: `ETF synthétique : la composition qu'il publie est le panier qu'il détient, pas son exposition. Choisissez un ETF physique équivalent dans Exposition réelle.${suggestion}`, tone: "warning" };
  if (own.state === "unknown") return { text: `Hamac ne récupère que les compositions d'Amundi et d'iShares : vous pourrez choisir un ETF physique équivalent dans Exposition réelle.${suggestion}`, tone: "warning" };
  if (own.state === "failed")
    return { text: `La composition n'a pas pu être récupérée${own.message ? ` (${own.message})` : ""}. Nouvel essai plus tard, ou choisissez un ETF physique équivalent dans Exposition réelle.${suggestion}`, tone: "warning" };
  return { text: "Récupération de la composition chez l'émetteur…", tone: "muted" };
}
