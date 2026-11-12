import { useMemo } from "react";
import { type Month, type MonthChange } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Chart, axisStyle, tooltipStyle, type ChartOption } from "@/shared/components/Chart";
import { Card, CardTitle } from "@/shared/components/ui";
import { useChartColors } from "@/shared/lib/colors";
import { chartBars, monthStats } from "@/features/analysis/lib/historique";
import { signedText, eurAxis } from "./_format";

export function MonthsCard({ months, monthLabel }: { months: readonly MonthChange[]; monthLabel: (m: Month) => string }) {
  const c = useChartColors();
  const { bars, yearly } = useMemo(() => chartBars(months, monthLabel), [months, monthLabel]);
  const stats = useMemo(() => monthStats(months), [months]);
  const option = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...tooltipStyle(c), valueFormatter: (v: unknown) => signedText(Number(v)) },
      legend: { show: false },
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: bars.map((b) => b.label), ...axisStyle(c), splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: eurAxis } },
      series: [
        { name: "Argent apporté", type: "bar", barMaxWidth: 18, data: bars.map((b) => Math.round(b.money)), itemStyle: { color: c.buckets.precaution, borderRadius: 2 } },
        {
          name: "Gain des placements",
          type: "bar",
          barMaxWidth: 18,
          data: bars.map((b) => ({ value: Math.round(b.gain), itemStyle: { color: b.gain >= 0 ? c.polarity.positive : c.polarity.negative, borderRadius: 2 } })),
        },
      ],
    }),
    [bars, c],
  );
  const named = (list: readonly Month[]) => list.slice(0, 3).map(monthLabel).join(", ") + (list.length > 3 ? "…" : "");
  return (
    <Card>
      <CardTitle
        hint={
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-precaution" aria-hidden />apporté</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-positive" aria-hidden />gain</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-negative" aria-hidden />perte</span>
          </span>
        }
      >
        {yearly ? "Année par année" : "Mois par mois"}
      </CardTitle>
      {months.length === 0 ? <p className="py-16 text-center text-sm text-fg-muted">Aucun mois sur cette période.</p> : <Chart option={option} height={220} />}
      {months.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-fg-muted">
          <li>{stats.empty.length === 0 ? "Un versement chaque mois" : `${stats.empty.length} mois sans versement (${named(stats.empty)})`}</li>
          {stats.best && (
            <li>
              Meilleur mois : <Amount value={stats.best.gain} signed compact /> en {monthLabel(stats.best.month).toLowerCase()}
              {stats.worst && (
                <>
                  {" · "}pire : <Amount value={stats.worst.gain} signed compact /> en {monthLabel(stats.worst.month).toLowerCase()}
                </>
              )}
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

// ——— Par rapport au plan ———
