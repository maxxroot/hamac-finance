import { useMemo } from "react";
import { Link } from "react-router";
import { BUCKET_LABELS, BUCKETS, computeAlerts, formatEur, retirementYear } from "@hamac/core";
import { AlertList } from "@/components/Alerts";
import { Amount } from "@/components/Amount";
import { Chart, axisStyle, type ChartOption } from "@/components/Chart";
import { Pct, Stat } from "@/components/Stat";
import { Badge, Card, CardTitle } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { BUCKET_COLORS, INK } from "@/lib/colors";
import { capitalize, formatMonth } from "@/lib/numbers";
import { useHistory } from "@/lib/portfolio";
import { useProjection } from "@/lib/projection";

const ACTION = { ok: "OK", renforcer: "Renforcer", alleger: "Alléger" } as const;

export function TableauDeBord() {
  const proj = useProjection(null);
  const history = useHistory();
  const alerts = useMemo(() => (proj ? computeAlerts(proj.pf.data, proj.pf.state, { priceErrors: proj.pf.idx.ws.priceStatus?.errors }) : []), [proj]);

  const donut = useMemo<ChartOption | null>(() => {
    if (!proj) return null;
    const s = proj.pf.state;
    return {
      tooltip: { trigger: "item", backgroundColor: INK.surface2, borderColor: INK.line, textStyle: { color: INK.fg }, valueFormatter: (v: unknown) => formatEur(Number(v), { compact: true }) },
      legend: { orient: "vertical", right: 0, top: "middle", icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: INK.muted } },
      series: [
        {
          type: "pie",
          radius: ["55%", "80%"],
          center: ["32%", "50%"],
          padAngle: 1,
          itemStyle: { borderColor: INK.surface, borderWidth: 2, borderRadius: 4 },
          label: { show: false },
          data: BUCKETS.map((b) => ({ name: BUCKET_LABELS[b], value: s.buckets[b], itemStyle: { color: BUCKET_COLORS[b] } })).filter((d) => d.value > 0),
        },
      ],
    };
  }, [proj]);

  const line = useMemo<ChartOption | null>(() => {
    if (!history || history.length < 2) return null;
    return {
      tooltip: { trigger: "axis", backgroundColor: INK.surface2, borderColor: INK.line, textStyle: { color: INK.fg }, valueFormatter: (v: unknown) => formatEur(Number(v), { compact: true }) },
      xAxis: { type: "category", boundaryGap: false, data: history.map((h) => capitalize(formatMonth(h.month))), ...axisStyle, splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle, axisLabel: { color: INK.faint, formatter: (v: number) => `${Math.round(v / 1000)} k€` } },
      series: [
        { name: "Patrimoine", type: "line", showSymbol: false, symbolSize: 8, data: history.map((h) => h.value), lineStyle: { width: 2, color: INK.accent }, itemStyle: { color: INK.accent } },
        { name: "Versé net", type: "line", showSymbol: false, symbolSize: 8, data: history.map((h) => h.netContrib), lineStyle: { width: 2, type: "dashed", color: INK.muted }, itemStyle: { color: INK.muted } },
      ],
    };
  }, [history]);

  if (!proj) return null;
  if (proj.pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const { pf, base, bands } = proj;
  const { state, data } = pf;
  const p = data.params;
  const ry = retirementYear(p);
  const yearsLeft = Math.max(0, ry - +pf.today.slice(0, 4));
  const at = base.atRetirement;
  const band = bands.find((b) => b.year === at.year);
  const total = state.performance.find((r) => r.key === "total");
  const todo = alerts.filter((a) => a.level !== "ok");

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {state.age} ans · départ visé à {p.profile.retirementAge} ans ({ry}) · {yearsLeft} an{yearsLeft > 1 ? "s" : ""} de versements restants
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat
          label="Patrimoine financier"
          className="col-span-2 lg:col-span-1"
          sub={
            <>
              précaution <Amount value={state.buckets.precaution} compact /> · investi <Amount value={state.totals.value - state.buckets.precaution} compact />
            </>
          }
        >
          <span className="text-2xl">
            <Amount value={state.totals.value} compact />
          </span>
        </Stat>
        <Stat label="Versé net depuis le départ">
          <Amount value={state.totals.netContrib} compact />
        </Stat>
        <Stat label="Gain / perte" sub={<Pct value={state.totals.netContrib > 0 ? state.totals.gain / state.totals.netContrib : null} signed />}>
          <Amount value={state.totals.gain} signed compact />
        </Stat>
        <Stat label="Rendement annualisé" sub={total?.irr == null ? total?.irrReason : "depuis le départ"}>
          {total?.irr != null ? <Pct value={total.irr} signed /> : "—"}
        </Stat>
        <Stat label="Versements chaque mois">
          <Amount value={state.totals.monthly} compact />
        </Stat>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
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
        <Card className="lg:col-span-3">
          <CardTitle hint={todo.length ? `${todo.length} point${todo.length > 1 ? "s" : ""} à regarder` : "tout va bien"}>Alertes et contrôles</CardTitle>
          <div className="max-h-[340px] overflow-y-auto pr-1">
            <AlertList alerts={alerts} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardTitle>Répartition actuelle</CardTitle>
          {donut && state.totals.value > 0 ? <Chart option={donut} height={200} /> : <p className="py-12 text-center text-sm text-fg-muted">Saisissez vos apports pour voir la répartition.</p>}
          <div className="mt-3 space-y-1.5">
            {state.allocation.rows.map((r) => (
              <div key={r.bucket} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-fg-muted">
                  <span className="size-2.5 rounded-sm" style={{ background: BUCKET_COLORS[r.bucket] }} />
                  {BUCKET_LABELS[r.bucket]}
                </span>
                <span className="flex items-center gap-3">
                  <span className="num text-xs text-fg-faint">
                    <Pct value={r.share} /> / cible <Pct value={r.target} />
                  </span>
                  <Badge tone={r.action === "ok" ? "positive" : "accent"}>{ACTION[r.action]}</Badge>
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <CardTitle hint={<Link to="/historique" className="text-accent hover:underline">Historique</Link>}>Évolution réelle : patrimoine et argent versé</CardTitle>
          {line ? <Chart option={line} height={280} /> : <p className="py-16 text-center text-sm text-fg-muted">L'évolution apparaîtra après un mois d'historique.</p>}
        </Card>
      </div>
    </>
  );
}
