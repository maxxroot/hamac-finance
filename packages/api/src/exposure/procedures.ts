import { z } from "zod";
import type { CompositionGap, CompositionInfo, CompositionOrigin, CompositionSummary } from "@hamac/core";
import { ok, isin, entity } from "../common";

/** Composition des ETF et exposition réelle. */

/** ETF physique proposé comme équivalent, d'après le nom de l'indice. */
export interface EquivalentSuggestion {
  isin: string;
  name: string;
  index: string;
}

/** Exposition réelle : la composition qui sert pour chaque ETF détenu, et d'où elle vient. */
export interface EtfExposure {
  assetId: string;
  isin: string;
  name: string;
  /** Composition publiée pour l'ETF lui-même. */
  own: CompositionInfo;
  /** Équivalent choisi par l'utilisateur, ou null pour suivre le lien commun de l'instance. */
  choice: string | null;
  /** Équivalent commun de l'instance, s'il existe. */
  link: string | null;
  /** Composition utilisée : la sienne, celle de l'équivalent choisi ou celle du lien commun. */
  used: { origin: CompositionOrigin; info: CompositionInfo } | null;
  /** Pourquoi aucune composition ne sert encore. */
  gap: CompositionGap | null;
  suggestion: EquivalentSuggestion | null;
}

export interface ExposureData {
  etfs: EtfExposure[];
  /** Résumés des compositions utilisées, par ISIN. */
  summaries: Record<string, CompositionSummary>;
}

/** Ce que Hamac sait de la composition d'un ETF au moment où on le choisit. */
export interface CompositionLookup {
  own: CompositionInfo;
  /** Équivalent commun de l'instance, et l'état de sa composition. */
  link: { proxyIsin: string; info: CompositionInfo } | null;
  suggestion: EquivalentSuggestion | null;
}

/** Compositions de l'instance, pour l'administrateur : liens communs et échecs de téléchargement. */
export interface CompositionAdmin {
  canEdit: boolean;
  links: Array<{ isin: string; proxyIsin: string; createdAt: string; name: string | null; proxyName: string | null }>;
  failures: CompositionInfo[];
}

/** Taille maximale d'un fichier de composition déposé : le plus gros fonds iShares (MSCI ACWI IMI, environ 10 000 lignes) fait 2 Mo. */
export const MAX_COMPOSITION_FILE = 10_000_000;

export const exposureProcedures = {
  /** Composition utilisée pour chaque ETF détenu ; demande en tâche de fond celles qui manquent. */
  "exposure.load": { input: z.void(), output: entity<ExposureData>() },
  /** État de la composition d'un ETF qu'on vient de choisir ; lance son téléchargement s'il le faut. */
  "exposure.lookup": { input: z.object({ isin }), output: entity<CompositionLookup>() },
  /** Choisit l'ETF physique équivalent d'un ETF (null : revenir au lien commun). L'équivalent est vérifié. */
  "exposure.choose": { input: z.object({ assetId: z.string().min(1), proxyIsin: isin.nullable() }), output: ok },
  "exposure.admin": { input: z.void(), output: entity<CompositionAdmin>() },
  /** Administrateur : remplace ou supprime (null) le lien commun d'un ETF. */
  "exposure.adminLink": { input: z.object({ isin, proxyIsin: isin.nullable() }), output: entity<CompositionAdmin>() },
  /**
   * Administrateur : dépose le fichier de composition d'iShares, téléchargé depuis son navigateur, quand iShares refuse le serveur.
   * `name` : nom saisi du titre, gardé faute de nom dans le fichier.
   */
  "exposure.importFile": {
    input: z.object({ isin, csv: z.string().min(1).max(MAX_COMPOSITION_FILE), name: z.string().trim().max(200).nullable() }),
    output: entity<CompositionInfo>(),
  },
} as const;
