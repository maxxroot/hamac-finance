import type { PositionState } from "@hamac/core";
import { Amount } from "./Amount";

/**
 * Sous la valeur en euros d'une ligne en devise : sa valeur dans la devise du titre ; sous la plus-value, la part due au change.
 * Rien pour une ligne en euros.
 */
export function ForeignValue({ p }: { p: Pick<PositionState, "currency" | "valueFx"> }) {
  if (p.currency === "EUR") return null;
  return (
    <div className="text-[11px] font-normal text-fg-faint">
      <Amount value={p.valueFx} currency={p.currency} />
    </div>
  );
}

export function ForeignGain({ p }: { p: Pick<PositionState, "currency" | "fxGain"> }) {
  if (p.currency === "EUR") return null;
  return (
    <div className="text-[11px] text-fg-faint" title="Part de la plus-value due au taux de change depuis l'achat">
      dont change <Amount value={p.fxGain} signed />
    </div>
  );
}
