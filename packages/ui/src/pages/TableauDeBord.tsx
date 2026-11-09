import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { computeAlerts, formatEur, isRetirementPlan, retirementYear, type Alert, type HistoryPoint, type PlanParams, type PortfolioState } from "@hamac/core";
import { AlertList } from "@/components/Alerts";
import { Amount } from "@/components/Amount";
import { Chart, axisStyle, type ChartOption } from "@/components/Chart";
import { Pct, Stat } from "@/components/Stat";
import { Badge, Card, CardTitle } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { BUCKET_COLORS, INK } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { allocationBars, alertsToReview, axisFloor, envelopeRows, gainBand, gainSinceLastMonth, historyForPeriod, PERIODS, type PeriodKey } from "@/lib/dashboard";
import { capitalize, formatMonth } from "@/lib/numbers";
import { useHistory, usePortfolio } from "@/lib/portfolio";
import { useProjection } from "@/lib/projection";

const ACTION = { renforcer: "Renforcer", alleger: "Alléger" } as const;
const MAX_ALERTS = 5;

export function TableauDeBord() {
  const pf = usePortfolio();
  // Gestion de patrimoine : pas de projection de retraite (ni calcul, ni carte).
  const retraite = pf ? isRetirementPlan(pf.data.params) : true;
  const proj = useProjection(null, retraite);
  const history = useHistory();
  const alerts = useMemo(() => (pf ? computeAlerts(pf.data, pf.state, { priceErrors: pf.idx.ws.priceStatus?.errors }) : []), [pf]);

  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const { state, data } = pf;
  const p = data.params;
  const ry = retirementYear(p);
  const yearsLeft = Math.max(0, ry - +pf.today.slice(0, 4));
  const total = state.performance.find((r) => r.key === "total");
  const hasRealEstate = state.netWorth.realEstate !== 0 || state.netWorth.debts !== 0;
  const change = history ? gainSinceLastMonth(history) : null;
  const middle = retraite && proj ? <RetirementCard proj={proj} p={p} /> : !retraite && hasRealEstate ? <NetWorthCard netWorth={state.netWorth} /> : null;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {retraite ? (
            <>
              {state.age} ans · départ visé à {p.profile.retirementAge} ans ({ry}) · {yearsLeft} an{yearsLeft > 1 ? "s" : ""} de versements restants
            </>
          ) : (
            "Gestion de patrimoine"
          )}
        </p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Stat
          label={hasRealEstate ? "Patrimoine net" : "Patrimoine financier"}
          className="col-span-2"
          sub={
            <>
              {hasRealEstate ? (
                <span className="flex flex-wrap gap-x-1.5">
                  <span className="whitespace-nowrap">
                    financier <Amount value={state.netWorth.financial} compact /> ·
                  </span>
                  <span className="whitespace-nowrap">
                    immobilier <Amount value={state.netWorth.realEstate} compact /> ·
                  </span>
                  <span className="whitespace-nowrap">
                    crédits <Amount value={-state.netWorth.debts} compact />
                  </span>
                </span>
              ) : (
                <span className="block">
                  précaution <Amount value={state.buckets.precaution} compact /> · investi <Amount value={state.totals.value - state.buckets.precaution} compact />
                </span>
              )}
              {change && (
                <span className="mt-0.5 block">
                  <Amount value={change.gain} signed compact /> de gain depuis fin {formatMonth(change.since)}
                </span>
              )}
            </>
          }
        >
          <span className="text-3xl">
            <Amount value={hasRealEstate ? state.netWorth.net : state.totals.value} compact />
          </span>
        </Stat>
        <Stat label="Versé net">
          <Amount value={state.totals.netContrib} compact />
        </Stat>
        <Stat label="Gain / perte" sub={<Pct value={state.totals.netContrib > 0 ? state.totals.gain / state.totals.netContrib : null} signed />}>
          <Amount value={state.totals.gain} signed compact />
        </Stat>
        <Stat label="Rendement annualisé" sub={total?.irr == null ? total?.irrReason : "depuis le départ"}>
          {total?.irr != null ? <Pct value={total.irr} signed /> : "—"}
        </Stat>
        <Stat label="Épargne par mois">
          <Amount value={state.totals.monthly} compact />
        </Stat>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-5">
        <EvolutionCard history={history} />
        <AllocationCard allocation={state.allocation} />
      </div>

      <div className={cn("grid gap-5", middle ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        <EnvelopesCard accounts={state.accounts} />
        {middle}
        <ReviewCard alerts={alerts} />
      </div>
    </>
  );
}

const money = (v: number) => formatEur(v, { compact: true });

function legendRow(color: string, label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;gap:20px"><span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:${color}"></span>${label}</span><b>${value}</b></div>`;
}

/** Patrimoine et argent versé : l'écart entre les deux courbes, coloré, est le gain ou la perte. */
function EvolutionCard({ history }: { history: HistoryPoint[] | null }) {
  const [period, setPeriod] = useState<PeriodKey>("1A");
  const option = useMemo<ChartOption | null>(() => {
    if (!history || history.length < 2) return null;
    const points = historyForPeriod(history, period);
    const { base, band } = gainBand(points);
    const helper = { type: "line", stack: "gain", silent: true, showSymbol: false, lineStyle: { opacity: 0 }, emphasis: { disabled: true } } as const;
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: INK.surface2,
        borderColor: INK.line,
        textStyle: { color: INK.fg, fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: INK.faint, width: 1 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const h = points[params[0]!.dataIndex]!;
          return `<div style="margin-bottom:4px;color:${INK.muted}">${capitalize(formatMonth(h.month))}</div>${legendRow(INK.accent, "Patrimoine", money(h.value))}${legendRow(INK.muted, "Versé net", money(h.netContrib))}<div style="margin-top:4px">${h.gain >= 0 ? "Gain" : "Perte"} : <b>${money(Math.abs(h.gain))}</b></div>`;
        },
      },
      legend: { data: ["Patrimoine", "Versé net"], top: 0, left: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: INK.muted } },
      grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: points.map((h) => capitalize(formatMonth(h.month))), ...axisStyle, splitLine: { show: false } },
      yAxis: { type: "value", min: axisFloor(points), ...axisStyle, axisLabel: { color: INK.faint, formatter: (v: number) => `${Math.round(v / 1000)} k€` } },
      series: [
        { ...helper, name: "base", areaStyle: { opacity: 0 }, data: base },
        { ...helper, name: "écart", areaStyle: { color: INK.accent, opacity: 0.14 }, data: band },
        { name: "Patrimoine", type: "line", showSymbol: false, symbolSize: 8, data: points.map((h) => h.value), lineStyle: { width: 2, color: INK.accent }, itemStyle: { color: INK.accent } },
        { name: "Versé net", type: "line", showSymbol: false, symbolSize: 8, data: points.map((h) => h.netContrib), lineStyle: { width: 2, type: "dashed", color: INK.muted }, itemStyle: { color: INK.muted } },
      ],
    };
  }, [history, period]);

  return (
    <Card className="lg:col-span-3">
      <CardTitle
        hint={
          <span className="flex items-center gap-3">
            <span className="flex rounded-md bg-surface-2 p-0.5">
              {PERIODS.map((x) => (
                <button key={x.key} type="button" aria-pressed={period === x.key} onClick={() => setPeriod(x.key)} className={cn("rounded px-2 py-0.5", period === x.key ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>
                  {x.key}
                </button>
              ))}
            </span>
            <Link to="/historique" className="text-accent hover:underline">
              Historique
            </Link>
          </span>
        }
      >
        Évolution
      </CardTitle>
      {option ? <Chart option={option} height={300} /> : <p className="py-24 text-center text-sm text-fg-muted">L'évolution apparaîtra après un mois d'historique.</p>}
    </Card>
  );
}

/** Part réelle en barre, cible en repère : l'écart se lit directement. */
function AllocationCard({ allocation }: { allocation: PortfolioState["allocation"] }) {
  const bars = allocationBars(allocation.rows);
  return (
    <Card className="flex flex-col lg:col-span-2">
      <CardTitle hint="barre : réel · trait : cible">Allocation</CardTitle>
      {bars.length === 0 ? (
        <p className="py-16 text-center text-sm text-fg-muted">
          Réglez votre cible dans{" "}
          <Link to="/parametres?onglet=Répartition" className="text-accent hover:underline">
            Paramètres › Répartition
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-1 flex-col justify-evenly gap-3.5">
          {bars.map(({ row: r, width, targetAt }) => (
            <li key={r.key}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{r.label}</span>
                <span className="flex shrink-0 items-center gap-2.5">
                  {r.action !== "ok" && <Badge tone="accent">{ACTION[r.action]}</Badge>}
                  <span className="num text-xs text-fg-muted">
                    <Pct value={r.share} /> / <Pct value={r.target} />
                  </span>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-surface-3" role="img" aria-label={`${r.label} : ${Math.round(r.share * 100)} % pour une cible de ${Math.round(r.target * 100)} %`}>
                <div className="h-full rounded-full" style={{ width: `${width}%`, background: r.color ?? BUCKET_COLORS[r.bucket!] }} />
                {r.target > 0 && <div className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-fg ring-2 ring-surface" style={{ left: `calc(${targetAt}% - 1px)` }} />}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-fg-faint">
        Partie investie : <Amount value={allocation.invested} compact />. On rééquilibre en orientant les versements, sans vendre.
      </p>
    </Card>
  );
}

function EnvelopesCard({ accounts }: { accounts: PortfolioState["accounts"] }) {
  const rows = envelopeRows(accounts);
  return (
    <Card>
      <CardTitle hint={<Link to="/enveloppes" className="text-accent hover:underline">Détail</Link>}>Mes enveloppes</CardTitle>
      {rows.length === 0 && <p className="py-12 text-center text-sm text-fg-muted">Saisissez vos apports pour voir vos enveloppes.</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.name}</span>
              <span className="flex shrink-0 items-baseline gap-2.5">
                <Amount value={r.value} compact />
                <span className="w-14 text-right text-xs">{r.gainPct != null && <Pct value={r.gainPct} signed />}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent" style={{ width: `${r.width}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Line({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <>
      <dt className={strong ? "font-medium" : "text-fg-muted"}>{label}</dt>
      <dd className={cn("text-right", strong && "font-semibold")}>{children}</dd>
    </>
  );
}

/** Actifs et dettes, pour une gestion de patrimoine sans projection de retraite. */
function NetWorthCard({ netWorth: n }: { netWorth: PortfolioState["netWorth"] }) {
  return (
    <Card>
      <CardTitle>Actifs et dettes</CardTitle>
      <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-5 gap-y-2.5 text-sm">
        <Line label="Patrimoine financier">
          <Amount value={n.financial} compact />
        </Line>
        <Line label="Immobilier">
          <Amount value={n.realEstate} compact />
        </Line>
        <Line label="Crédits restant dus">
          <Amount value={-n.debts} compact />
        </Line>
        <Line label="Patrimoine net" strong>
          <Amount value={n.net} compact />
        </Line>
        {n.monthlyLoans > 0 && (
          <Line label="Mensualités">
            <Amount value={n.monthlyLoans} compact />
          </Line>
        )}
      </dl>
    </Card>
  );
}

function ReviewCard({ alerts }: { alerts: Alert[] }) {
  const [all, setAll] = useState(false);
  const todo = alertsToReview(alerts);
  const hidden = Math.max(0, todo.length - MAX_ALERTS);
  return (
    <Card>
      <CardTitle hint={todo.length ? `${todo.length} point${todo.length > 1 ? "s" : ""}` : undefined}>À regarder</CardTitle>
      {todo.length === 0 ? (
        <p className="py-12 text-center text-sm text-fg-muted">Rien à signaler.</p>
      ) : (
        <>
          <AlertList alerts={all ? todo : todo.slice(0, MAX_ALERTS)} compact />
          {hidden > 0 && (
            <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs text-accent hover:underline">
              {all ? "Réduire" : `Voir les ${hidden} autre${hidden > 1 ? "s" : ""}`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

/** Carte « Projection à la retraite » (plan de retraite seulement). */
function RetirementCard({ proj, p }: { proj: NonNullable<ReturnType<typeof useProjection>>; p: PlanParams }) {
  const { base, bands } = proj;
  const ry = retirementYear(p);
  const at = base.atRetirement;
  const band = bands.find((b) => b.year === at.year);
  return (
    <Card>
      <CardTitle hint={<Link to="/projection" className="text-accent hover:underline">Simuler</Link>}>
        Projection à {p.profile.retirementAge} ans ({ry})
      </CardTitle>
      <dl className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-5 gap-y-2.5 text-sm">
        <dt />
        <dd className="text-right text-xs text-fg-faint">en {ry}</dd>
        <dd className="text-right text-xs text-fg-faint">en € d'aujourd'hui</dd>
        <dt className="text-fg-muted">Patrimoine financier</dt>
        <dd className="text-right font-semibold">
          <Amount value={at.total} compact />
        </dd>
        <dd className="text-right">
          <Amount value={at.real} compact />
        </dd>
        <dt className="text-fg-muted">dont partie investie</dt>
        <dd className="text-right">
          <Amount value={at.invested} compact />
        </dd>
        <dd className="text-right">
          <Amount value={base.income.investedToday} compact />
        </dd>
        <dt className="text-fg-muted">Argent versé d'ici là</dt>
        <dd className="text-right">
          <Amount value={at.contributed} compact />
        </dd>
        <dd />
        <dt className="text-fg-muted">
          Revenu mensuel possible
          <div className="text-xs text-fg-faint">
            de {p.profile.retirementAge} à {p.profile.horizonAge} ans
          </div>
        </dt>
        <dd className="text-right text-base font-semibold text-accent">
          <Amount value={base.income.monthlyNominal} compact />
        </dd>
        <dd className="text-right text-base font-semibold">
          <Amount value={base.income.monthlyToday} compact />
        </dd>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-fg-faint">
        Fourchette du patrimoine en {ry} selon les marchés : <Amount value={band?.p10} compact /> à <Amount value={band?.p90} compact />. Avant impôts, hors crypto, inflation de{" "}
        {(p.returns.inflation * 100).toLocaleString("fr-FR")} % par an. Rien n'est garanti hors livrets, fonds euros et obligations gardées jusqu'à l'échéance.
      </p>
    </Card>
  );
}
