import { useMemo } from "react";
import { availableBalance, formatEur, type AvailableBalance } from "@hamac/core";
import { useEngineData } from "@/shared/lib/portfolio";
import { formatDate } from "@/shared/lib/numbers";

/** Solde disponible pour un retrait, à la date de l'opération ; null hors retrait. */
export function useAvailableBalance(q: { active: boolean; accountId: string; date: string; supportId: string | null; txId?: string }): AvailableBalance | null {
  const data = useEngineData();
  const { active, accountId, date, supportId, txId } = q;
  return useMemo(() => (data && active && date ? availableBalance(data, accountId, date, { supportId, excludeTxId: txId }) : null), [data, active, accountId, date, supportId, txId]);
}

/** Aide sous le montant d'un retrait : solde disponible et bouton « Tout retirer ». */
export function AvailableBalanceHint({ available, date, amount, onWithdrawAll }: { available: AvailableBalance; date: string; amount: number | null; onWithdrawAll: (v: number) => void }) {
  const where = available.source.kind === "fonds_euros" ? ` sur ${available.source.name}` : "";
  const over = amount != null && amount > available.amount + 0.005;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>
        Disponible le {formatDate(date)}
        {where} : <b className={available.amount < 0 ? "num text-negative" : "num text-fg"}>{formatEur(available.amount)}</b>
      </span>
      {available.amount > 0 && (
        <button type="button" className="cursor-pointer font-medium text-accent underline-offset-2 hover:underline" onClick={() => onWithdrawAll(available.amount)}>
          Tout retirer
        </button>
      )}
      {over && <span className="w-full text-warning">Le montant dépasse le solde disponible.</span>}
    </span>
  );
}
