import type { Account } from "../model";
import type { Disposal } from "./engine";
import { roundCents } from "../base";

/**
 * Plus et moins-values de valeurs mobilières par année (compte-titres).
 * Les moins-values de l'année s'imputent d'abord sur les plus-values de l'année, puis les moins-values
 * reportables des années antérieures, les plus anciennes en priorité, dans la limite des plus-values ;
 * un excédent reste imputable pendant les dix années suivantes (CGI, art. 150-0 D ; Brochure IR 2026, p. 142).
 */

export interface LossCarry {
  /** Année d'origine de la moins-value. */
  year: number;
  amount: number;
}

export interface SecuritiesYear {
  year: number;
  /** Somme des plus-values et des moins-values de l'année, avant compensation. */
  gains: number;
  losses: number;
  /** Résultat de l'année : positif = plus-value, négatif = moins-value. */
  net: number;
  /** Moins-values antérieures imputées cette année. */
  usedCarry: LossCarry[];
  /** Plus-value restante après toutes les imputations (case 3VG). */
  taxableGain: number;
  /** Moins-value de l'année après compensation (case 3VH), sans les moins-values antérieures. */
  yearLoss: number;
  /** Moins-values encore imputables l'année suivante. */
  carryOut: LossCarry[];
}

/** Une ligne par année, de la première cession à `untilYear` compris. */
export function securitiesGains(disposals: readonly Disposal[], accounts: readonly Account[], untilYear: number, lossCarryYears = 10): SecuritiesYear[] {
  const cto = new Set(accounts.filter((a) => a.kind === "cto").map((a) => a.id));
  const relevant = disposals.filter((d) => cto.has(d.accountId));
  if (relevant.length === 0) return [];
  const first = Math.min(...relevant.map((d) => +d.date.slice(0, 4)));
  const rows: SecuritiesYear[] = [];
  let pool: LossCarry[] = [];
  for (let year = first; year <= untilYear; year++) {
    const ofYear = relevant.filter((d) => +d.date.slice(0, 4) === year);
    const gains = roundCents(ofYear.reduce((s, d) => s + Math.max(0, d.gain), 0));
    const losses = roundCents(ofYear.reduce((s, d) => s + Math.max(0, -d.gain), 0));
    const net = roundCents(gains - losses);
    pool = pool.filter((c) => year - c.year <= lossCarryYears);

    let remaining = Math.max(0, net);
    const usedCarry: LossCarry[] = [];
    pool = pool.flatMap((c) => {
      const used = roundCents(Math.min(c.amount, remaining));
      if (used <= 0) return [c];
      usedCarry.push({ year: c.year, amount: used });
      remaining = roundCents(remaining - used);
      const left = roundCents(c.amount - used);
      return left > 0 ? [{ year: c.year, amount: left }] : [];
    });
    const yearLoss = Math.max(0, -net);
    if (yearLoss > 0) pool.push({ year, amount: yearLoss });
    rows.push({ year, gains, losses, net, usedCarry, taxableGain: remaining, yearLoss, carryOut: pool.filter((c) => year + 1 - c.year <= lossCarryYears).map((c) => ({ ...c })) });
  }
  return rows;
}
