import { useMemo, useState } from "react";
import { formatEur } from "@hamac/core";
import { Chart, axisStyle, tooltipStyle, type ChartOption, type LegendSelection } from "./Chart";
import { useChartColors, type ChartColors } from "@/shared/lib/colors";
import { cn } from "@/shared/lib/cn";
import { gainBand, historyForPeriod, PERIODS, type AssetLine, type EvolutionPoint, type PeriodKey } from "@/shared/lib/evolution";
import { capitalize, formatMonth } from "@/shared/lib/numbers";

const money = (v: number) => formatEur(v, { compact: true });
const TOTAL = "Valeur totale";
const INVESTED = "Montant investi";

function tooltipRow(color: string, label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;gap:20px"><span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:${color}"></span>${label}</span><b>${value}</b></div>`;
}

export function PeriodSelector({ value, onChange }: { value: PeriodKey; onChange: (p: PeriodKey) => void }) {
  return (
    <span className="flex rounded-md bg-surface-2 p-0.5 text-xs">
      {PERIODS.map((x) => (
        <button key={x.key} type="button" aria-pressed={value === x.key} onClick={() => onChange(x.key)} className={cn("rounded px-2 py-0.5", value === x.key ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>
          {x.key}
        </button>
      ))}
    </span>
  );
}

/**
 * Une couleur par courbe, d'après son nom : elle ne change pas quand les montants changent de rang.
 * Au-delà de la palette, les couleurs reviennent en tirets pour que deux courbes ne se confondent pas.
 */
type LineLook = { color: string; type: "solid" | "dashed" | "dotted" };

function stylesOf(lines: readonly AssetLine[], c: ChartColors): Map<string, LineLook> {
  const assets = lines.filter((l) => l.key !== "especes").sort((a, b) => a.name.localeCompare(b.name));
  const n = c.series.length;
  return new Map<string, LineLook>([
    ...assets.map((l, i): [string, LineLook] => [l.key, { color: c.series[i % n]!, type: i < n ? "solid" : "dashed" }]),
    ["especes", { color: c.ink.faint, type: "dotted" }],
  ]);
}

/**
 * Valeur totale et montant investi : l'écart entre les deux courbes, coloré, est le gain ou la perte.
 * `lines` ajoute une courbe par titre ; un clic sur la légende masque ou réaffiche chacune.
 * La zone de gain n'a de sens qu'entre les deux courbes : elle disparaît dès que l'une est masquée,
 * et l'échelle, l'info-bulle et les unités ne tiennent compte que de ce qui reste affiché.
 */
export function EvolutionChart({ points, period, lines = [], height = 300 }: { points: readonly EvolutionPoint[]; period: PeriodKey; lines?: readonly AssetLine[]; height?: number }) {
  const c = useChartColors();
  // Gardé ici : le graphique est entièrement redessiné à chaque changement d'option, légende comprise.
  const [selected, setSelected] = useState<LegendSelection>({});
  const option = useMemo<ChartOption>(() => {
    const visible = (name: string) => selected[name] !== false;
    const showTotal = visible(TOTAL);
    const showInvested = visible(INVESTED);
    const shown = historyForPeriod(points, period);
    const shownLines = lines.map((l) => ({ ...l, values: historyForPeriod(l.values, period) }));
    const styles = stylesOf(lines, c);
    // Une légende de plus d'une ligne défile au lieu de mordre sur le graphique.
    const scrollLegend = lines.length > 5;
    const { base, band } = gainBand(shown);
    const helper = { type: "line", stack: "gain", silent: true, showSymbol: false, lineStyle: { opacity: 0 }, emphasis: { disabled: true } } as const;
    const visibleLines = shownLines.filter((l) => visible(l.name));
    const visibleValues = [...(showTotal ? shown.map((p) => p.value) : []), ...(showInvested ? shown.map((p) => p.netContrib) : []), ...visibleLines.flatMap((l) => l.values)];
    const inThousands = Math.max(0, ...visibleValues) >= 20_000;
    return {
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(c),
        axisPointer: { type: "line", lineStyle: { color: c.ink.faint, width: 1 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const i = params[0]!.dataIndex;
          const h = shown[i]!;
          const details = visibleLines.filter((l) => l.values[i]).map((l) => tooltipRow(styles.get(l.key)!.color, l.name, money(l.values[i]!))).join("");
          const total = showTotal ? tooltipRow(c.primary, TOTAL, money(h.value)) : "";
          const invested = showInvested ? tooltipRow(c.ink.muted, INVESTED, money(h.netContrib)) : "";
          const gain = showTotal && showInvested ? `<div style="margin:4px 0">${h.gain >= 0 ? "Gain" : "Perte"} : <b>${money(Math.abs(h.gain))}</b></div>` : "";
          return `<div style="margin-bottom:4px;color:${c.ink.muted}">${capitalize(formatMonth(h.month))}</div>${total}${invested}${gain}${details}`;
        },
      },
      legend: {
        data: [TOTAL, INVESTED, ...lines.map((l) => l.name)],
        top: 0,
        left: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: c.ink.muted },
        selected,
        ...(scrollLegend ? { type: "scroll", right: 0, pageIconColor: c.ink.muted, pageIconInactiveColor: c.ink.faint, pageTextStyle: { color: c.ink.faint } } : {}),
      },
      grid: { left: 8, right: 16, top: lines.length > 2 && !scrollLegend ? 58 : 34, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: shown.map((h) => capitalize(formatMonth(h.month))), ...axisStyle(c), splitLine: { show: false } },
      // Seul, le total n'a pas besoin de partir de zéro, ce qui écraserait ses variations. Avec les titres, si : ils valent bien moins.
      yAxis: { type: "value", ...(lines.length ? { min: 0 } : { scale: true }), ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: (v: number) => (inThousands ? `${Math.round(v / 1000)} k€` : money(v)) } },
      series: [
        ...(showTotal && showInvested
          ? [
              { ...helper, name: "base", areaStyle: { opacity: 0 }, data: base },
              { ...helper, name: "écart", areaStyle: { color: c.primary, opacity: 0.14 }, data: band },
            ]
          : []),
        { name: TOTAL, type: "line", showSymbol: false, symbolSize: 8, data: shown.map((h) => h.value), lineStyle: { width: 2, color: c.primary }, itemStyle: { color: c.primary } },
        { name: INVESTED, type: "line", showSymbol: false, symbolSize: 8, data: shown.map((h) => h.netContrib), lineStyle: { width: 2, type: "dashed", color: c.ink.muted }, itemStyle: { color: c.ink.muted } },
        ...shownLines.map((l) => {
          const s = styles.get(l.key)!;
          return { name: l.name, type: "line", showSymbol: false, symbolSize: 8, data: l.values, lineStyle: { width: 2, color: s.color, type: s.type }, itemStyle: { color: s.color } };
        }),
      ],
    };
  }, [points, period, lines, c, selected]);
  return <Chart option={option} height={height} onLegendSelect={setSelected} />;
}
