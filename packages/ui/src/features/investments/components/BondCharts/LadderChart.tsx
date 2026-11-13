import { useMemo } from "react";
import type { LadderYear } from "@hamac/core";
import { Chart, axisStyle, tooltipStyle, type ChartOption } from "@/shared/components/Chart";
import { Card, CardTitle } from "@/shared/components/ui";
import { useChartColors } from "@/shared/lib/colors";
import { bondColors, money, tooltipRow, tooltipTitle, topLegend } from "./_bits";

/**
 * Échéancier des remboursements : nominal par année d'échéance, souverain et entreprises empilés, achats prévus en pointillés.
 * Les années vides restent visibles. En plan retraite, l'âge s'ajoute sous l'année et la retraite est repérée.
 */
export function LadderChart({ ladder, ageOf, retirementYear }: { ladder: readonly LadderYear[]; ageOf: ((year: number) => number) | null; retirementYear: number | null }) {
  const c = useChartColors();
  const option = useMemo<ChartOption>(() => {
    const k = bondColors(c);
    const label = (y: number) => (ageOf ? `${y}\n${ageOf(y)} ans` : String(y));
    const hasPlans = ladder.some((r) => r.planned > 0);
    const series = [
      { name: "Souverain (OAT)", key: "etat" as const, color: k.kind.etat },
      { name: "Entreprises", key: "entreprise" as const, color: k.kind.entreprise },
    ].filter((s) => ladder.some((r) => r[s.key] > 0));
    const retirement = retirementYear != null && ladder.some((r) => r.year === retirementYear) ? label(retirementYear) : null;
    return {
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(c),
        axisPointer: { type: "shadow", shadowStyle: { color: c.ink.line, opacity: 0.45 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const r = ladder[params[0]!.dataIndex]!;
          const head = tooltipTitle(c, ageOf ? `${r.year} · ${ageOf(r.year)} ans${r.year === retirementYear ? " · retraite" : ""}` : String(r.year));
          if (!r.etat && !r.entreprise && !r.planned) return `${head}Aucune échéance`;
          return head + [series.map((s) => (r[s.key] ? tooltipRow(s.color, s.name, money(r[s.key])) : "")).join(""), r.planned ? tooltipRow(c.ink.faint, "Achats prévus", money(r.planned)) : ""].join("");
        },
      },
      legend: topLegend(c, [...series.map((s) => s.name), ...(hasPlans ? ["Achats prévus"] : [])]),
      grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: ladder.map((r) => label(r.year)), ...axisStyle(c), splitLine: { show: false }, axisLabel: { color: c.ink.faint, hideOverlap: true, lineHeight: 14 } },
      yAxis: { type: "value", ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: money } },
      series: [
        ...series.map((s, i) => ({
          name: s.name,
          type: "bar",
          stack: "detenu",
          barMaxWidth: 28,
          data: ladder.map((r) => r[s.key] || null),
          itemStyle: { color: s.color, borderColor: c.ink.surface, borderWidth: 2, borderRadius: i === series.length - 1 ? [4, 4, 0, 0] : 0 },
          ...(i === 0 && retirement
            ? { markLine: { silent: true, symbol: "none", lineStyle: { color: c.ink.muted, type: "dashed", width: 1 }, label: { formatter: "Retraite", color: c.ink.muted, position: "insideEndTop" }, data: [{ xAxis: retirement }] } }
            : {}),
        })),
        ...(hasPlans
          ? [
              {
                name: "Achats prévus",
                type: "bar",
                stack: "detenu",
                barMaxWidth: 28,
                data: ladder.map((r) => r.planned || null),
                itemStyle: { color: "transparent", borderColor: c.ink.faint, borderType: "dashed", borderWidth: 1.5, borderRadius: [4, 4, 0, 0] },
              },
            ]
          : []),
      ],
    };
  }, [ladder, ageOf, retirementYear, c]);

  return (
    <Card>
      <CardTitle hint="Nominal par année d'échéance">Échéancier des remboursements</CardTitle>
      <Chart option={option} height={260} />
    </Card>
  );
}
