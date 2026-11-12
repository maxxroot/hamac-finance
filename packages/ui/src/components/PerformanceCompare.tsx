import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { MarketSeriesInput } from "@hamac/api";
import { comparableAssetIds, comparePerformance, type EngineData, type HistoryPoint, type PortfolioState } from "@hamac/core";
import { Amount } from "./Amount";
import { Chart, axisStyle, type ChartOption } from "./Chart";
import { PeriodSelector } from "./EvolutionChart";
import { Field, Select } from "./form";
import { percentAxis, percentTooltip } from "./PerformanceBlocks";
import { Pct } from "./Stat";
import { Button, Card, CardTitle } from "./ui";
import { ReferenceDialog } from "@/dialogs/ReferenceDialog";
import { useChartColors } from "@/lib/colors";
import { PERIODS, type PeriodKey } from "@/lib/dashboard";
import { capitalize, formatDate, formatMonth } from "@/lib/numbers";
import { ALL_SCOPE, assetKey, compareSide, findScope, groupSections, loadCompareChoice, ownedAssetIds, referenceKey, saveCompareChoice, seriesRequest, withReference, type CompareChoice, type Reference, type ScopeOptions } from "@/lib/performance";
import { call } from "@/lib/transport";
import type { useWorkspaceIndex } from "@/lib/workspace";

type Index = NonNullable<ReturnType<typeof useWorkspaceIndex>>;
type Side = "left" | "right";

/** L'historique change au plus deux fois par jour côté serveur. */
const useSeries = (request: MarketSeriesInput | null) => useQuery({ queryKey: ["market.series", request], queryFn: () => call("market.series", request!), enabled: request != null, staleTime: 6 * 3_600_000, retry: false });

export function PerformanceCompare({ data, state, history, idx, options }: { data: EngineData; state: PortfolioState; history: readonly HistoryPoint[]; idx: Index; options: ScopeOptions }) {
  const c = useChartColors();
  const comparable = useMemo(() => {
    const owned = ownedAssetIds(data);
    return comparableAssetIds(data).filter((id) => owned.has(id));
  }, [data]);
  const [choice, setChoice] = useState(loadCompareChoice);
  const [searching, setSearching] = useState<Side | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("Tout");
  const monthsBack = PERIODS.find((p) => p.key === period)?.months ?? null;
  const references = choice?.references ?? [];

  const assetOf = (id: string) => idx.assetById.get(id);
  const referenceOf = (key: string) => references.find((r) => referenceKey(r) === key);
  const usable = (key: string | undefined): key is string => {
    if (!key) return false;
    if (key.startsWith("ref:")) return referenceOf(key) != null;
    if (key.startsWith("asset:")) return comparable.includes(key.slice(6)) && assetOf(key.slice(6))?.archived === false;
    return findScope(options, key) != null;
  };
  // Par défaut, le titre le plus important du portefeuille.
  const heldValue = (assetId: string) => state.accounts.flatMap((a) => a.positions).reduce((t, p) => t + (p.asset.id === assetId ? p.value : 0), 0);
  const largest = [...comparable].sort((a, b) => heldValue(b) - heldValue(a))[0];
  const fallbackRight = largest ? assetKey(largest) : (options.groups[0]?.key ?? ALL_SCOPE);
  const left = usable(choice?.left) ? choice!.left : ALL_SCOPE;
  const right = usable(choice?.right) ? choice!.right : fallbackRight;
  const update = (next: Partial<CompareChoice>) => {
    const merged: CompareChoice = { left, right, references, ...next };
    setChoice(merged);
    saveCompareChoice(merged);
  };
  const pick = (side: Side, reference: Reference) => update({ [side]: referenceKey(reference), references: withReference(references, reference) });

  const leftSeries = useSeries(seriesRequest(left, references, assetOf));
  const rightSeries = useSeries(seriesRequest(right, references, assetOf));
  const loading = leftSeries.isLoading || rightSeries.isLoading;

  const result = useMemo(() => {
    if (left === right || leftSeries.isLoading || rightSeries.isLoading) return null;
    const l = compareSide(options, left, leftSeries.data);
    const r = compareSide(options, right, rightSeries.data);
    return l && r ? comparePerformance(data, state, history, l, r, monthsBack) : null;
  }, [data, state, history, options, left, right, monthsBack, leftSeries.data, rightSeries.data, leftSeries.isLoading, rightSeries.isLoading]);

  const labelOf = (key: string) => {
    if (key.startsWith("ref:")) return referenceOf(key)?.name ?? "Titre";
    if (key.startsWith("asset:")) return assetOf(key.slice(6))?.name ?? "Titre";
    return findScope(options, key)?.label ?? "";
  };
  const dateLabel = (d: string) => (result?.daily ? formatDate(d) : capitalize(formatMonth(d)));

  const assetKeys = comparable.map(assetKey).sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
  const choices = (
    <>
      <option value={options.all.key}>{options.all.label}</option>
      {groupSections(options).map((s) => (
        <optgroup key={s.label} label={s.label}>
          {s.options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </optgroup>
      ))}
      <optgroup label="Comptes et contrats">
        {options.accounts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </optgroup>
      {assetKeys.length > 0 && (
        <optgroup label="Mes titres">
          {assetKeys.map((k) => <option key={k} value={k}>{labelOf(k)}</option>)}
        </optgroup>
      )}
      {references.length > 0 && (
        <optgroup label="Titres recherchés">
          {references.map((r) => <option key={referenceKey(r)} value={referenceKey(r)}>{r.name}</option>)}
        </optgroup>
      )}
    </>
  );

  const option = useMemo<ChartOption | null>(() => {
    if (!result) return null;
    const series = [
      { name: labelOf(left), data: result.left, color: c.compare[0], type: "solid" },
      { name: labelOf(right), data: result.right, color: c.compare[1], type: "dashed" },
    ];
    return {
      tooltip: percentTooltip(c),
      // La ligne au-dessus du graphique sert de légende, avec le résultat de chacun.
      legend: { show: false },
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: result.dates.map(dateLabel), ...axisStyle(c), splitLine: { show: false } },
      yAxis: percentAxis(c, [0, ...result.left, ...result.right]),
      series: series.map((s) => ({ name: s.name, type: "line", data: s.data, showSymbol: false, symbolSize: 8, lineStyle: { width: 2, color: s.color, type: s.type }, itemStyle: { color: s.color } })),
    };
  }, [result, left, right, options, idx, references, c]);

  const sides = [
    { key: left, series: leftSeries },
    { key: right, series: rightSeries },
  ];
  const failures = sides.filter((s) => s.series.isError && s.key.startsWith("ref:"));
  const titles = sides.filter((s) => s.key.startsWith("ref:") || s.key.startsWith("asset:"));
  const priceOnly = titles.filter((s) => !s.series.data?.dividends).map((s) => labelOf(s.key));
  const withDividends = titles.length > priceOnly.length;

  const picker = (side: Side, label: string, value: string): ReactNode => (
    <div className="min-w-56 flex-1">
      <Field label={label}>
        {(id) => (
          <div className="flex gap-2">
            <Select id={id} value={value} onChange={(e) => update({ [side]: e.target.value })}>
              {choices}
            </Select>
            <Button type="button" className="shrink-0" aria-label={`Rechercher un titre : ${label}`} title="Rechercher un ETF, une action, une crypto…" onClick={() => setSearching(side)}>
              <Search size={14} />
            </Button>
          </div>
        )}
      </Field>
    </div>
  );

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardTitle hint={result ? `depuis ${dateLabel(result.dates[0]!)}` : undefined}>Comparer</CardTitle>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {picker("left", "Ce que je compare", left)}
        {picker("right", "Avec", right)}
      </div>

      {left === right && <p className="py-12 text-center text-sm text-fg-muted">Choisissez deux éléments différents.</p>}
      {left !== right && loading && <p className="py-12 text-center text-sm text-fg-muted">Chargement des cours…</p>}
      {left !== right && !loading && failures.map((s) => (
        <p key={s.key} className="py-2 text-center text-sm text-negative">
          Cours indisponibles pour {labelOf(s.key)} : {(s.series.error as Error).message}
        </p>
      ))}
      {left !== right && !loading && !result && failures.length === 0 && <p className="py-12 text-center text-sm text-fg-muted">Pas assez de cours en commun sur cette période pour comparer.</p>}
      {result && option && (
        <>
          <div className="mb-3 flex flex-wrap gap-x-8 gap-y-1 text-sm text-fg-muted">
            {[{ key: left, rate: result.leftRate, color: c.compare[0] }, { key: right, rate: result.rightRate, color: c.compare[1] }].map((x) => (
              <span key={x.key}>
                <span className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: x.color }} aria-hidden />
                {labelOf(x.key)} : <b><Pct value={x.rate} signed /></b>
              </span>
            ))}
          </div>
          <Chart option={option} height={280} />
          {result.whatIf && (
            <p className="mt-3 rounded-lg bg-surface-2 px-4 py-3 text-sm text-fg-muted">
              Les mêmes versements placés sur <b className="text-fg">{labelOf(right)}</b> auraient donné <b className="text-fg"><Amount value={result.whatIf.simulated} /></b> au lieu de <b className="text-fg"><Amount value={result.whatIf.actual} /></b>
              , soit <b><Amount value={result.whatIf.difference} signed /></b>.
            </p>
          )}
          <p className="mt-2 text-xs text-fg-faint">
            Les deux courbes partent de zéro à la même date, la première où les deux ont des données.
            {withDividends && " Les dividendes des ETF sont comptés comme s'ils étaient réinvestis."}
            {priceOnly.length > 0 && ` ${priceOnly.join(" et ")} : cours seul, sans les dividendes distribués.`}
          </p>
        </>
      )}
      <ReferenceDialog open={searching != null} onClose={() => setSearching(null)} onPick={(r) => searching && pick(searching, r)} />
    </Card>
  );
}
