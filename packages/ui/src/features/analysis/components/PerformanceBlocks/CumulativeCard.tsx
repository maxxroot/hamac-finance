import { useMemo, useState } from "react";
import { type CurvePoint } from "@hamac/core";
import { Chart, axisStyle, type ChartOption } from "@/shared/components/Chart";
import { Card, CardTitle } from "@/shared/components/ui";
import { useChartColors } from "@/shared/lib/colors";
import { capitalize, formatMonth } from "@/shared/lib/numbers";
import { tooltip, percentAxis, percentTooltip, CurveUnit, signedEur, eurAxisLabel, UnitToggle } from "./_controls";

/**
 * La performance au fil du temps. En % : rendement cumulé, sans l'effet des versements.
 * En € : gain cumulé (variation de valeur moins l'argent versé), qui finit sur le gain affiché en haut de page.
 */
export function CumulativeCard({ curve }: { curve: readonly CurvePoint[] }) {
  const c = useChartColors();
  const [unit, setUnit] = useState<CurveUnit>("pct");
  const option = useMemo<ChartOption>(() => {
    const eur = unit === "eur";
    const values = curve.map((p) => (eur ? p.gain : p.cumulative));
    return {
      tooltip: eur ? tooltip(c, (v) => signedEur(Number(v))) : percentTooltip(c),
      legend: { show: false },
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: curve.map((p) => capitalize(formatMonth(p.month))), ...axisStyle(c), splitLine: { show: false } },
      yAxis: eur ? { type: "value", scale: true, ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: eurAxisLabel } } : percentAxis(c, [0, ...values]),
      series: [{ name: eur ? "Gain cumulé" : "Rendement cumulé", type: "line", data: values, showSymbol: false, symbolSize: 8, lineStyle: { width: 2, color: c.primary }, itemStyle: { color: c.primary }, markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: c.ink.faint, type: "solid", width: 1 }, data: [{ yAxis: 0 }] } }],
    };
  }, [curve, c, unit]);
  return (
    <Card>
      <CardTitle
        hint={
          <span className="flex items-center gap-3">
            {unit === "eur" ? "versements déduits" : "hors versements"}
            <UnitToggle value={unit} onChange={setUnit} />
          </span>
        }
      >
        {unit === "eur" ? "Gain cumulé" : "Rendement cumulé"}
      </CardTitle>
      {curve.length < 2 ? <p className="py-16 text-center text-sm text-fg-muted">La courbe apparaîtra après un mois d'historique.</p> : <Chart option={option} height={300} />}
    </Card>
  );
}
