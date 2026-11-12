import { Fragment, useMemo, useState } from "react";
import { type MonthPerformance, type PeriodFigures, type YearPerformance } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Chart, axisStyle, type ChartOption } from "@/shared/components/Chart";
import { Select } from "@/shared/components/form";
import { Pct } from "@/shared/components/Stat";
import { ExpandButton, Table, Td, Th, Tr, useExpandedRow } from "@/shared/components/table";
import { Card, CardTitle } from "@/shared/components/ui";
import { useChartColors } from "@/shared/lib/colors";
import { capitalize, formatMonth } from "@/shared/lib/numbers";
import { MONTH_LABELS } from "./CalendarCard";
import { eurAxisLabel, percentAxis, percentTooltip, Segmented, signedEur, tooltip, UnitToggle, type CurveUnit } from "./_controls";

export type Granularity = "annee" | "mois";

export const GRANULARITY_OPTIONS = [
  ["annee", "Années"],
  ["mois", "Mois"],
] as const;

export type PeriodRow = PeriodFigures & { key: string; label: string; short: string };

/** Une enveloppe, un placement ou un compte, avec ses propres chiffres année par année et mois par mois. */
export interface PeriodPart {
  key: string;
  label: string;
  years: readonly YearPerformance[];
  monthly: readonly MonthPerformance[];
}

export function PeriodCells({ p }: { p: PeriodFigures }) {
  return (
    <>
      <Td align="right"><Amount value={p.startValue} compact /></Td>
      <Td align="right"><Amount value={p.inflow} compact /></Td>
      <Td align="right"><Amount value={p.gain} signed compact /></Td>
      <Td align="right"><Pct value={p.rate} signed /></Td>
      <Td align="right"><Amount value={p.income} compact /></Td>
      <Td align="right"><Amount value={p.fees} compact /></Td>
      <Td align="right"><Amount value={p.endValue} compact /></Td>
    </>
  );
}

/**
 * Chaque année, ou chaque mois d'une année choisie : rendement en %, ou gain en euros
 * (variation de valeur moins l'argent versé). Une ligne se déplie sur ses parts (enveloppes, placements ou comptes),
 * dont les montants s'additionnent : un transfert entre deux parts s'y annule.
 */
export function PeriodsCard({ years, monthly, parts = [] }: { years: readonly YearPerformance[]; monthly: readonly MonthPerformance[]; parts?: readonly PeriodPart[] }) {
  const c = useChartColors();
  const { isOpen, rowProps } = useExpandedRow();
  // Le chiffre de chaque part pour une année (« 2024 ») ou un mois (« 2024-03 ») ; les parts sans activité sont omises.
  const partsOf = (key: string) =>
    parts.flatMap((part) => {
      const f = key.length === 4 ? part.years.find((y) => String(y.year) === key) : part.monthly.find((m) => m.month === key);
      return f ? [{ key: part.key, label: part.label, f }] : [];
    });
  const expandable = parts.length > 1;
  const [unit, setUnit] = useState<CurveUnit>("pct");
  const [granularity, setGranularity] = useState<Granularity>("annee");
  const yearList = useMemo(() => [...years].reverse().map((y) => String(y.year)), [years]);
  const [chosenYear, setChosenYear] = useState<string | null>(null);
  const year = chosenYear != null && yearList.includes(chosenYear) ? chosenYear : (yearList[0] ?? null);
  const byMonth = granularity === "mois";

  // Dans l'ordre du temps, pour le graphique.
  const periods = useMemo<PeriodRow[]>(
    () =>
      byMonth
        ? monthly.filter((m) => m.month.slice(0, 4) === year).map((m) => ({ ...m, key: m.month, label: capitalize(formatMonth(m.month)), short: MONTH_LABELS[+m.month.slice(5, 7) - 1]! }))
        : years.map((y) => ({ ...y, key: String(y.year), label: String(y.year), short: String(y.year) })),
    [byMonth, monthly, years, year],
  );

  const option = useMemo<ChartOption>(() => {
    const eur = unit === "eur";
    const shown = eur ? periods : periods.filter((p) => p.rate != null);
    const values = shown.map((p) => (eur ? p.gain : p.rate!));
    return {
      tooltip: { ...(eur ? tooltip(c, (v) => signedEur(Number(v))) : percentTooltip(c)), axisPointer: { type: "none" } },
      legend: { show: false },
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: shown.map((p) => p.short), ...axisStyle(c), splitLine: { show: false } },
      // Des barres se lisent à leur longueur : l'axe part toujours de zéro.
      yAxis: eur ? { type: "value", scale: false, ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: eurAxisLabel } } : { ...percentAxis(c, [0, ...values]), scale: false },
      series: [
        {
          name: eur ? "Gain" : "Rendement",
          type: "bar",
          barMaxWidth: 36,
          data: values.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? c.polarity.positive : c.polarity.negative, borderRadius: v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } })),
        },
      ],
    };
  }, [periods, c, unit]);
  const rows = [...periods].reverse();
  return (
    <Card>
      <CardTitle
        hint={
          <span className="flex flex-wrap items-center justify-end gap-3">
            {byMonth ? (
              yearList.length > 1 && (
                <Select aria-label="Année affichée" className="h-7 w-auto py-0 text-xs" value={year ?? ""} onChange={(e) => setChosenYear(e.target.value)}>
                  {yearList.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              )
            ) : (
              "toujours sur tout l'historique"
            )}
            <Segmented value={granularity} onChange={setGranularity} options={GRANULARITY_OPTIONS} label="Découpage" />
            {periods.length > 1 && <UnitToggle value={unit} onChange={setUnit} />}
          </span>
        }
      >
        {byMonth ? "Mois par mois" : "Année par année"}
      </CardTitle>
      {periods.length > 1 && <Chart option={option} height={180} className="mb-4" />}
      <Table>
        <thead>
          <tr>
            <Th>{byMonth ? "Mois" : "Année"}</Th>
            <Th align="right">Valeur au début</Th>
            <Th align="right">Argent versé</Th>
            <Th align="right">Gain</Th>
            <Th align="right">Rendement</Th>
            <Th align="right">Dividendes et intérêts</Th>
            <Th align="right">Frais</Th>
            <Th align="right">Valeur à la fin</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <Fragment key={p.key}>
              <Tr {...(expandable ? rowProps(p.key) : {})}>
                <Td className="font-medium whitespace-nowrap">
                  {expandable && <ExpandButton open={isOpen(p.key)} label={p.label} />}
                  {p.label}
                </Td>
                <PeriodCells p={p} />
              </Tr>
              {expandable &&
                isOpen(p.key) &&
                partsOf(p.key).map((x) => (
                  <Tr key={x.key} className="bg-surface-2/40 text-fg-muted">
                    <Td className="pl-9 whitespace-nowrap">{x.label}</Td>
                    <PeriodCells p={x.f} />
                  </Tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
