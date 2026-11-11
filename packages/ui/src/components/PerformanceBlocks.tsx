import { Fragment, useMemo, useState, type CSSProperties } from "react";
import { formatEur, type AssetPerformance, type ClassBreakdown, type CalendarYear, type CurvePoint, type EnvelopePerformance, type GainSources, type MonthStats, type YearPerformance } from "@hamac/core";
import { Amount } from "./Amount";
import { Chart, axisStyle, tooltipStyle, type ChartOption } from "./Chart";
import { Pct } from "./Stat";
import { ExpandButton, Table, Td, Th, Tr, useExpandedRow } from "./table";
import { Card, CardTitle } from "./ui";
import { BUCKET_COLORS, useChartColors, type ChartColors } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { capitalize, formatMonth } from "@/lib/numbers";
import { heatShare, pctText, rankingView } from "@/lib/performance";
import { SortTh, useSortable } from "@/lib/sort";

const tooltip = (c: ChartColors, valueFormatter: (v: unknown) => string) => ({ trigger: "axis", ...tooltipStyle(c), valueFormatter });

/** Graduations en % : une décimale seulement quand les variations sont faibles. */
export function percentAxis(c: ChartColors, values: readonly number[]) {
  const digits = Math.max(...values) - Math.min(...values) < 0.1 ? 1 : 0;
  return { type: "value", scale: true, ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: (v: number) => pctText(v, digits, false) } };
}

export const percentTooltip = (c: ChartColors) => tooltip(c, (v) => pctText(Number(v)));

export type CurveUnit = "pct" | "eur";

const signedEur = (v: number) => `${v > 0.5 ? "+" : ""}${formatEur(v, { compact: true })}`;
const eurAxisLabel = (v: number) => (Math.abs(v) >= 10_000 ? `${Math.round(v / 1000)} k€` : formatEur(v, { compact: true }));

/** Petit sélecteur à deux ou trois choix, dans l'en-tête d'une carte. */
function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: ReadonlyArray<readonly [T, string]>; label: string }) {
  return (
    <span className="flex rounded-md bg-surface-2 p-0.5 text-xs" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)} className={cn("min-w-7 cursor-pointer rounded px-2 py-0.5", value === key ? "bg-surface-3 font-medium text-fg" : "text-fg-muted hover:text-fg")}>
          {text}
        </button>
      ))}
    </span>
  );
}

const UNIT_OPTIONS = [
  ["pct", "%"],
  ["eur", "€"],
] as const;

function UnitToggle({ value, onChange }: { value: CurveUnit; onChange: (u: CurveUnit) => void }) {
  return <Segmented value={value} onChange={onChange} options={UNIT_OPTIONS} label="Unité" />;
}

/**
 * La performance au fil du temps. En % : rendement cumulé, sans l'effet des versements.
 * En € : gain cumulé (variation de valeur moins l'argent versé), qui finit sur le gain affiché en haut de page.
 */
export function CumulativeCard({ curve }: { curve: readonly CurvePoint[] }) {
  const c = useChartColors();
  const [unit, setUnit] = useState<CurveUnit>("pct");
  const option = useMemo<ChartOption>(() => {
    const eur = unit === "eur";
    const values = curve.map((p) => (eur ? p.gain : p.cumulative));
    return {
      tooltip: eur ? tooltip(c, (v) => signedEur(Number(v))) : percentTooltip(c),
      legend: { show: false },
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: curve.map((p) => capitalize(formatMonth(p.month))), ...axisStyle(c), splitLine: { show: false } },
      yAxis: eur ? { type: "value", scale: true, ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: eurAxisLabel } } : percentAxis(c, [0, ...values]),
      series: [{ name: eur ? "Gain cumulé" : "Rendement cumulé", type: "line", data: values, showSymbol: false, symbolSize: 8, lineStyle: { width: 2, color: c.primary }, itemStyle: { color: c.primary }, markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: c.ink.faint, type: "solid", width: 1 }, data: [{ yAxis: 0 }] } }],
    };
  }, [curve, c, unit]);
  return (
    <Card>
      <CardTitle
        hint={
          <span className="flex items-center gap-3">
            {unit === "eur" ? "versements déduits" : "hors versements"}
            <UnitToggle value={unit} onChange={setUnit} />
          </span>
        }
      >
        {unit === "eur" ? "Gain cumulé" : "Rendement cumulé"}
      </CardTitle>
      {curve.length < 2 ? <p className="py-16 text-center text-sm text-fg-muted">La courbe apparaîtra après un mois d'historique.</p> : <Chart option={option} height={300} />}
    </Card>
  );
}

type SourceLine = { key: string; label: string; value: number; rate?: number | null; color?: string };

/** Barres sur une seule échelle : l'axe se place selon la part des montants négatifs. */
function GainBars({ lines }: { lines: readonly SourceLine[] }) {
  const maxPos = Math.max(0, ...lines.map((l) => l.value));
  const maxNeg = Math.max(0, ...lines.map((l) => -l.value));
  const range = maxPos + maxNeg || 1;
  const origin = (maxNeg / range) * 100;
  return (
    <ul className="space-y-3">
      {lines.map((l) => {
        const width = (Math.abs(l.value) / range) * 100;
        return (
          <li key={l.key} className="text-sm">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-fg-muted">
                {l.color && <span className="size-2.5 shrink-0 rounded-sm" style={{ background: l.color }} aria-hidden />}
                <span className="truncate">{l.label}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-3">
                <Amount value={l.value} signed compact />
                {l.rate !== undefined && <span className="w-14 text-right text-xs">{l.rate == null ? <span className="text-fg-faint">—</span> : <Pct value={l.rate} signed />}</span>}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-surface-3" aria-hidden>
              <div className={cn("absolute top-0 h-2", l.value >= 0 ? "rounded-r bg-positive" : "rounded-l bg-negative")} style={{ left: `${l.value >= 0 ? origin : origin - width}%`, width: `${width}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type SourcesView = "classe" | "nature";
const SOURCES_OPTIONS = [
  ["classe", "Par classe"],
  ["nature", "Par nature"],
] as const;

/**
 * D'où vient le gain de la période. Par classe : obligations, actions, crowdlending…, avec le rendement de chacune
 * hors versements. Par nature : plus-values, dividendes, intérêts, frais. Les deux redonnent le gain de la période.
 */
export function SourcesCard({ sources: s, byClass }: { sources: GainSources; byClass: ClassBreakdown }) {
  const [view, setView] = useState<SourcesView>("classe");
  const byNature: SourceLine[] = [
    { key: "unrealized", label: "Plus-values pas encore encaissées", value: s.unrealized },
    { key: "realized", label: "Plus-values encaissées", value: s.realized },
    { key: "dividends", label: "Dividendes", value: s.dividends },
    { key: "interests", label: "Intérêts", value: s.interests },
    { key: "billed", label: "Frais facturés à part", value: -s.billedFees },
    { key: "taxes", label: "Impôts prélevés", value: -s.taxes },
    { key: "other", label: "Corrections et autres", value: s.other },
  ];
  const classLines: SourceLine[] = [
    ...byClass.rows.map((r) => ({ key: r.bucket, label: r.label, value: r.gain, rate: r.rate, color: BUCKET_COLORS[r.bucket] })),
    { key: "charges", label: "Frais facturés à part et impôts", value: byClass.charges },
  ];
  const lines = (view === "classe" ? classLines : byNature).filter((l) => Math.abs(l.value) >= 0.005 || (view === "classe" && l.key !== "charges"));
  return (
    <Card>
      <CardTitle hint={<Segmented value={view} onChange={setView} options={SOURCES_OPTIONS} label="Répartir le gain" />}>D'où vient le gain</CardTitle>
      {view === "classe" && byClass.rows.length > 0 && (
        <p className="-mt-2 mb-3 flex justify-end gap-3 text-xs text-fg-faint">
          <span>gain</span>
          <span className="w-14 text-right">rendement</span>
        </p>
      )}
      {lines.length === 0 ? <p className="py-16 text-center text-sm text-fg-muted">Rien sur cette période.</p> : <GainBars lines={lines} />}
      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3 text-sm font-medium">
        <span>Gain de la période</span>
        <Amount value={s.total} signed compact />
      </div>
      {view === "classe" ? (
        <p className="mt-2 text-xs text-fg-faint">Rendement de chaque classe sur la période, sans l'effet de l'argent ajouté. Les espèces d'un compte comptent dans sa classe, comme dans la répartition.</p>
      ) : (
        s.embeddedFees > 0.005 && (
          <p className="mt-2 text-xs text-fg-faint">
            Les frais compris dans les achats et les ventes (<Amount value={s.embeddedFees} compact />) pèsent déjà sur les plus-values.
          </p>
        )
      )}
    </Card>
  );
}

/** Chaque année : rendement en %, ou gain en euros (variation de valeur moins l'argent versé). */
export function YearsCard({ years }: { years: readonly YearPerformance[] }) {
  const c = useChartColors();
  const [unit, setUnit] = useState<CurveUnit>("pct");
  const option = useMemo<ChartOption>(() => {
    const eur = unit === "eur";
    const shown = eur ? years : years.filter((y) => y.rate != null);
    const values = shown.map((y) => (eur ? y.gain : y.rate!));
    return {
      tooltip: { ...(eur ? tooltip(c, (v) => signedEur(Number(v))) : percentTooltip(c)), axisPointer: { type: "none" } },
      legend: { show: false },
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: shown.map((y) => String(y.year)), ...axisStyle(c), splitLine: { show: false } },
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
  }, [years, c, unit]);
  const rows = [...years].reverse();
  return (
    <Card>
      <CardTitle
        hint={
          <span className="flex items-center gap-3">
            toujours sur tout l'historique
            {years.length > 1 && <UnitToggle value={unit} onChange={setUnit} />}
          </span>
        }
      >
        Année par année
      </CardTitle>
      {years.length > 1 && <Chart option={option} height={180} className="mb-4" />}
      <Table>
        <thead>
          <tr>
            <Th>Année</Th>
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
          {rows.map((y) => (
            <Tr key={y.year}>
              <Td className="font-medium">{y.year}</Td>
              <Td align="right"><Amount value={y.startValue} compact /></Td>
              <Td align="right"><Amount value={y.inflow} compact /></Td>
              <Td align="right"><Amount value={y.gain} signed compact /></Td>
              <Td align="right"><Pct value={y.rate} signed /></Td>
              <Td align="right"><Amount value={y.income} compact /></Td>
              <Td align="right"><Amount value={y.fees} compact /></Td>
              <Td align="right" className="font-medium"><Amount value={y.endValue} compact /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function heatStyle(rate: number): CSSProperties | undefined {
  if (Math.abs(rate) < 0.0005) return undefined;
  return { backgroundColor: `color-mix(in srgb, var(--color-${rate > 0 ? "positive" : "negative"}) ${heatShare(rate)}%, transparent)` };
}

const monthLabel = (m: string) => capitalize(formatMonth(m));

export function CalendarCard({ calendar, stats }: { calendar: readonly CalendarYear[]; stats: MonthStats | null }) {
  return (
    <Card>
      <CardTitle hint="toujours sur tout l'historique">Calendrier des mois</CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Année</Th>
            {MONTH_LABELS.map((m) => (
              <Th key={m} align="center" className="px-1">{m}</Th>
            ))}
            <Th align="right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {[...calendar].reverse().map((y) => (
            <tr key={y.year}>
              <Td className="font-medium">{y.year}</Td>
              {y.months.map((r, i) => (
                <td key={i} className="num border border-surface px-1 py-1.5 text-center text-xs" style={r == null ? undefined : heatStyle(r)} title={r == null ? undefined : `${MONTH_LABELS[i]} ${y.year} : ${pctText(r)}`}>
                  {r == null ? <span className="text-fg-faint">·</span> : (r * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: "exceptZero" })}
                </td>
              ))}
              <Td align="right"><Pct value={y.rate} signed /></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {stats && (
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-muted">
          <span>Meilleur mois : <b className="text-fg">{monthLabel(stats.best.month)}</b> ({pctText(stats.best.rate)})</span>
          <span>Pire mois : <b className="text-fg">{monthLabel(stats.worst.month)}</b> ({pctText(stats.worst.rate)})</span>
          <span><b className="text-fg">{stats.positive}</b> mois positifs sur {stats.counted}</span>
        </p>
      )}
    </Card>
  );
}

function RankList({ title, rows, nameOf }: { title?: string; rows: readonly AssetPerformance[]; nameOf: (id: string) => string }) {
  return (
    <div className="min-w-0">
      {title && <h3 className="mb-2 text-xs font-medium text-fg-faint">{title}</h3>}
      <ul className="divide-y divide-line/60 text-sm">
        {rows.map((r) => (
          <li key={r.assetId} className="flex items-baseline justify-between gap-3 py-2">
            <span className="min-w-0 truncate" title={nameOf(r.assetId)}>{nameOf(r.assetId)}</span>
            <span className="flex shrink-0 items-baseline gap-3">
              <Amount value={r.gain} signed compact />
              <span className="w-16 text-right text-xs"><Pct value={r.rate} signed /></span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RankingCard({ rows, nameOf }: { rows: readonly AssetPerformance[]; nameOf: (id: string) => string }) {
  const { best, worst } = rankingView(rows);
  return (
    <Card>
      <CardTitle hint="dividendes compris">Classement des titres</CardTitle>
      {rows.length === 0 && <p className="py-16 text-center text-sm text-fg-muted">Aucun titre sur cette période.</p>}
      <div className="space-y-5">
        {best.length > 0 && <RankList title={worst.length ? "Les meilleurs" : undefined} rows={best} nameOf={nameOf} />}
        {worst.length > 0 && <RankList title="Les moins bons" rows={worst} nameOf={nameOf} />}
      </div>
    </Card>
  );
}

function EnvelopeCells({ r, wholeHistory }: { r: EnvelopePerformance; wholeHistory: boolean }) {
  return (
    <>
      <Td align="right"><Amount value={r.value} /></Td>
      <Td align="right"><Amount value={r.inflow} /></Td>
      <Td align="right"><Amount value={r.gain} signed /></Td>
      <Td align="right"><Pct value={r.gainPct} signed /></Td>
      <Td align="right" title={r.annualizedReason ?? undefined}>
        {r.annualized != null ? <Pct value={r.annualized} signed /> : <span className="text-xs text-fg-faint">{r.annualizedReason}</span>}
      </Td>
      <Td align="right">{r.assumption != null ? <Pct value={r.assumption} /> : "—"}</Td>
      <Td align="right">{r.annualized != null && r.assumption != null ? <Pct value={r.annualized - r.assumption} signed /> : "—"}</Td>
      {wholeHistory && <Td align="right"><Amount value={r.afterTax} signed /></Td>}
    </>
  );
}

export function EnvelopeTable({ rows, wholeHistory }: { rows: readonly EnvelopePerformance[]; wholeHistory: boolean }) {
  const total = rows.find((r) => r.key === "total");
  const { isOpen, rowProps } = useExpandedRow();
  const { sorted, by } = useSortable(
    rows.filter((r) => r.key !== "total"),
    {
      label: (r) => r.label,
      value: (r) => r.value,
      net: (r) => r.inflow,
      gain: (r) => r.gain,
      gainPct: (r) => r.gainPct,
      irr: (r) => r.annualized,
      hyp: (r) => r.assumption,
      ecart: (r) => (r.annualized != null && r.assumption != null ? r.annualized - r.assumption : null),
      tax: (r) => r.afterTax,
    },
  );
  return (
    <Table>
      <thead>
        <tr>
          <SortTh {...by("label")}>Enveloppe</SortTh>
          <SortTh {...by("value")} align="right">Valeur</SortTh>
          <SortTh {...by("net")} align="right">{wholeHistory ? "Montant investi" : "Versé sur la période"}</SortTh>
          <SortTh {...by("gain")} align="right">Gain (€)</SortTh>
          <SortTh {...by("gainPct")} align="right">Gain (%)</SortTh>
          <SortTh {...by("irr")} align="right">Rendement annualisé</SortTh>
          <SortTh {...by("hyp")} align="right">Hypothèse du plan</SortTh>
          <SortTh {...by("ecart")} align="right">Écart</SortTh>
          {wholeHistory && <SortTh {...by("tax")} align="right">Gain après impôts</SortTh>}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <Fragment key={r.key}>
            <Tr {...rowProps(r.key)}>
              <Td className="font-medium whitespace-nowrap">
                <ExpandButton open={isOpen(r.key)} label={r.label} />
                {r.label}
              </Td>
              <EnvelopeCells r={r} wholeHistory={wholeHistory} />
            </Tr>
            {isOpen(r.key) &&
              r.accounts.map((a) => (
                <Tr key={a.key} className="bg-surface-2/40 text-fg-muted">
                  <Td className="pl-9 whitespace-nowrap">{a.label}</Td>
                  <EnvelopeCells r={a} wholeHistory={wholeHistory} />
                </Tr>
              ))}
          </Fragment>
        ))}
        {total && (
          <Tr className="bg-surface-2/60 font-medium">
            <Td>{total.label}</Td>
            <EnvelopeCells r={total} wholeHistory={wholeHistory} />
          </Tr>
        )}
      </tbody>
    </Table>
  );
}
