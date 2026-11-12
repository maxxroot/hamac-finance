import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type ThHTMLAttributes } from "react";
import { Th } from "@/shared/components/table";
import { cn } from "@/shared/lib/cn";
import { sortRows, type SortDir, type SortValue } from "./sortRows";

export type { SortDir, SortValue };

export interface SortState {
  key: string;
  dir: SortDir;
}

/**
 * Tri d'un tableau par colonne. `columns` associe une clé à la valeur triée de chaque ligne.
 * Premier clic : décroissant pour les nombres (le plus grand d'abord), croissant pour le texte ;
 * clic suivant : sens inverse.
 */
export function useSortable<T>(rows: readonly T[], columns: Record<string, (row: T) => SortValue>, initial: SortState | null = null) {
  const [sort, setSort] = useState<SortState | null>(initial);

  const sorted = useMemo(() => {
    if (!sort || !columns[sort.key]) return rows;
    return sortRows(rows, columns[sort.key], sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  const toggle = (key: string) =>
    setSort((s) => {
      if (s?.key === key) return { key, dir: s.dir === "asc" ? "desc" : "asc" };
      const sample = rows.map((r) => columns[key]?.(r)).find((v) => v != null && v !== "");
      return { key, dir: typeof sample === "number" ? "desc" : "asc" };
    });

  /** Propriétés à passer à <SortTh>. */
  const by = (key: string) => ({ active: sort?.key === key ? sort.dir : null, onSort: () => toggle(key) });

  return { sorted, sort, by };
}

/** En-tête de colonne cliquable (flèche indiquant le sens du tri). */
export function SortTh({
  children,
  active,
  onSort,
  align,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { active: SortDir | null; onSort: () => void; align?: "right" | "center" }) {
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <Th {...rest} align={align} className={cn("p-0", className)} aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "group/sort flex w-full items-center gap-1.5 px-3 py-2.5 hover:text-fg",
          align === "right" && "flex-row-reverse text-right",
          active && "text-fg",
        )}
        title="Trier"
      >
        <span>{children}</span>
        <Icon size={12} className={cn("shrink-0", active ? "text-accent" : "opacity-0 group-hover/sort:opacity-60")} aria-hidden />
      </button>
    </Th>
  );
}
