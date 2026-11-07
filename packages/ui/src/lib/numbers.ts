/** Lit un nombre saisi à la française ou à l'anglaise : « 1 234,56 », « 1234.56 », « -12,5 ». */
export function parseNumber(input: string): number | null {
  const s = input.replace(/[\s  €%]/g, "").replace(",", ".");
  if (s === "" || s === "-" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const fmtCache = new Map<number, Intl.NumberFormat>();
/** 1234.5 → « 1 234,5 » (sans symbole), pour pré-remplir un champ. */
export function formatNumber(n: number | null | undefined, maxDecimals = 2, grouping = true): string {
  if (n == null || !Number.isFinite(n)) return "";
  const key = maxDecimals * 2 + (grouping ? 1 : 0);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: maxDecimals, useGrouping: grouping });
    fmtCache.set(key, f);
  }
  return f.format(n).replace(/ | /g, " ");
}

export function formatQty(n: number | null | undefined): string {
  if (n == null) return "";
  return formatNumber(n, Math.abs(n) < 1 ? 8 : 4);
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

/** « 2026-11-07 » → « 07/11/2026 ». */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return dateFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

/** « novembre 2026 » → « Novembre 2026 ». */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « 2026-11 » → « novembre 2026 ». */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return monthFmt.format(new Date(Date.UTC(y, m - 1, 1)));
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
