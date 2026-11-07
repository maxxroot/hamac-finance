import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";
import { INK } from "@/lib/colors";

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, SVGRenderer]);

export type ChartOption = echarts.EChartsCoreOption;

/** Habillage commun : axes et grille discrets, info-bulle sombre, légende en bas. */
export const baseOption: ChartOption = {
  backgroundColor: "transparent",
  textStyle: { fontFamily: "Inter Variable, system-ui, sans-serif", color: INK.muted, fontSize: 12 },
  grid: { left: 8, right: 36, top: 16, bottom: 40, containLabel: true },
  tooltip: {
    trigger: "axis",
    backgroundColor: INK.surface2,
    borderColor: INK.line,
    textStyle: { color: INK.fg, fontSize: 12 },
    axisPointer: { type: "line", lineStyle: { color: INK.faint, width: 1 } },
  },
  legend: { bottom: 0, icon: "roundRect", itemWidth: 12, itemHeight: 4, textStyle: { color: INK.muted } },
};

export const axisStyle = {
  axisLine: { lineStyle: { color: INK.line } },
  axisTick: { show: false },
  axisLabel: { color: INK.faint, hideOverlap: true },
  splitLine: { lineStyle: { color: INK.line, type: "dashed" as const } },
};

export function Chart({ option, height = 300, className }: { option: ChartOption; height?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

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
    chart.current?.setOption({ ...baseOption, ...option }, true);
  }, [option]);

  return <div ref={ref} style={{ height }} className={className} />;
}
