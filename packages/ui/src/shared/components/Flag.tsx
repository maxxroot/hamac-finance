import { cn } from "@/shared/lib/cn";
import { flagUrl } from "@/shared/lib/flags";

/** Petit drapeau d'un pays (code ISO 3166-1 à deux lettres) ; rien si le code est inconnu. `label` : nom du pays, lu au survol et par un lecteur d'écran. */
export function Flag({ code, label, className }: { code: string; label?: string; className?: string }) {
  const src = flagUrl(code);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={label ?? ""}
      title={label}
      loading="lazy"
      width={20}
      height={15}
      className={cn("inline-block h-[15px] w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-line", className)}
    />
  );
}
