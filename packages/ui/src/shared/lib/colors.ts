import type { Bucket, EnergyLetter } from "@hamac/core";
import { useTheme, type Theme } from "@/shared/lib/theme";

/**
 * Couleurs des classes d'actifs pour le HTML : les variables du thème (styles.css), qui changent avec lui.
 * Ordre fixe, jamais recyclé.
 */
export const BUCKET_COLORS: Record<Bucket, string> = {
  precaution: "var(--color-precaution)",
  garanti: "var(--color-garanti)",
  obligations: "var(--color-obligations)",
  croissance: "var(--color-croissance)",
  immobilier: "var(--color-immobilier)",
  crowdlending: "var(--color-crowdlending)",
  speculatif: "var(--color-speculatif)",
};

export interface ChartColors {
  /** Encres et surfaces du thème. */
  ink: { fg: string; muted: string; faint: string; line: string; surface: string; surface2: string };
  /** Série principale (patrimoine, rendement) : vert bouteille le jour, or la nuit. */
  primary: string;
  buckets: Record<Bucket, string>;
  polarity: { positive: string; negative: string };
  /** Les deux côtés d'une comparaison. */
  compare: readonly [string, string];
  /** Courbes par actif, dans l'ordre. */
  series: readonly string[];
}

/**
 * Les graphiques (ECharts) ont besoin de vraies couleurs, pas de variables CSS : mêmes valeurs que styles.css.
 * Classes d'actifs validées pour chaque fond (daltonisme ΔE ≥ 8 entre voisines, contraste ≥ 3:1).
 */
const CHART_COLORS: Record<Theme, ChartColors> = {
  clair: {
    ink: { fg: "#1a2b23", muted: "#4f5e55", faint: "#66726a", line: "#e2d9c6", surface: "#fbf8f1", surface2: "#fffdf8" },
    primary: "#1f4a3a",
    buckets: { precaution: "#1c69aa", garanti: "#189546", obligations: "#5f61b4", croissance: "#d3791f", immobilier: "#7d4f00", crowdlending: "#e06693", speculatif: "#715898" },
    polarity: { positive: "#2f7d55", negative: "#a8432f" },
    compare: ["#d3791f", "#1c69aa"],
    series: ["#189546", "#715898", "#d3791f", "#1c69aa", "#e06693"],
  },
  sombre: {
    ink: { fg: "#ede6d6", muted: "#a9b3a8", faint: "#7e8c83", line: "#263b33", surface: "#142420", surface2: "#1a2d27" },
    primary: "#d0ae6a",
    buckets: { precaution: "#0f7dc3", garanti: "#3f9465", obligations: "#7d83e0", croissance: "#dc750d", immobilier: "#8f6401", crowdlending: "#ce548b", speculatif: "#a171e4" },
    polarity: { positive: "#6cc08b", negative: "#e07a5f" },
    compare: ["#dc750d", "#0f7dc3"],
    series: ["#3f9465", "#a171e4", "#dc750d", "#0f7dc3", "#ce548b"],
  },
};

export function chartColors(theme: Theme): ChartColors {
  return CHART_COLORS[theme];
}

/** Couleurs des graphiques pour le thème affiché : à mettre dans les dépendances des options mémorisées. */
export function useChartColors(): ChartColors {
  return CHART_COLORS[useTheme()];
}

/** Couleurs proposées pour une classe personnalisée : lisibles sur les deux fonds, distinctes des classes fixes. */
export const CUSTOM_CLASS_COLORS = ["#2a8a86", "#8a8f2c", "#b5543a", "#5b7591", "#94608f", "#a8864a"];

type EnergyColors = Record<EnergyLetter, { background: string; text: string }>;

/** Teintes de l'étiquette énergie du DPE, identiques quel que soit le thème. */
export const DPE_COLORS: EnergyColors = {
  A: { background: "#00a06d", text: "#000000" },
  B: { background: "#52b153", text: "#000000" },
  C: { background: "#a5cc74", text: "#000000" },
  D: { background: "#f4e70f", text: "#000000" },
  E: { background: "#f0b40f", text: "#000000" },
  F: { background: "#eb8235", text: "#000000" },
  G: { background: "#d7221f", text: "#ffffff" },
};

/** Teintes de l'étiquette climat (GES) du DPE. */
export const GES_COLORS: EnergyColors = {
  A: { background: "#a4dbf8", text: "#000000" },
  B: { background: "#8cb4d3", text: "#000000" },
  C: { background: "#7792b1", text: "#000000" },
  D: { background: "#5f6f8f", text: "#ffffff" },
  E: { background: "#4a5073", text: "#ffffff" },
  F: { background: "#393550", text: "#ffffff" },
  G: { background: "#281b35", text: "#ffffff" },
};
