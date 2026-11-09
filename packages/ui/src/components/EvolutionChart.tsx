import { useMemo } from "react";
import { formatEur } from "@hamac/core";
import { Chart, axisStyle, type ChartOption } from "./Chart";
import { INK } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { axisFloor, gainBand, historyForPeriod, PERIODS, type EvolutionPoint, type PeriodKey } from "@/lib/dashboard";
import { capitalize, formatMonth } from "@/lib/numbers";

const money = (v: number) => formatEur(v, { compact: true });

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

/** Patrimoine et argent versé : l'écart entre les deux courbes, coloré, est le gain ou la perte. */
export function EvolutionChart({ points, period, valueLabel = "Patrimoine", height = 300 }: { points: readonly EvolutionPoint[]; period: PeriodKey; valueLabel?: string; height?: number }) {
  const option = useMemo<ChartOption>(() => {
    const shown = historyForPeriod(points, period);
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
          const h = shown[params[0]!.dataIndex]!;
          return `<div style="margin-bottom:4px;color:${INK.muted}">${capitalize(formatMonth(h.month))}</div>${tooltipRow(INK.accent, valueLabel, money(h.value))}${tooltipRow(INK.muted, "Versé net", money(h.netContrib))}<div style="margin-top:4px">${h.gain >= 0 ? "Gain" : "Perte"} : <b>${money(Math.abs(h.gain))}</b></div>`;
        },
      },
      legend: { data: [valueLabel, "Versé net"], top: 0, left: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: INK.muted } },
      grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: shown.map((h) => capitalize(formatMonth(h.month))), ...axisStyle, splitLine: { show: false } },
      yAxis: { type: "value", min: axisFloor(shown), ...axisStyle, axisLabel: { color: INK.faint, formatter: (v: number) => (inThousands ? `${Math.round(v / 1000)} k€` : money(v)) } },
      series: [
        { ...helper, name: "base", areaStyle: { opacity: 0 }, data: base },
        { ...helper, name: "écart", areaStyle: { color: INK.accent, opacity: 0.14 }, data: band },
        { name: valueLabel, type: "line", showSymbol: false, symbolSize: 8, data: shown.map((h) => h.value), lineStyle: { width: 2, color: INK.accent }, itemStyle: { color: INK.accent } },
        { name: "Versé net", type: "line", showSymbol: false, symbolSize: 8, data: shown.map((h) => h.netContrib), lineStyle: { width: 2, type: "dashed", color: INK.muted }, itemStyle: { color: INK.muted } },
      ],
    };
  }, [points, period, valueLabel]);
  return <Chart option={option} height={height} />;
}
