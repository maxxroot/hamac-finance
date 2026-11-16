/**
 * Drapeaux des pays (paquet flag-icons, licence MIT), servis par l'application elle-même : aucune requête externe.
 * Chaque drapeau est un fichier à part, téléchargé seulement quand il s'affiche.
 */
const FILES = import.meta.glob<string>("../../../../../node_modules/flag-icons/flags/4x3/*.svg", { query: "?url&no-inline", import: "default", eager: true });
const FLAGS = new Map(Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -4).toUpperCase(), url]));

/** Adresse du drapeau d'un pays (code ISO 3166-1 à deux lettres), null si le code est inconnu. */
export const flagUrl = (code: string): string | null => FLAGS.get(code.toUpperCase()) ?? null;

/** Drapeau en HTML, pour les info-bulles des graphiques (texte en HTML). */
export function flagHtml(code: string): string {
  const url = flagUrl(code);
  return url ? `<img src="${url}" alt="" style="display:inline-block;width:20px;height:15px;vertical-align:-3px;margin-right:6px;border-radius:2px;object-fit:cover">` : "";
}
