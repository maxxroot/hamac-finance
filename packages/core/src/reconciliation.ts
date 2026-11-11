import { monthsBetween } from "./dates";
import type { Account, Statement } from "./domain";
import { computePortfolio, type EngineData, type PortfolioState } from "./engine";
import { roundCents } from "./money";

/**
 * Rapprochement avec les relevés : la valeur, les espèces et les quantités relevées sur le site de
 * l'établissement, comparées au calcul à la date du relevé. Un écart signale une opération oubliée ou mal saisie.
 */

/** Sous ces seuils, l'écart vient des arrondis ou d'un cours légèrement différent. */
export const MONEY_TOLERANCE = 1;
export const QUANTITY_TOLERANCE = 1e-6;

export type ReconciliationStatus = "jamais" | "concorde" | "ecart";

export interface QuantityGap {
  assetId: string;
  name: string;
  statement: number;
  computed: number;
  gap: number;
}

export interface ReconciliationRow {
  account: Account;
  statement: Statement | null;
  /** Valeur et espèces calculées à la date du relevé. */
  computedValue: number | null;
  computedCash: number | null;
  valueGap: number | null;
  cashGap: number | null;
  quantityGaps: QuantityGap[];
  status: ReconciliationStatus;
  /** Mois écoulés depuis le dernier relevé. */
  monthsSince: number | null;
  /** Correction qui remettrait le calcul d'accord avec le relevé, quand l'écart porte sur l'argent du compte. */
  correction: { date: string; amount: number; reason: string } | null;
  /** Le compte détient des titres à la date du relevé : la valeur dépend aussi des cours. */
  hasPositions: boolean;
}

/** Dernier relevé de chaque compte, comparé au calcul à sa date. */
export function reconcile(data: EngineData, asOf: string): ReconciliationRow[] {
  const states = new Map<string, PortfolioState>();
  const stateAt = (date: string) => {
    const hit = states.get(date);
    if (hit) return hit;
    const s = computePortfolio(data, date);
    states.set(date, s);
    return s;
  };
  const assetName = new Map(data.assets.map((a) => [a.id, a.name]));
  return data.accounts.map((account): ReconciliationRow => {
    const statement = (data.statements ?? []).filter((s) => s.accountId === account.id && s.date <= asOf).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    if (!statement) return { account, statement: null, computedValue: null, computedCash: null, valueGap: null, cashGap: null, quantityGaps: [], status: "jamais", monthsSince: null, correction: null, hasPositions: false };
    const at = stateAt(statement.date).accountById.get(account.id);
    const computedValue = at?.value ?? 0;
    const computedCash = at?.cash ?? 0;
    const held = new Map((at?.positions ?? []).map((p) => [p.asset.id, p.quantity]));
    const valueGap = roundCents(statement.value - computedValue);
    const cashGap = statement.cash == null ? null : roundCents(statement.cash - computedCash);
    const quantityGaps = statement.positions
      .map((p) => ({ assetId: p.assetId, name: assetName.get(p.assetId) ?? "Titre supprimé", statement: p.quantity, computed: held.get(p.assetId) ?? 0, gap: p.quantity - (held.get(p.assetId) ?? 0) }))
      .filter((q) => Math.abs(q.gap) > QUANTITY_TOLERANCE);
    const hasPositions = held.size > 0 || statement.positions.length > 0;
    const off = Math.abs(valueGap) >= MONEY_TOLERANCE || (cashGap != null && Math.abs(cashGap) >= MONEY_TOLERANCE) || quantityGaps.length > 0;
    // Corriger l'argent du compte : les espèces relevées si on les a, sinon la valeur d'un compte sans titres.
    let correction: ReconciliationRow["correction"] = null;
    if (cashGap != null && Math.abs(cashGap) >= MONEY_TOLERANCE) correction = { date: statement.date, amount: cashGap, reason: "Écart sur les espèces relevées" };
    else if (!hasPositions && Math.abs(valueGap) >= MONEY_TOLERANCE) correction = { date: statement.date, amount: valueGap, reason: "Écart avec la valeur relevée" };
    return {
      account,
      statement,
      computedValue,
      computedCash,
      valueGap,
      cashGap,
      quantityGaps,
      status: off ? "ecart" : "concorde",
      monthsSince: monthsBetween(statement.date, asOf),
      correction,
      hasPositions,
    };
  });
}

/**
 * Comptes à rapprocher : ouverts, avec de l'argent, sans relevé depuis plus de `months` mois (0 = pas de rappel).
 * Un compte jamais rapproché compte depuis son ouverture (ou sa première opération), pour ne pas alerter dès sa création.
 */
export function staleAccounts(rows: readonly ReconciliationRow[], data: Pick<EngineData, "transactions">, state: PortfolioState, months: number): ReconciliationRow[] {
  if (months <= 0) return [];
  const firstTx = new Map<string, string>();
  for (const t of data.transactions) if (!firstTx.has(t.accountId) || t.date < firstTx.get(t.accountId)!) firstTx.set(t.accountId, t.date);
  return rows.filter((r) => {
    if (r.account.archived) return false;
    if ((state.accountById.get(r.account.id)?.value ?? 0) <= 0) return false;
    const since = r.statement?.date ?? r.account.openedOn ?? firstTx.get(r.account.id) ?? null;
    return since != null && monthsBetween(since, state.asOf) >= months;
  });
}
