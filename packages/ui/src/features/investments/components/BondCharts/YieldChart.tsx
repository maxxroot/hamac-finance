import { useMemo } from "react";
import { bondKindOf, sovereignCountry, type PositionState } from "@hamac/core";
import { Chart, axisStyle, tooltipStyle, type ChartOption } from "@/shared/components/Chart";
import { Card, CardTitle } from "@/shared/components/ui";
import { useChartColors } from "@/shared/lib/colors";
import { flagHtml } from "@/shared/lib/flags";
import { formatDate } from "@/shared/lib/numbers";
import { KIND_LABELS, bondColors, firstParam, money, pct, tooltipRow, tooltipTitle, topLegend, type TooltipParam } from "./_bits";

/**
 * Rendement à l'échéance de chaque ligne selon sa date d'échéance ; la taille du point suit le nominal.
 * Montre si les lignes longues rapportent vraiment plus que les courtes.
 */
export function YieldChart({ held }: { held: readonly PositionState[] }) {
  const c = useChartColors();
  const option = useMemo<ChartOption>(() => {
    const k = bondColors(c);
    const lines = held.filter((p) => p.bond?.ytm != null);
    const biggest = Math.max(1, ...lines.map((p) => p.bond!.nominal));
    // Surface du point proportionnelle au nominal, entre 10 et 30 px de diamètre.
    const size = (nominal: number) => 10 + 20 * Math.sqrt(nominal / biggest);
    const kinds = (["etat", "entreprise"] as const).filter((kind) => lines.some((p) => bondKindOf(p.asset) === kind));
    const groups = kinds.map((kind) => lines.filter((p) => bondKindOf(p.asset) === kind));
    return {
      tooltip: {
        trigger: "item",
        ...tooltipStyle(c),
        formatter: (p: TooltipParam | TooltipParam[]) => {
          const q = firstParam(p);
          const l = groups[q.seriesIndex ?? 0]?.[q.dataIndex];
          if (!l) return "";
          return `${tooltipTitle(c, `${flagOf(l)}${l.asset.name}`)}${tooltipRow(null, "Échéance", formatDate(l.bond!.terms.maturityDate))}${tooltipRow(null, "Rendement actuariel", pct(l.bond!.ytm!))}${tooltipRow(null, "Nominal", money(l.bond!.nominal))}`;
        },
      },
      legend: topLegend(c, kinds.map((kind) => KIND_LABELS[kind])),
      grid: { left: 8, right: 24, top: 34, bottom: 8, containLabel: true },
      xAxis: { type: "time", ...axisStyle(c), splitLine: { show: false }, axisLabel: { color: c.ink.faint, hideOverlap: true, formatter: "{yyyy}" } },
      yAxis: { type: "value", scale: true, ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: (v: number) => pct(v, 1) } },
      series: kinds.map((kind, i) => ({
        name: KIND_LABELS[kind],
        type: "scatter",
        data: groups[i]!.map((p) => ({ value: [p.bond!.terms.maturityDate, p.bond!.ytm!], symbolSize: size(p.bond!.nominal) })),
        itemStyle: { color: k.kind[kind], opacity: 0.85, borderColor: c.ink.surface, borderWidth: 2 },
      })),
    };
  }, [held, c]);

  return (
    <Card>
      <CardTitle hint="Taille du point : nominal">Rendement actuariel par maturité</CardTitle>
      <Chart option={option} height={260} />
    </Card>
  );
}

/** Drapeau de l'État émetteur, devant le nom d'une obligation d'État. */
function flagOf(p: PositionState): string {
  const country = sovereignCountry(p.asset);
  return country ? flagHtml(country) : "";
}
