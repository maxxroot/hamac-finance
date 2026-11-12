import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { addMonth, compareSnapshots, milestones, monthByMonth, periodChange, planComparison, type Milestone } from "@hamac/core";
import { AccountsCard, AllocationCompareCard, CascadeCard, MilestoneList, MonthlyTable, MonthsCard, PlanCard, PositionsCard, RangeControls, SituationCard, SummaryCard } from "@/features/analysis/components/HistoryBlocks";
import { Notice } from "@/shared/components/Stat";
import { Button, Card, CardTitle, PageHeader } from "@/shared/components/ui";
import { Onboarding, useJournal } from "@/features/entry";
import { activeShortcut, inRange, monthTitle, parseRange, periodSummary, pointLabel, rangeFromMilestone, rangeLabel, rangeParams, shortcutRange, waterfall, type Range } from "@/features/analysis/lib/historique";
import { useHistory, usePortfolio } from "@/shared/lib/portfolio";

const ALL = "all";

/**
 * Remonter le temps : la situation à deux dates, ce qui s'est passé entre les deux, et les grandes étapes
 * du parcours. La période choisie est dans l'adresse, pour pouvoir y revenir ou la partager.
 */
export function Historique() {
  const pf = usePortfolio();
  const history = useHistory();
  const journal = useJournal();
  const [search, setSearch] = useSearchParams();
  const [scope, setScope] = useState(ALL);
  const [showAll, setShowAll] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const months = useMemo(() => (history ?? []).map((h) => h.month), [history]);
  const steps = useMemo(() => (pf && history ? milestones(pf.data, history, pf.today) : []), [pf, history]);

  const range = months.length ? parseRange(search.get("du"), search.get("au"), months) : null;
  const setRange = (r: Range) => setSearch(rangeParams(r), { replace: true });

  const rangeFrom = range?.from ?? null;
  const rangeTo = range?.to ?? null;
  const view = useMemo(() => {
    if (!pf || !history?.length || !rangeTo) return null;
    const at = (m: string | null) => (m == null ? null : (history.find((h) => h.month === m) ?? null));
    const from = at(rangeFrom);
    const to = at(rangeTo)!;
    const cmp = compareSnapshots(from, to);
    // Un compte absent de la période choisie : retour à tout le patrimoine.
    const scoped = scope !== ALL && cmp.accounts.some((a) => a.accountId === scope) ? scope : ALL;
    const ids = scoped === ALL ? pf.data.accounts.map((a) => a.id) : [scoped];
    return { from, to, cmp, scope: scoped, change: periodChange(pf.data, from, to, ids) };
  }, [pf, history, rangeFrom, rangeTo, scope]);

  // Résumé, mois par mois et plan : toujours sur tout le patrimoine, quel que soit le périmètre de la cascade.
  const period = useMemo(() => {
    if (!pf || !history?.length || !rangeTo) return null;
    const from = rangeFrom == null ? null : (history.find((h) => h.month === rangeFrom) ?? null);
    const to = history.find((h) => h.month === rangeTo)!;
    const months = monthByMonth(pf.data, history, rangeFrom, rangeTo);
    return {
      months,
      summary: periodSummary(periodChange(pf.data, from, to, pf.data.accounts.map((a) => a.id)), months.length),
      plan: planComparison(pf.data, history, rangeFrom, rangeTo),
    };
  }, [pf, history, rangeFrom, rangeTo]);

  if (!pf || !history) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  if (!range || !view || !period) {
    return (
      <>
        <PageHeader title="Historique" />
        <Notice>L'historique commence avec la première opération du journal.</Notice>
      </>
    );
  }

  const last = months.at(-1)!;
  const startLabel = pointLabel(range.from, last);
  const endLabel = pointLabel(range.to, last);
  const withRealEstate = history.some((h) => h.realEstate !== 0 || h.debts !== 0 || h.otherAssets !== 0);
  const accountName = (id: string) => pf.idx.accountById.get(id)?.name ?? "Compte supprimé";
  const assetName = (id: string) => pf.idx.assetById.get(id)?.name ?? "Titre supprimé";
  const pick = (m: Milestone) => setRange(rangeFromMilestone(m, range, months));

  const fromDate = view.from?.date ?? null;
  const inPeriod = steps.filter((m) => inRange(m, fromDate, view.to.date));
  const scopes = [{ key: ALL, label: "Tout le patrimoine financier" }, ...view.cmp.accounts.map((a) => ({ key: a.accountId, label: accountName(a.accountId) }))];
  const scopeOk = view.scope;
  const operations = journal.filter((t) => (fromDate == null || t.date > fromDate) && t.date <= view.to.date && (scopeOk === ALL || t.accountId === scopeOk || t.counterAccountId === scopeOk)).length;
  const journalQuery = new URLSearchParams({ ...(range.from ? { du: `${addMonth(range.from, 1)}-01` } : {}), au: view.to.date, ...(scopeOk !== ALL ? { filtre: scopeOk } : {}) });

  return (
    <>
      <PageHeader title="Historique" description="Remonter le temps : où en était le patrimoine à une date, ce qui a changé depuis, et les grandes étapes du parcours. Tout est reconstruit à partir du journal." />

      <div className="mb-6">
        <RangeControls months={months} range={range} active={activeShortcut(range, months)} onChange={setRange} onShortcut={(k) => setRange(shortcutRange(k, range.to, months))} />
      </div>

      <h2 className="mb-4 font-display text-xl text-fg">{rangeLabel(range, last)}</h2>

      <SummaryCard s={period.summary} fromStart={range.from == null} />

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <MonthsCard months={period.months} monthLabel={monthTitle} />
        {period.plan && <PlanCard p={period.plan} monthLabel={monthTitle} />}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <SituationCard cmp={view.cmp} startLabel={startLabel} endLabel={endLabel} withRealEstate={withRealEstate} />
          <AllocationCompareCard rows={view.cmp.buckets} startLabel={startLabel} endLabel={endLabel} />
        </div>
        <CascadeCard
          w={waterfall(view.change, range.from == null ? null : startLabel, endLabel)}
          scope={scopeOk}
          scopes={scopes}
          onScope={setScope}
          journalHref={`/journal?${journalQuery.toString()}`}
          operations={operations}
        />
      </div>

      <Card className="mb-5">
        <CardTitle hint={`${inPeriod.length} sur la période`}>Les grandes étapes</CardTitle>
        <MilestoneList items={showAll ? steps : inPeriod} total={steps.length} showAll={showAll} onToggleAll={() => setShowAll((v) => !v)} onPick={pick} />
      </Card>

      <div className="mb-5">
        <AccountsCard rows={view.cmp.accounts} nameOf={accountName} closed={(id) => pf.idx.accountById.get(id)?.archived ?? true} />
      </div>

      {view.cmp.positions.length > 0 && (
        <div className="mb-5">
          <PositionsCard rows={view.cmp.positions} assetName={assetName} accountName={accountName} />
        </div>
      )}

      <div className="mt-8">
        <Button variant="ghost" onClick={() => setShowTable((v) => !v)}>
          {showTable ? "Masquer le tableau mois par mois" : "Voir le tableau mois par mois"}
        </Button>
        {showTable && (
          <div className="mt-3">
            <MonthlyTable history={history} />
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-fg-faint">
        Chaque mois est valorisé avec le dernier cours connu à sa date ; sans cours, au prix de revient. Les comptes clôturés restent comptés : leur argent versé et leur gain font partie du parcours. Les transferts entre comptes s'annulent sur le total, mais comptent pour chacun.
      </p>
    </>
  );
}
