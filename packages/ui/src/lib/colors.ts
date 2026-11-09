import type { Bucket } from "@hamac/core";

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
