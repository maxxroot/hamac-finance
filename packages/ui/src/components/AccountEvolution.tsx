import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Amount } from "./Amount";
import { EvolutionChart, PeriodSelector } from "./EvolutionChart";
import { Pct } from "./Stat";
import { Button } from "./ui";
import { cn } from "@/lib/cn";
import { accountHistory, assetLines, historyForPeriod, positionHistory, type AssetLine, type EvolutionPoint, type PeriodKey } from "@/lib/dashboard";
import { useHistory, usePortfolio } from "@/lib/portfolio";

function EvolutionPanel({ points, lines }: { points: readonly EvolutionPoint[]; lines?: readonly AssetLine[] }) {
  const [period, setPeriod] = useState<PeriodKey>("Tout");
  if (points.length < 2) return <p className="rounded-lg bg-surface p-6 text-center text-sm text-fg-muted">L'évolution apparaîtra après un mois d'historique.</p>;
  const now = points.at(-1)!;
  const start = historyForPeriod(points, period)[0]!;
  return (
    <div className="rounded-lg bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm text-fg-muted">
        <span className="flex flex-wrap gap-x-6 gap-y-1">
          <span>
            Valeur totale : <b className="text-fg"><Amount value={now.value} compact /></b>
          </span>
          <span>
            Montant investi : <b className="text-fg"><Amount value={now.netContrib} compact /></b>
          </span>
          <span>
            Gain : <b><Amount value={now.gain} signed compact /></b> <Pct value={now.netContrib > 0 ? now.gain / now.netContrib : null} signed />
          </span>
          <span>
            Sur la période : <b><Amount value={now.gain - start.gain} signed compact /></b> de gain
          </span>
        </span>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>
      <EvolutionChart points={points} period={period} lines={lines} height={lines?.length ? 320 : 260} />
    </div>
  );
}

/** Évolution d'un compte (ou de plusieurs, additionnés), avec une courbe par titre s'il en détient. */
export function AccountEvolution({ accountIds }: { accountIds: readonly string[] }) {
  const history = useHistory();
  const assetById = usePortfolio()?.idx.assetById;
  const points = useMemo(() => accountHistory(history ?? [], accountIds), [history, accountIds]);
  const lines = useMemo(() => assetLines(history ?? [], points, accountIds, (id) => assetById?.get(id)?.name ?? id), [history, points, accountIds, assetById]);
  return <EvolutionPanel points={points} lines={lines} />;
}

/** Évolution d'un seul titre dans un compte. */
export function PositionEvolution({ accountId, assetId }: { accountId: string; assetId: string }) {
  const history = useHistory();
  const points = useMemo(() => positionHistory(history ?? [], accountId, assetId), [history, accountId, assetId]);
  return <EvolutionPanel points={points} />;
}

/** Bouton d'affichage de l'évolution, pour les enveloppes présentées en bloc plutôt qu'en ligne. */
export function EvolutionToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Button variant="ghost" className="h-8 px-2 text-xs font-normal" aria-expanded={open} onClick={onToggle}>
      <ChevronRight size={14} className={cn("transition-transform", open && "rotate-90")} aria-hidden /> Évolution
    </Button>
  );
}
