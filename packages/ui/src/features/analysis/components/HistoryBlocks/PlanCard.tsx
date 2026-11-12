import { useMemo } from "react";
import { Link } from "react-router";
import { type Month, type PlanComparison } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Chart, axisStyle, tooltipStyle, type ChartOption } from "@/shared/components/Chart";
import { Card, CardTitle } from "@/shared/components/ui";
import { useChartColors } from "@/shared/lib/colors";
import { cn } from "@/shared/lib/cn";
import { planVerdict } from "@/features/analysis/lib/historique";
import { eurText, eurAxis } from "./_format";

export const BUCKET_UNRATED: Partial<Record<string, string>> = { speculatif: "la crypto", crowdlending: "le crowdlending", immobilier: "l'immobilier (SCPI)" };

export function PlanCard({ p, monthLabel }: { p: PlanComparison; monthLabel: (m: Month) => string }) {
  const c = useChartColors();
  const verdict = planVerdict(p);
  const option = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: "axis", ...tooltipStyle(c), valueFormatter: (v: unknown) => eurText(Number(v)) },
      legend: { show: false },
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: p.path.map((x) => monthLabel(x.month)), ...axisStyle(c), splitLine: { show: false } },
      yAxis: { type: "value", scale: true, ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: eurAxis } },
      series: [
        { name: "Prévu", type: "line", data: p.path.map((x) => x.expected), showSymbol: false, lineStyle: { width: 2, type: "dashed", color: c.ink.muted }, itemStyle: { color: c.ink.muted } },
        { name: "Réel", type: "line", data: p.path.map((x) => x.actual), showSymbol: false, lineStyle: { width: 2, color: c.primary }, itemStyle: { color: c.primary } },
      ],
    }),
    [p, c, monthLabel],
  );
  const unrated = p.unrated.map((b) => BUCKET_UNRATED[b]).filter(Boolean);
  return (
    <Card>
      <CardTitle hint={<Link to="/projection" className="text-accent hover:underline">Régler les rendements attendus</Link>}>Par rapport au plan</CardTitle>
      <p className={cn("font-display text-2xl", verdict === "avance" && "text-positive", verdict === "retard" && "text-negative")}>
        {verdict === "conforme" ? "Dans les clous" : verdict === "avance" ? `En avance de ${eurText(p.gap)}` : `En retard de ${eurText(-p.gap)}`}
      </p>
      <p className="mt-1 text-sm text-fg-muted">
        Prévu : <Amount value={p.expectedEnd} compact /> · réel : <Amount value={p.actualEnd} compact className="text-fg" />
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-fg-muted">
            Épargne <span className="text-xs text-fg-faint">(prévu <Amount value={p.plannedMoney} compact />, apporté <Amount value={p.actualMoney} compact />)</span>
          </dt>
          <dd><Amount value={p.moneyGap} signed compact /></dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-fg-muted">
            Placements <span className="text-xs text-fg-faint">(prévu <Amount value={p.expectedGain} signed compact />, obtenu <Amount value={p.actualGain} signed compact />)</span>
          </dt>
          <dd><Amount value={p.gainGap} signed compact /></dd>
        </div>
      </dl>
      {p.path.length > 1 && (
        <>
          <div className="mt-4 flex gap-4 text-xs text-fg-faint">
            <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-fg-muted" aria-hidden />prévu</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-accent" aria-hidden />réel</span>
          </div>
          <Chart option={option} height={170} />
        </>
      )}
      <p className="mt-2 text-xs text-fg-faint">
        Le plan part de la valeur de départ, fait grandir chaque classe à son rendement attendu et ajoute les versements programmés, avec les réglages actuels.
        {unrated.length > 0 && ` Sans rendement attendu, ${unrated.join(" et ")} ${unrated.length > 1 ? "sont comptés" : "est compté"} sans gain.`}
      </p>
    </Card>
  );
}

// ——— Situation ———
