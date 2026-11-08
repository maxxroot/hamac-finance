import { isIsoDate } from "./dates";
import type { TxType } from "./domain";

/**
 * Lecture des relevés CSV des courtiers et banques : séparateur détecté (; , ou tabulation),
 * guillemets, nombres à la française, dates jj/mm/aaaa.
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const delimiter = detectDelimiter(clean.split("\n").filter((l) => l.trim()).slice(0, 30));
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (c === "\n") {
      row.push(field.trim());
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field.trim());
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

/**
 * Séparateur : celui qui découpe le plus de lignes en un même nombre de colonnes, à égalité « ; » puis tabulation.
 * Sur les premières lignes, car un relevé peut commencer par un préambule sans séparateur.
 */
function detectDelimiter(lines: readonly string[]): string {
  let best = ";";
  let bestScore = -1;
  for (const d of [";", "\t", ","]) {
    const counts = new Map<number, number>();
    for (const l of lines) {
      const n = l.split(d).length;
      if (n > 1) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const score = Math.max(0, ...counts.values());
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** « 1 234,56 », « -1234.56 », « 1.234,56 € » → nombre. */
export function parseAmount(s: string): number | null {
  let t = s.replace(/[\s  €$]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!t) return null;
  if (/,\d{1,8}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** « 07/11/2026 », « 7-11-26 », « 2026-11-07 » → « 2026-11-07 ». */
export function parseDate(s: string): string | null {
  const t = s.trim().slice(0, 10);
  if (isIsoDate(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const iso = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : null;
}

/** Devine le type d'opération d'après le libellé d'un relevé. */
export function guessType(label: string, amount: number): TxType {
  const l = label.toLowerCase();
  if (/achat|buy|souscription/.test(l)) return "achat";
  if (/vente|sell|cession/.test(l)) return "vente";
  if (/dividende|dividend/.test(l)) return "dividende";
  if (/coupon|int[ée]r[êe]t/.test(l)) return "interets";
  if (/frais|commission|droits de garde|fee/.test(l)) return "frais";
  if (/retrait|withdraw/.test(l)) return "retrait";
  return amount < 0 ? "retrait" : "versement";
}
