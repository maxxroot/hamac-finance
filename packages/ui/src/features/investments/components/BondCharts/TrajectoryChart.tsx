import { useMemo } from "react";
import type { TrajectoryYear } from "@hamac/core";
import { Chart, axisStyle, tooltipStyle, type ChartOption } from "@/shared/components/Chart";
import { Card, CardTitle } from "@/shared/components/ui";
import { useChartColors } from "@/shared/lib/colors";
import { formatDate } from "@/shared/lib/numbers";
import { bondColors, money, tooltipRow, tooltipTitle, topLegend } from "./_bits";

/**
 * D'aujourd'hui à la dernière échéance, une barre par année en deux parts : l'encours (argent encore placé dans les lignes)
 * et les flux encaissés (coupons et remboursements cumulés). La hauteur, c'est le total ; d'année en année,
 * l'encours se transforme en flux encaissés.
 */
export function TrajectoryChart({ years }: { years: readonly TrajectoryYear[] }) {
  const c = useChartColors();
  const option = useMemo<ChartOption>(() => {
    const k = bondColors(c);
    const last = years.length - 1;
    const title = (y: TrajectoryYear, i: number) => {
      if (y.year == null) return "Aujourd'hui";
      return i === last ? `À la dernière échéance (${formatDate(y.date)})` : `Au 31/12/${y.year}`;
    };
    return {
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(c),
        axisPointer: { type: "shadow", shadowStyle: { color: c.ink.line, opacity: 0.45 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const i = params[0]!.dataIndex;
          const y = years[i]!;
          return [
            tooltipTitle(c, title(y, i)),
            tooltipRow(k.value, "Encours", money(y.value)),
            tooltipRow(k.coupons, "Flux encaissés", money(y.coupons + y.redeemed)),
            `<div style="padding-left:14px;color:${c.ink.muted}">dont coupons ${money(y.coupons)}, remboursements ${money(y.redeemed)}</div>`,
            `<div style="margin-top:4px">Total : <b>${money(y.value + y.coupons + y.redeemed)}</b></div>`,
          ].join("");
        },
      },
      legend: topLegend(c, ["Encours", "Flux encaissés"]),
      grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: years.map((y) => (y.year == null ? "Auj." : String(y.year))), ...axisStyle(c), splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: money } },
      series: [
        { name: "Encours", type: "bar", stack: "total", barMaxWidth: 28, data: years.map((y) => y.value || null), itemStyle: { color: k.value, borderColor: c.ink.surface, borderWidth: 2 } },
        {
          name: "Flux encaissés",
          type: "bar",
          stack: "total",
          barMaxWidth: 28,
          data: years.map((y) => y.coupons + y.redeemed || null),
          itemStyle: { color: k.coupons, borderColor: c.ink.surface, borderWidth: 2, borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }, [years, c]);

  return (
    <Card>
      <CardTitle hint="En fin d'année, jusqu'à la dernière échéance">Évolution de l'encours</CardTitle>
      <Chart option={option} height={260} />
    </Card>
  );
}
