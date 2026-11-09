import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { comparableAssetIds, comparePerformance, type EngineData, type HistoryPoint, type PortfolioState } from "@hamac/core";
import { Amount } from "./Amount";
import { Chart, axisStyle, type ChartOption } from "./Chart";
import { Field, Select } from "./form";
import { percentAxis, percentTooltip } from "./PerformanceBlocks";
import { Pct } from "./Stat";
import { Button, Card, CardTitle } from "./ui";
import { ReferenceDialog } from "@/dialogs/ReferenceDialog";
import { COMPARE_COLORS } from "@/lib/colors";
import { capitalize, formatMonth } from "@/lib/numbers";
import { ALL_SCOPE, assetKey, compareSide, findScope, loadCompareChoice, saveCompareChoice, type ScopeOptions } from "@/lib/performance";
import type { useWorkspaceIndex } from "@/lib/workspace";

type Index = NonNullable<ReturnType<typeof useWorkspaceIndex>>;

export function PerformanceCompare({ data, state, history, idx, options, monthsBack }: { data: EngineData; state: PortfolioState; history: readonly HistoryPoint[]; idx: Index; options: ScopeOptions; monthsBack: number | null }) {
  const comparable = useMemo(() => comparableAssetIds(data), [data]);
  const [choice, setChoice] = useState(loadCompareChoice);
  const [adding, setAdding] = useState(false);

  const nameOfAsset = (key: string) => idx.assetById.get(key.slice(6));
  const usable = (key: string | undefined): key is string => !!key && (key.startsWith("asset:") ? nameOfAsset(key)?.archived === false : findScope(options, key) != null);
  // Par défaut, le titre le plus important du portefeuille.
  const heldValue = (assetId: string) => state.accounts.flatMap((a) => a.positions).reduce((t, p) => t + (p.asset.id === assetId ? p.value : 0), 0);
  const largest = [...comparable].sort((a, b) => heldValue(b) - heldValue(a))[0];
  const fallbackRight = largest ? assetKey(largest) : (options.groups[0]?.key ?? ALL_SCOPE);
  const left = usable(choice?.left) ? choice!.left : ALL_SCOPE;
  const right = usable(choice?.right) ? choice!.right : fallbackRight;
  const update = (next: { left: string; right: string }) => {
    setChoice(next);
    saveCompareChoice(next);
  };

  const result = useMemo(() => {
    const l = compareSide(options, left);
    const r = compareSide(options, right);
    return l && r && left !== right ? comparePerformance(data, state, history, l, r, monthsBack) : null;
  }, [data, state, history, options, left, right, monthsBack]);

  const labelOf = (key: string) => (key.startsWith("asset:") ? (nameOfAsset(key)?.name ?? "Titre") : (findScope(options, key)?.label ?? ""));
  const assetKeys = [...new Set([...comparable.map(assetKey), ...[left, right].filter((k) => k.startsWith("asset:"))])].sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
  const choices = (
    <>
      <option value={options.all.key}>{options.all.label}</option>
      <optgroup label="Enveloppes">
        {options.groups.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </optgroup>
      <optgroup label="Comptes">
        {options.accounts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </optgroup>
      {assetKeys.length > 0 && (
        <optgroup label="Titres et références">
          {assetKeys.map((k) => <option key={k} value={k}>{labelOf(k)}</option>)}
        </optgroup>
      )}
    </>
  );

  const option = useMemo<ChartOption | null>(() => {
    if (!result) return null;
    const series = [
      { name: labelOf(left), data: result.left, color: COMPARE_COLORS[0], type: "solid" },
      { name: labelOf(right), data: result.right, color: COMPARE_COLORS[1], type: "dashed" },
    ];
    return {
      tooltip: percentTooltip,
      // La ligne au-dessus du graphique sert de légende, avec le résultat de chacun.
      legend: { show: false },
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: result.months.map((m) => capitalize(formatMonth(m))), ...axisStyle, splitLine: { show: false } },
      yAxis: percentAxis([0, ...result.left, ...result.right]),
      series: series.map((s) => ({ name: s.name, type: "line", data: s.data, showSymbol: false, symbolSize: 8, lineStyle: { width: 2, color: s.color, type: s.type }, itemStyle: { color: s.color } })),
    };
  }, [result, left, right, options, idx]);

  return (
    <Card>
      <CardTitle hint={result ? `depuis ${formatMonth(result.months[0]!)}` : undefined}>Comparer</CardTitle>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Field label="Ce que je compare">{(id) => <Select id={id} value={left} onChange={(e) => update({ left: e.target.value, right })}>{choices}</Select>}</Field>
        </div>
        <div className="min-w-56 flex-1">
          <Field label="Avec">{(id) => <Select id={id} value={right} onChange={(e) => update({ left, right: e.target.value })}>{choices}</Select>}</Field>
        </div>
        <Button type="button" onClick={() => setAdding(true)}>
          <Plus size={14} /> Ajouter une référence
        </Button>
      </div>

      {left === right && <p className="py-12 text-center text-sm text-fg-muted">Choisissez deux éléments différents.</p>}
      {left !== right && !result && <p className="py-12 text-center text-sm text-fg-muted">Pas encore assez de cours en commun pour comparer. Une référence qu'on vient d'ajouter met quelques instants à charger ses cours.</p>}
      {result && option && (
        <>
          <div className="mb-3 flex flex-wrap gap-x-8 gap-y-1 text-sm text-fg-muted">
            {[{ key: left, rate: result.leftRate, color: COMPARE_COLORS[0] }, { key: right, rate: result.rightRate, color: COMPARE_COLORS[1] }].map((x) => (
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
            Les deux courbes partent de zéro le même mois, le premier où les deux ont des données. Un titre est suivi par son cours : ses dividendes distribués n'y figurent pas.
          </p>
        </>
      )}
      <ReferenceDialog open={adding} assets={idx.ws.assets} onClose={() => setAdding(false)} onAdded={(assetId) => update({ left, right: assetKey(assetId) })} />
    </Card>
  );
}
