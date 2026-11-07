/** Tri pur (sans React) utilisé par useSortable : testable à part. */
export type SortValue = string | number | null | undefined;
export type SortDir = "asc" | "desc";

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
const empty = (v: SortValue) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v));

export function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

/** Trie sans modifier l'entrée. Les valeurs manquantes vont toujours en fin ; à égalité, l'ordre d'origine est conservé. */
export function sortRows<T>(rows: readonly T[], get: (row: T) => SortValue, dir: SortDir): T[] {
  const factor = dir === "asc" ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, v: get(row) }))
    .sort((x, y) => {
      const ex = empty(x.v);
      const ey = empty(y.v);
      if (ex || ey) return ex === ey ? x.i - y.i : ex ? 1 : -1;
      return compareValues(x.v, y.v) * factor || x.i - y.i;
    })
    .map((x) => x.row);
}
