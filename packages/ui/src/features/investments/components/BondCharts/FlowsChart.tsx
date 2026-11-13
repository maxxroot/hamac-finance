import { useMemo } from "react";
import type { FlowYear } from "@hamac/core";
import { Chart, axisStyle, tooltipStyle, type ChartOption } from "@/shared/components/Chart";
import { Card, CardTitle } from "@/shared/components/ui";
import { useChartColors } from "@/shared/lib/colors";
import { bondColors, money, tooltipRow, tooltipTitle, topLegend } from "./_bits";

/** Ce qui va arriver chaque année : coupons bruts et remboursements, empilés. */
export function FlowsChart({ years }: { years: readonly FlowYear[] }) {
  const c = useChartColors();
  const option = useMemo<ChartOption>(() => {
    const k = bondColors(c);
    const series = [
      { name: "Coupons", key: "coupons" as const, color: k.coupons },
      { name: "Remboursements", key: "redemptions" as const, color: k.redemptions },
    ].filter((s) => years.some((y) => y[s.key] > 0));
    return {
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(c),
        axisPointer: { type: "shadow", shadowStyle: { color: c.ink.line, opacity: 0.45 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const y = years[params[0]!.dataIndex]!;
          return `${tooltipTitle(c, String(y.year))}${series.map((s) => tooltipRow(s.color, s.name, money(y[s.key]))).join("")}<div style="margin-top:4px">Total : <b>${money(y.coupons + y.redemptions)}</b></div>`;
        },
      },
      legend: topLegend(c, series.map((s) => s.name)),
      grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: years.map((y) => String(y.year)), ...axisStyle(c), splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: money } },
      series: series.map((s, i) => ({
        name: s.name,
        type: "bar",
        stack: "flux",
        barMaxWidth: 28,
        data: years.map((y) => y[s.key] || null),
        itemStyle: { color: s.color, borderColor: c.ink.surface, borderWidth: 2, borderRadius: i === series.length - 1 ? [4, 4, 0, 0] : 0 },
      })),
    };
  }, [years, c]);

  return (
    <Card>
      <CardTitle hint="Coupons bruts et remboursements au pair">Échéancier des flux</CardTitle>
      <Chart option={option} height={260} />
    </Card>
  );
}
