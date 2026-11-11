import { useMemo } from "react";
import { formatEur, loanYears, type Loan, type LoanYear } from "@hamac/core";
import { Amount } from "./Amount";
import { Chart, axisStyle, tooltipStyle, type ChartOption } from "./Chart";
import { EmptyRow, Table, Td, Th, Tr } from "./table";
import { useChartColors } from "@/lib/colors";

const money = (v: number) => formatEur(v, { compact: true });

/** Ordre fixe ; couleurs prises dans la palette des classes, validée pour chaque thème. */
const SERIES = [
  { key: "capital", label: "Capital", color: "precaution" },
  { key: "interest", label: "Intérêts", color: "croissance" },
  { key: "insurance", label: "Assurance", color: "speculatif" },
] as const;

const total = (y: LoanYear) => y.capital + y.interest + y.insurance;

function tooltipRow(color: string, label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;gap:20px"><span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:${color}"></span>${label}</span><b>${value}</b></div>`;
}

/** Ce que coûte le crédit chaque année : capital remboursé, intérêts et assurance. */
export function LoanYearsChart({ loan }: { loan: Loan }) {
  const years = useMemo(() => loanYears(loan), [loan]);
  const c = useChartColors();
  const sum = (key: (typeof SERIES)[number]["key"]) => years.reduce((s, y) => s + y[key], 0);
  const option = useMemo<ChartOption>(() => {
    // Sans assurance, pas de série vide dans la légende ; l'arrondi va au segment du haut.
    const shown = SERIES.filter((s) => years.some((y) => y[s.key] > 0));
    return {
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(c),
        axisPointer: { type: "shadow", shadowStyle: { color: c.ink.line, opacity: 0.45 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const y = years[params[0]!.dataIndex]!;
          return `<div style="margin-bottom:4px;color:${c.ink.muted}">${y.year}</div>${shown.map((s) => tooltipRow(c.buckets[s.color], s.label, money(y[s.key]))).join("")}<div style="margin-top:4px">Total : <b>${money(total(y))}</b></div><div style="color:${c.ink.muted}">Reste dû fin ${y.year} : ${money(y.endBalance)}</div>`;
        },
      },
      legend: { data: shown.map((s) => s.label), top: 0, left: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: c.ink.muted } },
      grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: years.map((y) => String(y.year)), ...axisStyle(c), splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: money } },
      series: shown.map((s, i) => ({
        name: s.label,
        type: "bar",
        stack: "cout",
        barMaxWidth: 28,
        data: years.map((y) => y[s.key]),
        itemStyle: { color: c.buckets[s.color], borderColor: c.ink.surface, borderWidth: 2, borderRadius: i === shown.length - 1 ? [4, 4, 0, 0] : 0 },
      })),
    };
  }, [years, c]);

  return (
    <div className="rounded-lg bg-surface p-4">
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-fg-muted">
        {SERIES.map((s) => (
          <span key={s.key}>
            {s.label} sur toute la durée : <b className="text-fg"><Amount value={sum(s.key)} compact /></b>
          </span>
        ))}
      </div>
      <Chart option={option} height={280} />
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-accent">Voir le détail par année</summary>
        <Table className="mt-2">
          <thead>
            <tr>
              <Th>Année</Th>
              {SERIES.map((s) => (
                <Th key={s.key} align="right">
                  {s.label}
                </Th>
              ))}
              <Th align="right">Total payé</Th>
              <Th align="right">Reste dû en fin d'année</Th>
            </tr>
          </thead>
          <tbody>
            {years.length === 0 && <EmptyRow cols={6}>Aucune échéance.</EmptyRow>}
            {years.map((y) => (
              <Tr key={y.year}>
                <Td>{y.year}</Td>
                {SERIES.map((s) => (
                  <Td key={s.key} align="right">
                    <Amount value={y[s.key]} />
                  </Td>
                ))}
                <Td align="right">
                  <Amount value={total(y)} />
                </Td>
                <Td align="right">
                  <Amount value={y.endBalance} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </details>
    </div>
  );
}
