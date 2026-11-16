import { cn } from "@/shared/lib/cn";

/**
 * Drapeaux des pays (paquet flag-icons, licence MIT), servis par l'application elle-même : aucune requête externe.
 * Chaque drapeau est un fichier à part, téléchargé seulement quand il s'affiche.
 */
const FILES = import.meta.glob<string>("../../../../../node_modules/flag-icons/flags/4x3/*.svg", { query: "?url&no-inline", import: "default", eager: true });
const FLAGS = new Map(Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -4).toUpperCase(), url]));

/** Petit drapeau d'un pays (code ISO 3166-1 à deux lettres) ; rien si le code est inconnu. */
export function Flag({ code, className }: { code: string; className?: string }) {
  const src = FLAGS.get(code.toUpperCase());
  if (!src) return null;
  return <img src={src} alt="" loading="lazy" width={20} height={15} className={cn("inline-block h-[15px] w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-line", className)} />;
}
