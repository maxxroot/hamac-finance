import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";
import { useChartColors, type ChartColors } from "@/lib/colors";

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, SVGRenderer]);

export type ChartOption = echarts.EChartsCoreOption;

const FONT = "Hanken Grotesk Variable, system-ui, sans-serif";

/** Info-bulle commune : surface du thème, filet fin, chiffres alignés. */
export function tooltipStyle(c: ChartColors) {
  return {
    backgroundColor: c.ink.surface2,
    borderColor: c.ink.line,
    borderWidth: 1,
    padding: [8, 12],
    extraCssText: "box-shadow:0 8px 24px rgba(10,20,15,.18);border-radius:8px;font-variant-numeric:tabular-nums",
    textStyle: { color: c.ink.fg, fontSize: 12, fontFamily: FONT },
  };
}

/** Habillage commun : axes et grille discrets, légende en bas. */
function baseOption(c: ChartColors): ChartOption {
  return {
    backgroundColor: "transparent",
    textStyle: { fontFamily: FONT, color: c.ink.muted, fontSize: 12 },
    grid: { left: 8, right: 36, top: 16, bottom: 40, containLabel: true },
    tooltip: { trigger: "axis", ...tooltipStyle(c), axisPointer: { type: "line", lineStyle: { color: c.ink.faint, width: 1 } } },
    legend: { bottom: 0, icon: "roundRect", itemWidth: 12, itemHeight: 4, textStyle: { color: c.ink.muted } },
  };
}

export function axisStyle(c: ChartColors) {
  return {
    axisLine: { lineStyle: { color: c.ink.line } },
    axisTick: { show: false },
    axisLabel: { color: c.ink.faint, hideOverlap: true },
    splitLine: { lineStyle: { color: c.ink.line, type: "dashed" as const } },
  };
}

export function Chart({ option, height = 300, className }: { option: ChartOption; height?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const colors = useChartColors();

  useEffect(() => {
    if (!ref.current) return;
    chart.current = echarts.init(ref.current, undefined, { renderer: "svg" });
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption({ ...baseOption(colors), ...option }, true);
  }, [option, colors]);

  return <div ref={ref} style={{ height }} className={className} />;
}
