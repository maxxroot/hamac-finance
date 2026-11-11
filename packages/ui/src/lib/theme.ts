import { useSyncExternalStore } from "react";

/**
 * Thème de l'interface : « Maison » (clair, ivoire et vert bouteille) et « Nocturne » (sombre, vert nuit et or).
 * Le choix est gardé dans le compte (réglage ui.theme) et recopié dans le navigateur, que public/theme-1.js
 * lit avant le premier affichage.
 */
export type ThemeChoice = "systeme" | "clair" | "sombre";
export type Theme = "clair" | "sombre";

export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "systeme", label: "Comme le système" },
  { value: "clair", label: "Clair" },
  { value: "sombre", label: "Sombre" },
];

const KEY = "hamac.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "systeme" || value === "clair" || value === "sombre";
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): Theme {
  if (choice === "systeme") return systemDark ? "sombre" : "clair";
  return choice;
}

export function readStoredChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return isThemeChoice(v) ? v : "systeme";
  } catch {
    return "systeme";
  }
}

// Sans matchMedia (tests sous jsdom), on considère le système en clair.
const systemDark = () => typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;

/** Pose la classe du thème sur la page et retient le choix pour le prochain chargement. */
export function applyTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Navigation privée : le choix vaut pour la session en cours.
  }
  const dark = resolveTheme(choice, systemDark()) === "sombre";
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
}

/** Thème affiché, mis à jour quand la classe de la page change. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "clair");
}

function currentTheme(): Theme {
  const root = document.documentElement;
  if (root.classList.contains("dark")) return "sombre";
  if (root.classList.contains("light")) return "clair";
  return systemDark() ? "sombre" : "clair";
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  if (typeof window.matchMedia !== "function") return () => observer.disconnect();
  const media = window.matchMedia(DARK_QUERY);
  // « Comme le système » : on suit le passage jour/nuit de l'appareil.
  const onSystem = () => {
    if (readStoredChoice() === "systeme") applyTheme("systeme");
  };
  media.addEventListener("change", onSystem);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onSystem);
  };
}
