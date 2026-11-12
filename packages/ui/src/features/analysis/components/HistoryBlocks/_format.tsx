import { type CSSProperties } from "react";
import { type MilestoneCategory, formatEur } from "@hamac/core";

/** Couleurs des étapes et formats d'affichage communs aux cartes de l'historique. */

/** Une couleur par famille d'étapes, prise parmi celles des classes d'actifs (validées dans les deux thèmes). */
export const CATEGORY_COLORS: Record<MilestoneCategory, string> = {
  comptes: "var(--color-garanti)",
  titres: "var(--color-croissance)",
  paliers: "var(--color-gold)",
  mouvements: "var(--color-precaution)",
  marches: "var(--color-speculatif)",
  immobilier: "var(--color-immobilier)",
};

export const dot = (category: MilestoneCategory): CSSProperties => ({ backgroundColor: CATEGORY_COLORS[category] });

// ——— Choix des dates ———

export const eurText = (v: number) => formatEur(v, { compact: true });

export const signedText = (v: number) => `${v > 0.004 ? "+" : ""}${eurText(v)}`;

/** Graduations : « 1,5 k€ » plutôt qu'un arrondi qui ferait lire 2 k€. */
export const eurAxis = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€` : `${v} €`);
