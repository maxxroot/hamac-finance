import type { Account, Statement } from "../model";
import { computePortfolio, type EngineData, type PortfolioState } from "./engine";
import { roundCents } from "../base";

/**
 * Contrôle avec le relevé : la valeur relevée sur le site de l'établissement, comparée au calcul
 * à la date du relevé (et non à aujourd'hui). Un écart signale une opération oubliée ou mal saisie.
 */

/** Sous ce seuil, l'écart vient des arrondis. */
export const MONEY_TOLERANCE = 1;

export interface ReconciliationRow {
  account: Account;
  statement: Statement | null;
  /** Valeur calculée à la date du relevé. */
  computedValue: number | null;
  valueGap: number | null;
  status: "jamais" | "concorde" | "ecart";
}

/** Dernier relevé de chaque compte, comparé au calcul à sa date. */
export function reconcile(data: EngineData, asOf: string): ReconciliationRow[] {
  const states = new Map<string, PortfolioState>();
  const stateAt = (date: string) => {
    const hit = states.get(date) ?? computePortfolio(data, date);
    states.set(date, hit);
    return hit;
  };
  return data.accounts.map((account): ReconciliationRow => {
    const statement = (data.statements ?? []).filter((s) => s.accountId === account.id && s.date <= asOf).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    if (!statement) return { account, statement: null, computedValue: null, valueGap: null, status: "jamais" };
    const computedValue = stateAt(statement.date).accountById.get(account.id)?.value ?? 0;
    const valueGap = roundCents(statement.value - computedValue);
    return { account, statement, computedValue, valueGap, status: Math.abs(valueGap) >= MONEY_TOLERANCE ? "ecart" : "concorde" };
  });
}
