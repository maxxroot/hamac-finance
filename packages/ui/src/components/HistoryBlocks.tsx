import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import {
  BUCKET_LABELS,
  BUCKETS,
  MILESTONE_CATEGORIES,
  MILESTONE_CATEGORY_LABELS,
  POSITION_MOVE_LABELS,
  type AccountChange,
  type BucketChange,
  type HistoryPoint,
  type Milestone,
  type MilestoneCategory,
  type Month,
  type PositionChange,
  type PositionMove,
  type MonthChange,
  type PlanComparison,
  type SnapshotComparison,
  type SnapshotTotals,
  formatEur,
} from "@hamac/core";
import { Amount } from "./Amount";
import { Chart, axisStyle, tooltipStyle, type ChartOption } from "./Chart";
import { Select } from "./form";
import { Pct } from "./Stat";
import { Table, Td, Th, Tr } from "./table";
import { Badge, Button, Card, CardTitle } from "./ui";
import { BUCKET_COLORS, useChartColors } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { barSpan, byYear, chartBars, durationLabel, monthStats, planVerdict, SHORTCUTS, type PeriodSummary, type Range, type ShortcutKey, type Waterfall } from "@/lib/historique";
import { capitalize, formatDate, formatMonth } from "@/lib/numbers";
import { SortTh, useSortable } from "@/lib/sort";

/** Une couleur par famille d'étapes, prise parmi celles des classes d'actifs (validées dans les deux thèmes). */
export const CATEGORY_COLORS: Record<MilestoneCategory, string> = {
  enveloppes: "var(--color-garanti)",
  titres: "var(--color-croissance)",
  paliers: "var(--color-gold)",
  mouvements: "var(--color-precaution)",
  marches: "var(--color-speculatif)",
  immobilier: "var(--color-immobilier)",
};

const dot = (category: MilestoneCategory): CSSProperties => ({ backgroundColor: CATEGORY_COLORS[category] });

// ——— Choix des dates ———

export function RangeControls({ months, range, active, onChange, onShortcut }: { months: readonly Month[]; range: Range; active: ShortcutKey | null; onChange: (r: Range) => void; onShortcut: (k: ShortcutKey) => void }) {
  const last = months.at(-1)!;
  const desc = [...months].reverse();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        Du
        <Select className="w-48" value={range.from ?? ""} onChange={(e) => onChange({ ...range, from: e.target.value || null })}>
          <option value="">Le tout début</option>
          {desc
            .filter((m) => m < range.to)
            .map((m) => (
              <option key={m} value={m}>
                Fin {formatMonth(m)}
              </option>
            ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        Au
        <Select className="w-48" value={range.to} onChange={(e) => onChange({ from: range.from != null && range.from >= e.target.value ? null : range.from, to: e.target.value })}>
          {desc
            .filter((m) => range.from == null || m > range.from)
            .map((m) => (
              <option key={m} value={m}>
                {m === last ? "Aujourd'hui" : `Fin ${formatMonth(m)}`}
              </option>
            ))}
        </Select>
      </label>
      <span className="flex rounded-md bg-surface-2 p-0.5 text-xs" role="group" aria-label="Périodes toutes faites">
        {SHORTCUTS.map((s) => (
          <button key={s.key} type="button" aria-pressed={active === s.key} onClick={() => onShortcut(s.key)} className={cn("rounded px-2.5 py-1", active === s.key ? "bg-surface-3 font-medium text-fg" : "text-fg-muted hover:text-fg")}>
            {s.label}
          </button>
        ))}
      </span>
    </div>
  );
}

export function MilestoneList({ items, total, showAll, onToggleAll, onPick }: { items: readonly Milestone[]; total: number; showAll: boolean; onToggleAll: () => void; onPick: (m: Milestone) => void }) {
  const [hidden, setHidden] = useState<ReadonlySet<MilestoneCategory>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const counts = useMemo(() => {
    const c = new Map<MilestoneCategory, number>();
    for (const m of items) c.set(m.category, (c.get(m.category) ?? 0) + 1);
    return c;
  }, [items]);
  const visible = items.filter((m) => !hidden.has(m.category));
  const LIMIT = 10;
  const cut = expanded ? visible : [...visible].sort((a, b) => b.date.localeCompare(a.date)).slice(0, LIMIT);
  const toggle = (c: MilestoneCategory) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {MILESTONE_CATEGORIES.filter((c) => counts.has(c)).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={!hidden.has(c)}
            onClick={() => toggle(c)}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors", hidden.has(c) ? "border-line text-fg-faint" : "border-line-strong bg-surface-2 text-fg")}
          >
            <span className={cn("size-2 rounded-full", hidden.has(c) && "opacity-40")} style={dot(c)} aria-hidden />
            {MILESTONE_CATEGORY_LABELS[c]}
            <span className="text-fg-faint num">{counts.get(c)}</span>
          </button>
        ))}
        <button type="button" onClick={onToggleAll} className="ml-auto text-xs text-accent hover:underline">
          {showAll ? "Seulement celles de la période" : `Voir toutes les étapes (${total})`}
        </button>
      </div>
      {visible.length === 0 && <p className="py-6 text-center text-sm text-fg-muted">Aucune grande étape sur cette période.</p>}
      <div className="space-y-5">
        {byYear(cut).map((g) => (
          <section key={g.year}>
            <h3 className="mb-2 text-xs font-semibold text-fg-muted num">{g.year}</h3>
            <ol className="space-y-1 border-l border-line pl-4">
              {g.items.map((m) => (
                <li key={m.id} className="relative">
                  <span className="absolute top-3 -left-[1.3rem] size-2 rounded-full ring-2 ring-surface" style={dot(m.category)} aria-hidden />
                  <button type="button" onClick={() => onPick(m)} className="group -mx-2 flex w-full flex-wrap items-baseline gap-x-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2" title="Voir ce qui a changé depuis cette étape">
                    <span className="w-20 shrink-0 text-xs text-fg-faint num">{formatDate(m.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="text-sm text-fg">{m.title}</span>
                      {m.detail && <span className="block text-xs text-fg-muted">{m.detail}</span>}
                    </span>
                    <span className="text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Voir depuis</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {visible.length > LIMIT && (
        <Button variant="ghost" className="mt-3" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Afficher moins" : `Afficher les ${visible.length - LIMIT} autres`}
        </Button>
      )}
    </div>
  );
}

// ——— Résumé de la période ———

const eurText = (v: number) => formatEur(v, { compact: true });
const signedText = (v: number) => `${v > 0.004 ? "+" : ""}${eurText(v)}`;
/** Graduations : « 1,5 k€ » plutôt qu'un arrondi qui ferait lire 2 k€. */
const eurAxis = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€` : `${v} €`);

/** La période en une phrase : de combien le patrimoine a grandi, et d'où ça vient. */
export function SummaryCard({ s, fromStart }: { s: PeriodSummary; fromStart: boolean }) {
  const delta = s.endValue - s.startValue;
  return (
    <Card className="mb-5">
      <p className="font-display text-xl leading-snug text-fg">
        {fromStart ? (
          <>
            Depuis le début, votre patrimoine financier a atteint <Amount value={s.endValue} compact />.
          </>
        ) : (
          <>
            En {durationLabel(s.months)}, votre patrimoine financier est passé de <Amount value={s.startValue} compact /> à <Amount value={s.endValue} compact /> (<Amount value={delta} signed compact />).
          </>
        )}
      </p>
      {s.moneyShare != null ? (
        <div className="mt-4">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <div className="bg-precaution" style={{ width: `${s.moneyShare * 100}%` }} />
            <div className="bg-positive" style={{ width: `${(1 - s.moneyShare) * 100}%` }} />
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-precaution" aria-hidden />
              <span>
                {Math.round(s.moneyShare * 100)} % vient de votre épargne (<Amount value={s.money} compact />)
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-positive" aria-hidden />
              <span>
                {100 - Math.round(s.moneyShare * 100)} % des placements (<Amount value={s.gain} compact />)
              </span>
            </span>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-fg-muted">
          {s.money >= 0 ? <>Vous avez apporté <Amount value={s.money} compact /></> : <>Vous avez retiré <Amount value={-s.money} compact /> de plus que vous n'avez versé</>}
          {" ; "}
          {s.gain >= 0 ? <>les placements ont rapporté <Amount value={s.gain} compact /></> : <>les placements ont fait perdre <Amount value={-s.gain} compact /></>}.
        </p>
      )}
      {s.months > 0 && s.money > 0 && (
        <p className="mt-2 text-sm text-fg-muted">
          <Amount value={s.perMonth} compact className="font-medium text-fg" /> épargnés par mois en moyenne.
        </p>
      )}
    </Card>
  );
}

// ——— Mois par mois ———

export function MonthsCard({ months, monthLabel }: { months: readonly MonthChange[]; monthLabel: (m: Month) => string }) {
  const c = useChartColors();
  const { bars, yearly } = useMemo(() => chartBars(months, monthLabel), [months, monthLabel]);
  const stats = useMemo(() => monthStats(months), [months]);
  const option = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...tooltipStyle(c), valueFormatter: (v: unknown) => signedText(Number(v)) },
      legend: { show: false },
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: bars.map((b) => b.label), ...axisStyle(c), splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: eurAxis } },
      series: [
        { name: "Argent apporté", type: "bar", barMaxWidth: 18, data: bars.map((b) => Math.round(b.money)), itemStyle: { color: c.buckets.precaution, borderRadius: 2 } },
        {
          name: "Gain des placements",
          type: "bar",
          barMaxWidth: 18,
          data: bars.map((b) => ({ value: Math.round(b.gain), itemStyle: { color: b.gain >= 0 ? c.polarity.positive : c.polarity.negative, borderRadius: 2 } })),
        },
      ],
    }),
    [bars, c],
  );
  const named = (list: readonly Month[]) => list.slice(0, 3).map(monthLabel).join(", ") + (list.length > 3 ? "…" : "");
  return (
    <Card>
      <CardTitle
        hint={
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-precaution" aria-hidden />apporté</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-positive" aria-hidden />gain</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-negative" aria-hidden />perte</span>
          </span>
        }
      >
        {yearly ? "Année par année" : "Mois par mois"}
      </CardTitle>
      {months.length === 0 ? <p className="py-16 text-center text-sm text-fg-muted">Aucun mois sur cette période.</p> : <Chart option={option} height={220} />}
      {months.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-fg-muted">
          <li>{stats.empty.length === 0 ? "Un versement chaque mois" : `${stats.empty.length} mois sans versement (${named(stats.empty)})`}</li>
          {stats.best && (
            <li>
              Meilleur mois : <Amount value={stats.best.gain} signed compact /> en {monthLabel(stats.best.month).toLowerCase()}
              {stats.worst && (
                <>
                  {" · "}pire : <Amount value={stats.worst.gain} signed compact /> en {monthLabel(stats.worst.month).toLowerCase()}
                </>
              )}
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

// ——— Par rapport au plan ———

const BUCKET_UNRATED: Partial<Record<string, string>> = { speculatif: "la crypto", crowdlending: "le crowdlending", immobilier: "l'immobilier (SCPI)" };

export function PlanCard({ p, monthLabel }: { p: PlanComparison; monthLabel: (m: Month) => string }) {
  const c = useChartColors();
  const verdict = planVerdict(p);
  const option = useMemo<ChartOption>(
    () => ({
      tooltip: { trigger: "axis", ...tooltipStyle(c), valueFormatter: (v: unknown) => eurText(Number(v)) },
      legend: { show: false },
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: p.path.map((x) => monthLabel(x.month)), ...axisStyle(c), splitLine: { show: false } },
      yAxis: { type: "value", scale: true, ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: eurAxis } },
      series: [
        { name: "Prévu", type: "line", data: p.path.map((x) => x.expected), showSymbol: false, lineStyle: { width: 2, type: "dashed", color: c.ink.muted }, itemStyle: { color: c.ink.muted } },
        { name: "Réel", type: "line", data: p.path.map((x) => x.actual), showSymbol: false, lineStyle: { width: 2, color: c.primary }, itemStyle: { color: c.primary } },
      ],
    }),
    [p, c, monthLabel],
  );
  const unrated = p.unrated.map((b) => BUCKET_UNRATED[b]).filter(Boolean);
  return (
    <Card>
      <CardTitle hint={<Link to="/projection" className="text-accent hover:underline">Régler les rendements attendus</Link>}>Par rapport au plan</CardTitle>
      <p className={cn("font-display text-2xl", verdict === "avance" && "text-positive", verdict === "retard" && "text-negative")}>
        {verdict === "conforme" ? "Dans les clous" : verdict === "avance" ? `En avance de ${eurText(p.gap)}` : `En retard de ${eurText(-p.gap)}`}
      </p>
      <p className="mt-1 text-sm text-fg-muted">
        Prévu : <Amount value={p.expectedEnd} compact /> · réel : <Amount value={p.actualEnd} compact className="text-fg" />
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-fg-muted">
            Épargne <span className="text-xs text-fg-faint">(prévu <Amount value={p.plannedMoney} compact />, apporté <Amount value={p.actualMoney} compact />)</span>
          </dt>
          <dd><Amount value={p.moneyGap} signed compact /></dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-fg-muted">
            Placements <span className="text-xs text-fg-faint">(prévu <Amount value={p.expectedGain} signed compact />, obtenu <Amount value={p.actualGain} signed compact />)</span>
          </dt>
          <dd><Amount value={p.gainGap} signed compact /></dd>
        </div>
      </dl>
      {p.path.length > 1 && (
        <>
          <div className="mt-4 flex gap-4 text-xs text-fg-faint">
            <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-fg-muted" aria-hidden />prévu</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-accent" aria-hidden />réel</span>
          </div>
          <Chart option={option} height={170} />
        </>
      )}
      <p className="mt-2 text-xs text-fg-faint">
        Le plan part de la valeur de départ, fait grandir chaque classe à son rendement attendu et ajoute les versements programmés, avec les réglages actuels.
        {unrated.length > 0 && ` Sans rendement attendu, ${unrated.join(" et ")} ${unrated.length > 1 ? "sont comptés" : "est compté"} sans gain.`}
      </p>
    </Card>
  );
}

// ——— Situation ———

export function SituationCard({ cmp, startLabel, endLabel, withRealEstate }: { cmp: SnapshotComparison; startLabel: string; endLabel: string; withRealEstate: boolean }) {
  // `money` : de l'argent apporté, ni gagné ni perdu, donc sans couleur. `noPct` : un gain en % de lui-même ne veut rien dire.
  const rows: Array<{ label: string; pick: (t: SnapshotTotals) => number; strong?: boolean; inverse?: boolean; money?: boolean; noPct?: boolean }> = [
    { label: "Patrimoine financier", pick: (t) => t.value, strong: !withRealEstate },
    { label: "Argent versé net", pick: (t) => t.netContrib, money: true },
    { label: "Gain", pick: (t) => t.gain, noPct: true },
    ...(withRealEstate
      ? [
          { label: "Biens (part détenue)", pick: (t: SnapshotTotals) => t.realEstate },
          { label: "Crédits restant dus", pick: (t: SnapshotTotals) => t.debts, inverse: true },
          { label: "Patrimoine net", pick: (t: SnapshotTotals) => t.netWorth, strong: true },
        ]
      : []),
  ];
  return (
    <Card>
      <CardTitle>La situation</CardTitle>
      <Table>
        <thead>
          <tr>
            <Th />
            <Th align="right">{startLabel}</Th>
            <Th align="right">{endLabel}</Th>
            <Th align="right">Écart</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const a = cmp.start ? r.pick(cmp.start) : 0;
            const b = r.pick(cmp.end);
            const pct = cmp.start && a > 0 && !r.inverse && !r.noPct ? (b - a) / a : null;
            return (
              <Tr key={r.label}>
                <Td className={cn(r.strong ? "font-semibold" : "text-fg-muted")}>{r.label}</Td>
                <Td align="right"><Amount value={a} compact /></Td>
                <Td align="right" className={cn(r.strong && "font-semibold")}><Amount value={b} compact /></Td>
                <Td align="right">
                  {r.inverse ? (
                    <Amount value={b - a} compact className={cn(b - a < -0.004 && "text-positive", b - a > 0.004 && "text-negative")} />
                  ) : (
                    <Amount value={b - a} signed compact className={cn(r.money && "text-fg")} />
                  )}
                  {pct != null && <span className="ml-1.5 text-xs text-fg-faint"><Pct value={pct} signed /></span>}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

// ——— Cascade ———

const MONEY_HEADING = "Argent apporté ou retiré";
const GAIN_HEADING = "Gain des placements";

export function CascadeCard({ w, scope, scopes, onScope, journalHref, operations }: { w: Waterfall; scope: string; scopes: ReadonlyArray<{ key: string; label: string }>; onScope: (k: string) => void; journalHref: string; operations: number }) {
  let previous: string | null = null;
  return (
    <Card className="flex flex-col xl:self-start">
      <CardTitle
        hint={
          <Select aria-label="Périmètre de la cascade" className="h-8 w-56 text-xs" value={scope} onChange={(e) => onScope(e.target.value)}>
            {scopes.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        }
      >
        Ce qui s'est passé
      </CardTitle>
      <ul className="space-y-2.5">
        {w.rows.map((r) => {
          const heading = r.kind !== "total" && r.kind !== previous ? r.kind : null;
          previous = r.kind;
          const { left, width } = barSpan(r, w);
          const tone = r.kind === "total" ? "bg-fg-faint/45" : r.kind === "money" ? "bg-precaution" : r.value >= 0 ? "bg-positive" : "bg-negative";
          return (
            <li key={r.key} className="text-sm">
              {heading && (
                <div className="mt-4 mb-2 flex items-baseline justify-between border-t border-line pt-3 text-xs font-semibold text-fg-muted">
                  <span>{heading === "money" ? MONEY_HEADING : GAIN_HEADING}</span>
                  <Amount value={heading === "money" ? w.money : w.gain} signed compact />
                </div>
              )}
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className={r.kind === "total" ? "font-medium text-fg" : "text-fg-muted"}>{r.label}</span>
                {r.kind === "total" ? <Amount value={r.value} compact className="font-medium" /> : <Amount value={r.value} signed compact />}
              </div>
              <div className="relative h-2 rounded-full bg-surface-3" aria-hidden>
                <div className={cn("absolute top-0 h-2 rounded-full", tone)} style={{ left: `${left}%`, width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="pt-4 text-xs text-fg-faint">
        {w.zoomed && <p className="mb-1">Échelle resserrée : les barres de départ et d'arrivée ne partent pas de zéro, pour que les écarts restent visibles.</p>}
        <Link to={journalHref} className="text-accent hover:underline">
          Voir {operations > 1 ? `les ${operations} opérations` : operations === 1 ? "l'opération" : "le journal"} de la période
        </Link>
      </div>
    </Card>
  );
}

// ——— Par enveloppe ———

export function AccountsCard({ rows, nameOf, closed }: { rows: readonly AccountChange[]; nameOf: (id: string) => string; closed: (id: string) => boolean }) {
  const { sorted, by } = useSortable(
    rows,
    {
      compte: (a) => nameOf(a.accountId),
      debut: (a) => a.startValue,
      fin: (a) => a.endValue,
      ecart: (a) => a.endValue - a.startValue,
      apport: (a) => a.contribChange,
      gain: (a) => a.gainChange,
    },
    { key: "fin", dir: "desc" },
  );
  const total = (f: (a: AccountChange) => number) => rows.reduce((t, a) => t + f(a), 0);
  return (
    <Card>
      <CardTitle hint="transferts entre enveloppes compris">Enveloppe par enveloppe</CardTitle>
      <Table>
        <thead>
          <tr>
            <SortTh {...by("compte")}>Enveloppe</SortTh>
            <SortTh {...by("debut")} align="right">Au début</SortTh>
            <SortTh {...by("fin")} align="right">À la fin</SortTh>
            <SortTh {...by("apport")} align="right">Argent apporté</SortTh>
            <SortTh {...by("gain")} align="right">Gain</SortTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <Tr key={a.accountId}>
              <Td className="max-w-56">
                <span className="truncate">{nameOf(a.accountId)}</span>
                {closed(a.accountId) && a.endValue === 0 && <span className="ml-2"><Badge>clôturé</Badge></span>}
              </Td>
              <Td align="right"><Amount value={a.startValue} compact /></Td>
              <Td align="right" className="font-medium"><Amount value={a.endValue} compact /></Td>
              <Td align="right"><Amount value={a.contribChange} signed compact className="text-fg" /></Td>
              <Td align="right"><Amount value={a.gainChange} signed compact /></Td>
            </Tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <Td>Total</Td>
            <Td align="right"><Amount value={total((a) => a.startValue)} compact /></Td>
            <Td align="right"><Amount value={total((a) => a.endValue)} compact /></Td>
            <Td align="right"><Amount value={total((a) => a.contribChange)} signed compact className="text-fg" /></Td>
            <Td align="right"><Amount value={total((a) => a.gainChange)} signed compact /></Td>
          </tr>
        </tfoot>
      </Table>
    </Card>
  );
}

// ——— Répartition ———

export function AllocationCompareCard({ rows, startLabel, endLabel }: { rows: readonly BucketChange[]; startLabel: string; endLabel: string }) {
  const ordered = BUCKETS.flatMap((b) => rows.filter((r) => r.bucket === b));
  return (
    <Card>
      <CardTitle
        hint={
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-fg-faint/45" aria-hidden />{startLabel}</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-fg" aria-hidden />{endLabel}</span>
          </span>
        }
      >
        Répartition par classe
      </CardTitle>
      <ul className="space-y-3.5">
        {ordered.map((r) => (
          <li key={r.bucket} className="text-sm">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-fg-muted">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: BUCKET_COLORS[r.bucket] }} aria-hidden />
                {BUCKET_LABELS[r.bucket]}
              </span>
              <span className="text-xs text-fg-faint num">
                <Pct value={r.startShare} digits={0} /> → <span className="font-medium text-fg"><Pct value={r.endShare} digits={0} /></span>
                <span className="ml-2"><Amount value={r.end} compact /></span>
              </span>
            </div>
            <div className="space-y-0.5" aria-hidden>
              <div className="h-1.5 rounded-full opacity-35" style={{ width: `${r.startShare * 100}%`, backgroundColor: BUCKET_COLORS[r.bucket] }} />
              <div className="h-2 rounded-full" style={{ width: `${r.endShare * 100}%`, backgroundColor: BUCKET_COLORS[r.bucket] }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ——— Titres ———

const MOVE_ORDER: readonly PositionMove[] = ["nouveau", "renforce", "allege", "vendu", "inchange"];
const MOVE_TONE: Record<PositionMove, "neutral" | "accent" | null> = { nouveau: "accent", renforce: "accent", allege: "neutral", vendu: "neutral", inchange: null };
/** Singulier et pluriel, pour le résumé au-dessus du tableau. */
const MOVE_COUNT: Record<PositionMove, readonly [string, string]> = {
  nouveau: ["nouveau titre", "nouveaux titres"],
  renforce: ["renforcé", "renforcés"],
  allege: ["allégé", "allégés"],
  vendu: ["vendu en entier", "vendus en entier"],
  inchange: ["inchangé", "inchangés"],
};

export function PositionsCard({ rows, assetName, accountName }: { rows: readonly PositionChange[]; assetName: (id: string) => string; accountName: (id: string) => string }) {
  const [onlyMoved, setOnlyMoved] = useState(true);
  const moved = rows.filter((r) => r.move !== "inchange");
  const shown = onlyMoved && moved.length ? moved : rows;
  const { sorted, by } = useSortable(
    shown,
    {
      mouvement: (p) => MOVE_ORDER.indexOf(p.move),
      titre: (p) => assetName(p.assetId),
      compte: (p) => accountName(p.accountId),
      debut: (p) => p.start?.value ?? 0,
      fin: (p) => p.end?.value ?? 0,
      investi: (p) => (p.end?.cost ?? 0) - (p.start?.cost ?? 0),
    },
    { key: "mouvement", dir: "asc" },
  );
  const counts = MOVE_ORDER.filter((m) => m !== "inchange")
    .map((m) => [m, rows.filter((r) => r.move === m).length] as const)
    .filter(([, n]) => n > 0);
  return (
    <Card>
      <CardTitle
        hint={
          moved.length > 0 && moved.length < rows.length ? (
            <button type="button" className="text-accent hover:underline" onClick={() => setOnlyMoved((v) => !v)}>
              {onlyMoved ? (rows.length - moved.length > 1 ? `Voir aussi les ${rows.length - moved.length} lignes inchangées` : "Voir aussi la ligne inchangée") : "Seulement celles qui ont bougé"}
            </button>
          ) : undefined
        }
      >
        Titres achetés et vendus
      </CardTitle>
      {counts.length > 0 ? (
        <p className="mb-3 text-sm text-fg-muted">{counts.map(([m, n]) => `${n} ${MOVE_COUNT[m][n > 1 ? 1 : 0]}`).join(" · ")}</p>
      ) : (
        <p className="mb-3 text-sm text-fg-muted">Aucun achat ni aucune vente sur la période.</p>
      )}
      <Table>
        <thead>
          <tr>
            <SortTh {...by("titre")}>Titre</SortTh>
            <SortTh {...by("compte")}>Enveloppe</SortTh>
            <SortTh {...by("mouvement")}>Mouvement</SortTh>
            <SortTh {...by("investi")} align="right">Investi en plus</SortTh>
            <SortTh {...by("debut")} align="right">Au début</SortTh>
            <SortTh {...by("fin")} align="right">À la fin</SortTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const tone = MOVE_TONE[p.move];
            const invested = (p.end?.cost ?? 0) - (p.start?.cost ?? 0);
            return (
              <Tr key={`${p.accountId}:${p.assetId}`}>
                <Td className="max-w-64 truncate font-medium">{assetName(p.assetId)}</Td>
                <Td className="max-w-48 truncate text-fg-muted">{accountName(p.accountId)}</Td>
                <Td>{tone ? <Badge tone={tone}>{POSITION_MOVE_LABELS[p.move]}</Badge> : <span className="text-xs text-fg-faint">{POSITION_MOVE_LABELS[p.move]}</span>}</Td>
                <Td align="right">{p.move === "inchange" ? <span className="text-fg-faint">—</span> : <Amount value={invested} signed compact className="text-fg" />}</Td>
                <Td align="right"><Amount value={p.start?.value ?? null} compact /></Td>
                <Td align="right" className="font-medium"><Amount value={p.end?.value ?? null} compact /></Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <p className="mt-2 text-xs text-fg-faint">« Investi en plus » : variation du prix de revient. Une vente partielle le réduit à proportion des parts vendues.</p>
    </Card>
  );
}

// ——— Tableau mois par mois ———

export function MonthlyTable({ history }: { history: readonly HistoryPoint[] }) {
  const reversed = useMemo(() => [...history].reverse(), [history]);
  const withRealEstate = history.some((h) => h.realEstate !== 0 || h.debts !== 0);
  const used = BUCKETS.filter((b) => history.some((h) => h.buckets[b] !== 0));
  const { sorted, by } = useSortable(
    reversed,
    {
      mois: (h) => h.month,
      ...Object.fromEntries(BUCKETS.map((b) => [b, (h: HistoryPoint) => h.buckets[b]])),
      total: (h) => h.value,
      net: (h) => h.netContrib,
      gain: (h) => h.gain,
      gainPct: (h) => (h.netContrib > 0 ? h.gain / h.netContrib : null),
      biens: (h) => h.realEstate,
      credits: (h) => h.debts,
      patrimoineNet: (h) => h.netWorth,
    },
    { key: "mois", dir: "desc" },
  );
  return (
    <Table>
      <thead>
        <tr>
          <SortTh {...by("mois")}>Mois</SortTh>
          {used.map((b) => (
            <SortTh key={b} {...by(b)} align="right">
              {BUCKET_LABELS[b]}
            </SortTh>
          ))}
          <SortTh {...by("total")} align="right">Total</SortTh>
          <SortTh {...by("net")} align="right">Versé net</SortTh>
          <SortTh {...by("gain")} align="right">Gain</SortTh>
          <SortTh {...by("gainPct")} align="right">Gain (%)</SortTh>
          {withRealEstate && (
            <>
              <SortTh {...by("biens")} align="right">Biens</SortTh>
              <SortTh {...by("credits")} align="right">Crédits</SortTh>
              <SortTh {...by("patrimoineNet")} align="right">Patrimoine net</SortTh>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {sorted.map((h) => (
          <Tr key={h.month}>
            <Td>{capitalize(formatMonth(h.month))}</Td>
            {used.map((b) => (
              <Td key={b} align="right">
                <Amount value={h.buckets[b]} compact />
              </Td>
            ))}
            <Td align="right" className="font-medium"><Amount value={h.value} compact /></Td>
            <Td align="right"><Amount value={h.netContrib} compact /></Td>
            <Td align="right"><Amount value={h.gain} signed compact /></Td>
            <Td align="right"><Pct value={h.netContrib > 0 ? h.gain / h.netContrib : null} signed /></Td>
            {withRealEstate && (
              <>
                <Td align="right"><Amount value={h.realEstate} compact /></Td>
                <Td align="right"><Amount value={h.debts} compact /></Td>
                <Td align="right" className="font-medium"><Amount value={h.netWorth} compact /></Td>
              </>
            )}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
