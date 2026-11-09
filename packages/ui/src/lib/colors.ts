import type { Bucket, EnergyLetter } from "@hamac/core";

/** Couleurs des classes d'actifs, ordre fixe (identique au thème CSS). Validées pour le fond sombre. */
export const BUCKET_COLORS: Record<Bucket, string> = {
  precaution: "#539ad3",
  garanti: "#1b895f",
  obligations: "#597af7",
  croissance: "#cf7a25",
  immobilier: "#a8884f",
  crowdlending: "#c0587e",
  speculatif: "#8f63d8",
};

export const INK = {
  fg: "#eceef2",
  muted: "#9aa1ae",
  faint: "#6b7280",
  line: "#262a33",
  surface: "#121419",
  surface2: "#181b22",
  accent: "#f2c35b",
};

/** Gain et perte dans les graphiques (mêmes valeurs que le thème). */
export const POLARITY = { positive: "#3ecf8e", negative: "#f2645a" };

/** Les deux côtés d'une comparaison : validés sur fond sombre, daltonisme compris. */
export const COMPARE_COLORS = ["#cf7a25", "#539ad3"] as const;

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
