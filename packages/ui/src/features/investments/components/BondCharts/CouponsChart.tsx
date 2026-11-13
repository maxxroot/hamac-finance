import { useMemo } from "react";
import type { CouponYear } from "@hamac/core";
import { Chart, axisStyle, tooltipStyle, type ChartOption } from "@/shared/components/Chart";
import { Card, CardTitle } from "@/shared/components/ui";
import { useChartColors } from "@/shared/lib/colors";
import { bondColors, money, tooltipRow, tooltipTitle, topLegend } from "./_bits";

/**
 * Coupons perçus chaque année, mis en avant, devant les coupons échus en pointillés :
 * une barre pleine plus basse que son contour signale un coupon non saisi.
 */
export function CouponsChart({ years }: { years: readonly CouponYear[] }) {
  const c = useChartColors();
  const option = useMemo<ChartOption>(() => {
    const color = bondColors(c).coupons;
    return {
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(c),
        axisPointer: { type: "shadow", shadowStyle: { color: c.ink.line, opacity: 0.45 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const y = years[params[0]!.dataIndex]!;
          const gap = y.expected - y.received;
          return `${tooltipTitle(c, String(y.year))}${tooltipRow(color, "Perçus", money(y.received))}${tooltipRow(c.ink.faint, "Échus", money(y.expected))}${gap > 0.5 ? `<div style="margin-top:4px;color:${c.ink.muted}">Non saisis : <b>${money(gap)}</b></div>` : ""}`;
        },
      },
      legend: topLegend(c, ["Perçus", "Échus"]),
      grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: years.map((y) => String(y.year)), ...axisStyle(c), splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: money } },
      series: [
        // Contour des attendus derrière, barre pleine des reçus devant (même emplacement).
        { name: "Échus", type: "bar", barMaxWidth: 28, barGap: "-100%", z: 1, data: years.map((y) => y.expected), itemStyle: { color: "transparent", borderColor: c.ink.faint, borderType: "dashed", borderWidth: 1.5, borderRadius: [4, 4, 0, 0] } },
        { name: "Perçus", type: "bar", barMaxWidth: 28, z: 2, data: years.map((y) => y.received), itemStyle: { color, borderRadius: [4, 4, 0, 0] } },
      ],
    };
  }, [years, c]);

  return (
    <Card>
      <CardTitle hint="Montants bruts, d'après le Journal">Coupons perçus et échus</CardTitle>
      <Chart option={option} height={260} />
    </Card>
  );
}
