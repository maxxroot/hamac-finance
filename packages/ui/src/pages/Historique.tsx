import { useMemo, useState } from "react";
import { BUCKET_LABELS, BUCKETS, formatEur } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Chart, axisStyle, type ChartOption } from "@/components/Chart";
import { Table, Td, Th, Tr } from "@/components/table";
import { Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { BUCKET_COLORS, INK } from "@/lib/colors";
import { capitalize, formatMonth } from "@/lib/numbers";
import { useHistory } from "@/lib/portfolio";
import { useWorkspaceIndex } from "@/lib/workspace";

const eurAxis = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} k€` : `${v} €`);
const tooltipEur = (v: unknown) => formatEur(Number(v), { compact: true });

export function Historique() {
  const idx = useWorkspaceIndex();
  const history = useHistory();
  const [showTable, setShowTable] = useState(false);

  const charts = useMemo(() => {
    if (!history?.length) return null;
    const months = history.map((h) => capitalize(formatMonth(h.month)));
    const line: ChartOption = {
      tooltip: { trigger: "axis", backgroundColor: INK.surface2, borderColor: INK.line, textStyle: { color: INK.fg }, valueFormatter: tooltipEur },
      xAxis: { type: "category", data: months, boundaryGap: false, ...axisStyle, splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle, axisLabel: { color: INK.faint, formatter: eurAxis } },
      series: [
        { name: "Patrimoine", type: "line", data: history.map((h) => h.value), showSymbol: false, symbolSize: 8, lineStyle: { width: 2, color: INK.accent }, itemStyle: { color: INK.accent } },
        { name: "Versé net", type: "line", data: history.map((h) => h.netContrib), showSymbol: false, symbolSize: 8, lineStyle: { width: 2, type: "dashed", color: INK.muted }, itemStyle: { color: INK.muted } },
      ],
    };
    const used = BUCKETS.filter((b) => history.some((h) => h.buckets[b] !== 0));
    const area: ChartOption = {
      tooltip: { trigger: "axis", backgroundColor: INK.surface2, borderColor: INK.line, textStyle: { color: INK.fg }, valueFormatter: tooltipEur },
      xAxis: { type: "category", data: months, boundaryGap: false, ...axisStyle, splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle, axisLabel: { color: INK.faint, formatter: eurAxis } },
      series: used.map((b) => ({
        name: BUCKET_LABELS[b],
        type: "line",
        stack: "total",
        data: history.map((h) => Math.max(0, h.buckets[b])),
        showSymbol: false,
        lineStyle: { width: 2, color: INK.surface },
        areaStyle: { color: BUCKET_COLORS[b], opacity: 0.9 },
        itemStyle: { color: BUCKET_COLORS[b] },
      })),
    };
    return { line, area };
  }, [history]);

  if (!idx || !history) return null;
  if (idx.ws.accounts.length === 0) return <Onboarding />;

  return (
    <>
      <PageHeader
        title="Historique"
        description="Reconstruit chaque mois à partir du journal et des cours connus : rien à photographier, et une correction du passé se répercute partout."
        actions={<Button onClick={() => setShowTable((v) => !v)}>{showTable ? "Masquer le tableau" : "Voir le tableau"}</Button>}
      />
      {charts && (
        <div className="mb-6 grid gap-5 xl:grid-cols-2">
          <Card>
            <CardTitle>Valeur du patrimoine et argent versé</CardTitle>
            <Chart option={charts.line} height={300} />
          </Card>
          <Card>
            <CardTitle>Répartition par poche dans le temps</CardTitle>
            <Chart option={charts.area} height={300} />
          </Card>
        </div>
      )}
      {showTable && (
        <Table>
          <thead>
            <tr>
              <Th>Mois</Th>
              {BUCKETS.map((b) => (
                <Th key={b} align="right">
                  {BUCKET_LABELS[b]}
                </Th>
              ))}
              <Th align="right">Total</Th>
              <Th align="right">Versé net</Th>
              <Th align="right">Gain</Th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((h) => (
              <Tr key={h.month}>
                <Td>{capitalize(formatMonth(h.month))}</Td>
                {BUCKETS.map((b) => (
                  <Td key={b} align="right">
                    <Amount value={h.buckets[b]} compact />
                  </Td>
                ))}
                <Td align="right" className="font-medium">
                  <Amount value={h.value} compact />
                </Td>
                <Td align="right">
                  <Amount value={h.netContrib} compact />
                </Td>
                <Td align="right">
                  <Amount value={h.gain} signed compact />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="mt-4 text-xs text-fg-faint">Les mois passés sont valorisés avec le dernier cours connu à leur date ; sans cours, au prix de revient. L'historique des cours se complète automatiquement avec les cours en direct.</p>
    </>
  );
}
