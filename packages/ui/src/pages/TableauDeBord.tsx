import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { computeAlerts, goalProgress, isRetirementPlan, retirementYear, type Alert, type HistoryPoint, type PlanParams, type PortfolioState } from "@hamac/core";
import { AlertList } from "@/components/Alerts";
import { Amount } from "@/components/Amount";
import { EvolutionChart, PeriodSelector } from "@/components/EvolutionChart";
import { Pct, Stat } from "@/components/Stat";
import { Badge, Card, CardTitle, PageTitle } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { BUCKET_COLORS } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { allocationBars, alertsToReview, envelopeRows, gainSinceLastMonth, type PeriodKey } from "@/lib/dashboard";
import { formatDate, formatMonth } from "@/lib/numbers";
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
  // Biens, crédits ou comptes joints : le patrimoine net diffère du total des comptes.
  const hasRealEstate = state.netWorth.realEstate !== 0 || state.netWorth.otherAssets !== 0 || state.netWorth.debts !== 0 || state.netWorth.financial !== state.totals.value;
  const change = history ? gainSinceLastMonth(history) : null;
  const middle = retraite && proj ? <RetirementCard proj={proj} p={p} /> : !retraite && hasRealEstate ? <NetWorthCard netWorth={state.netWorth} /> : null;

  return (
    <>
      <header className="mb-7">
        <PageTitle
          description={
            retraite ? (
              <>
                {state.age} ans, départ visé à {p.profile.retirementAge} ans ({ry}), {yearsLeft} an{yearsLeft > 1 ? "s" : ""} de versements restants
              </>
            ) : (
              "Gestion de patrimoine"
            )
          }
        >
          Tableau de bord
        </PageTitle>
      </header>

      {/* Le patrimoine sur deux rangées à gauche, les quatre autres chiffres en carré à droite. */}
      <div className="mb-5 grid grid-cols-2 gap-4 @3xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Stat
          label={hasRealEstate ? "Patrimoine net" : "Patrimoine financier"}
          className="col-span-2 @3xl:col-span-1 @3xl:row-span-2"
          hero
          sub={
            <>
              <dl className="mt-1 grid grid-cols-[repeat(3,auto)] justify-start gap-x-6 gap-y-0.5">
                {(hasRealEstate
                  ? [
                      ["Financier", state.netWorth.financial],
                      ["Immobilier", state.netWorth.realEstate],
                      ...(state.netWorth.otherAssets !== 0 ? [["Autres biens", state.netWorth.otherAssets]] : []),
                      ["Crédits", -state.netWorth.debts],
                    ]
                  : [
                      ["Précaution", state.buckets.precaution],
                      ["Investi", state.totals.value - state.buckets.precaution],
                    ]
                ).map(([label, value]) => (
                  <div key={label as string} className="contents">
                    <dt className="row-start-1 text-fg-faint">{label}</dt>
                    <dd className="row-start-2 text-[0.8125rem] font-medium text-fg-muted">
                      <Amount value={value as number} compact />
                    </dd>
                  </div>
                ))}
              </dl>
              {change && (
                <span className="mt-3 block">
                  <Amount value={change.gain} signed compact /> de gain depuis fin {formatMonth(change.since)}
                </span>
              )}
            </>
          }
        >
          <Amount value={hasRealEstate ? state.netWorth.net : state.totals.value} compact />
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

      <div className="mb-5 grid gap-5 @3xl:grid-cols-5">
        <EvolutionCard history={history} />
        <AllocationCard allocation={state.allocation} />
      </div>

      <div className={cn("grid gap-5 @3xl:grid-cols-2", middle && "@5xl:grid-cols-3")}>
        <EnvelopesCard accounts={state.accounts} />
        {middle}
        <div className={cn(middle && "@3xl:col-span-2 @5xl:col-span-1")}>
          <ReviewCard alerts={alerts} />
        </div>
      </div>

      {p.modules.projets && <GoalsCard />}
    </>
  );
}

/** Avancement des projets en cours, les plus proches d'abord. */
function GoalsCard() {
  const pf = usePortfolio();
  const rows = useMemo(() => (pf ? pf.idx.ws.goals.filter((g) => !g.archived).map((g) => goalProgress(g, pf.state)) : []), [pf]);
  if (rows.length === 0) return null;
  return (
    <Card className="mt-5">
      <CardTitle
        hint={
          <Link to="/projets" className="text-accent hover:underline">
            Projets
          </Link>
        }
      >
        Projets en cours
      </CardTitle>
      <ul className="grid gap-x-8 gap-y-3 text-sm @3xl:grid-cols-2">
        {rows.slice(0, 6).map((p) => (
          <li key={p.goal.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-medium">{p.goal.name}</span>
              <span className="shrink-0 text-xs text-fg-muted">
                <Amount value={p.saved} compact /> / <Amount value={p.goal.target} compact /> · {formatDate(p.goal.targetDate)}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-3" role="img" aria-label={`${Math.round(p.progress * 100)} % réunis`}>
              <div className={cn("h-full rounded-full", p.status === "atteint" ? "bg-positive" : p.status === "en_retard" ? "bg-warning" : "bg-accent")} style={{ width: `${Math.round(p.progress * 100)}%` }} />
            </div>
            {p.status !== "atteint" && p.monthsLeft > 0 && (
              <div className="mt-0.5 text-xs text-fg-faint">
                <Amount value={p.monthlyNeeded} compact /> par mois · {p.status === "en_retard" ? "en retard" : "en avance"}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EvolutionCard({ history }: { history: HistoryPoint[] | null }) {
  const [period, setPeriod] = useState<PeriodKey>("1A");
  return (
    <Card className="@3xl:col-span-3">
      <CardTitle
        hint={
          <span className="flex items-center gap-3">
            <PeriodSelector value={period} onChange={setPeriod} />
            <Link to="/historique" className="text-accent hover:underline">
              Historique
            </Link>
          </span>
        }
      >
        Évolution
      </CardTitle>
      {history && history.length >= 2 ? <EvolutionChart points={history} period={period} /> : <p className="py-24 text-center text-sm text-fg-muted">L'évolution apparaîtra après un mois d'historique.</p>}
    </Card>
  );
}

/** Part réelle en barre, cible en repère : l'écart se lit directement. */
function AllocationCard({ allocation }: { allocation: PortfolioState["allocation"] }) {
  const bars = allocationBars(allocation.rows);
  return (
    <Card className="flex flex-col @3xl:col-span-2">
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
        {n.otherAssets !== 0 && (
          <Line label="Autres biens">
            <Amount value={n.otherAssets} compact />
          </Line>
        )}
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
