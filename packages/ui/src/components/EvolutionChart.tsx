import { useMemo } from "react";
import { formatEur } from "@hamac/core";
import { Chart, axisStyle, type ChartOption } from "./Chart";
import { INK } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { axisFloor, gainBand, historyForPeriod, PERIODS, type AssetLine, type EvolutionPoint, type PeriodKey } from "@/lib/dashboard";
import { capitalize, formatMonth } from "@/lib/numbers";

const money = (v: number) => formatEur(v, { compact: true });
const TOTAL = "Valeur totale";
const INVESTED = "Montant investi";

/** Couleurs des titres : ordre fixe, validé sur fond sombre (daltonisme compris). */
const LINE_COLORS = ["#1b895f", "#8f63d8", "#cf7a25", "#539ad3", "#c0587e"];

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

/** Une couleur par titre, d'après son nom : elle ne change pas quand les montants changent de rang. */
function colorsOf(lines: readonly AssetLine[]): Map<string, string> {
  const assets = lines.filter((l) => l.key !== "especes").sort((a, b) => a.name.localeCompare(b.name));
  return new Map([...assets.map((l, i) => [l.key, LINE_COLORS[i % LINE_COLORS.length]!] as const), ["especes", INK.faint] as const]);
}

/**
 * Valeur totale et montant investi : l'écart entre les deux courbes, coloré, est le gain ou la perte.
 * `lines` ajoute une courbe par titre ; un clic sur la légende masque ou réaffiche chacune.
 */
export function EvolutionChart({ points, period, lines = [], height = 300 }: { points: readonly EvolutionPoint[]; period: PeriodKey; lines?: readonly AssetLine[]; height?: number }) {
  const option = useMemo<ChartOption>(() => {
    const shown = historyForPeriod(points, period);
    const shownLines = lines.map((l) => ({ ...l, values: historyForPeriod(l.values, period) }));
    const colors = colorsOf(lines);
    const { base, band } = gainBand(shown);
    const helper = { type: "line", stack: "gain", silent: true, showSymbol: false, lineStyle: { opacity: 0 }, emphasis: { disabled: true } } as const;
    const inThousands = Math.max(...shown.map((p) => Math.max(p.value, p.netContrib))) >= 20_000;
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: INK.surface2,
        borderColor: INK.line,
        textStyle: { color: INK.fg, fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: INK.faint, width: 1 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const i = params[0]!.dataIndex;
          const h = shown[i]!;
          const details = shownLines.filter((l) => l.values[i]).map((l) => tooltipRow(colors.get(l.key)!, l.name, money(l.values[i]!))).join("");
          return `<div style="margin-bottom:4px;color:${INK.muted}">${capitalize(formatMonth(h.month))}</div>${tooltipRow(INK.accent, TOTAL, money(h.value))}${tooltipRow(INK.muted, INVESTED, money(h.netContrib))}<div style="margin:4px 0">${h.gain >= 0 ? "Gain" : "Perte"} : <b>${money(Math.abs(h.gain))}</b></div>${details}`;
        },
      },
      legend: { data: [TOTAL, INVESTED, ...lines.map((l) => l.name)], top: 0, left: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: INK.muted } },
      grid: { left: 8, right: 16, top: lines.length > 2 ? 58 : 34, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: shown.map((h) => capitalize(formatMonth(h.month))), ...axisStyle, splitLine: { show: false } },
      // Avec les titres, l'axe part de zéro : ils valent chacun bien moins que le total.
      yAxis: { type: "value", min: lines.length ? 0 : axisFloor(shown), ...axisStyle, axisLabel: { color: INK.faint, formatter: (v: number) => (inThousands ? `${Math.round(v / 1000)} k€` : money(v)) } },
      series: [
        { ...helper, name: "base", areaStyle: { opacity: 0 }, data: base },
        { ...helper, name: "écart", areaStyle: { color: INK.accent, opacity: 0.14 }, data: band },
        { name: TOTAL, type: "line", showSymbol: false, symbolSize: 8, data: shown.map((h) => h.value), lineStyle: { width: 2, color: INK.accent }, itemStyle: { color: INK.accent } },
        { name: INVESTED, type: "line", showSymbol: false, symbolSize: 8, data: shown.map((h) => h.netContrib), lineStyle: { width: 2, type: "dashed", color: INK.muted }, itemStyle: { color: INK.muted } },
        ...shownLines.map((l) => ({ name: l.name, type: "line", showSymbol: false, symbolSize: 8, data: l.values, lineStyle: { width: 2, color: colors.get(l.key), type: l.key === "especes" ? ("dotted" as const) : ("solid" as const) }, itemStyle: { color: colors.get(l.key) } })),
      ],
    };
  }, [points, period, lines]);
  return <Chart option={option} height={height} />;
}
