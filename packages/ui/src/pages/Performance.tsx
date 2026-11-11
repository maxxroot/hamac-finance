import { useMemo, useState } from "react";
import { assetPerformance, envelopePerformance, periodTables, scopePerformance, withdrawalTaxes } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { PeriodSelector } from "@/components/EvolutionChart";
import { Select } from "@/components/form";
import { CalendarCard, CumulativeCard, EnvelopeTable, PeriodsCard, RankingCard, SourcesCard } from "@/components/PerformanceBlocks";
import { PerformanceCompare } from "@/components/PerformanceCompare";
import { Notice, Pct, Stat } from "@/components/Stat";
import { PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { PERIODS, type PeriodKey } from "@/lib/dashboard";
import { capitalize, formatMonth } from "@/lib/numbers";
import { ALL_SCOPE, breakdownParts, envelopesForScope, findScope, pctText, scopeOptions } from "@/lib/performance";
import { useHistory, usePortfolio } from "@/lib/portfolio";

export function Performance() {
  const pf = usePortfolio();
  const history = useHistory();
  const [period, setPeriod] = useState<PeriodKey>("Tout");
  const [scopeKey, setScopeKey] = useState(ALL_SCOPE);
  const monthsBack = PERIODS.find((p) => p.key === period)?.months ?? null;

  const options = useMemo(() => (pf ? scopeOptions(pf.state) : null), [pf]);
  const scope = options ? (findScope(options, scopeKey) ?? options.all) : null;

  const view = useMemo(() => {
    if (!pf || !history?.length || !scope) return null;
    const taxes = withdrawalTaxes(pf.data, pf.state, pf.crypto);
    return {
      perf: scopePerformance(pf.data, pf.state, history, scope.accountIds, monthsBack),
      ranking: assetPerformance(pf.data, pf.state, history, scope.accountIds, monthsBack),
      envelopes: envelopePerformance(pf.data, pf.state, history, taxes, monthsBack),
    };
  }, [pf, history, scope, monthsBack]);

  // Ne dépend pas de la période : ce tableau couvre toujours tout l'historique.
  const parts = useMemo(() => {
    if (!pf || !history?.length || !options || !scope) return [];
    return breakdownParts(options, scope).flatMap((o) => {
      const t = periodTables(pf.data, pf.state, history, o.accountIds);
      return t ? [{ key: o.key, label: o.label, ...t }] : [];
    });
  }, [pf, history, options, scope]);

  if (!pf || !history || !options || !scope) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;

  const perf = view?.perf ?? null;
  const rows = envelopesForScope(view?.envelopes ?? [], scope.key);
  // Sur tout le patrimoine et depuis le début, même chiffre que le tableau de bord.
  const total = scope.key === ALL_SCOPE && monthsBack == null ? rows.find((r) => r.key === "total") : undefined;
  const annualized = total ? total.annualized : (perf?.summary.annualized ?? null);
  const reason = total ? total.annualizedReason : (perf?.summary.annualizedReason ?? null);
  const nameOf = (id: string) => pf.idx.assetById.get(id)?.name ?? id;

  return (
    <>
      <PageHeader title="Performance" description="Ce que l'argent a réellement rapporté, d'où ça vient, et comment ça se compare." />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-72">
          <Select aria-label="Ce qui est analysé" value={scope.key} onChange={(e) => setScopeKey(e.target.value)}>
            <option value={options.all.key}>{options.all.label}</option>
            <optgroup label="Enveloppes">
              {options.groups.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </optgroup>
            <optgroup label="Comptes">
              {options.accounts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </optgroup>
          </Select>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {!perf && <Notice>Aucune donnée pour le moment : ajoutez un versement pour voir la performance.</Notice>}
      {perf && (
        <div className="space-y-5">
          {perf.unpricedMonths > 0 && (
            <Notice tone="warning">
              Sur {perf.unpricedMonths} des {perf.windowMonths} mois affichés, une partie des titres n'a aucun cours connu et compte à son prix de revient : la performance de ces mois paraît plus plate qu'elle ne l'a été.
            </Notice>
          )}

          <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-3 @6xl:grid-cols-6">
            <Stat label="Gain" sub={<Pct value={perf.summary.gainPct} signed />}>
              <Amount value={perf.summary.gain} signed compact />
            </Stat>
            <Stat label="Rendement annualisé" sub={annualized != null ? "par an" : perf.summary.rate != null ? `${pctText(perf.summary.rate)} sur la période` : reason}>
              {annualized != null ? <Pct value={annualized} signed /> : <span className="text-fg-faint">—</span>}
            </Stat>
            <Stat label="Dividendes et intérêts" sub={<>dont <Amount value={perf.sources.dividends} compact /> de dividendes</>}>
              <Amount value={perf.sources.dividends + perf.sources.interests} compact />
            </Stat>
            <Stat label="Frais payés" sub={perf.sources.embeddedFees > 0.005 ? <>dont <Amount value={perf.sources.embeddedFees} compact /> dans les achats et ventes</> : undefined}>
              <Amount value={perf.sources.allFees} compact />
            </Stat>
            <Stat label="Plus forte baisse" sub={perf.drawdown ? `${capitalize(formatMonth(perf.drawdown.troughMonth))} · ${perf.drawdown.recoveredMonth ? "rattrapée" : "pas encore rattrapée"}` : "aucune sur la période"}>
              {perf.drawdown ? <Pct value={perf.drawdown.depth} signed /> : <span className="text-fg-faint">—</span>}
            </Stat>
            <Stat label="Volatilité" sub={perf.volatility != null ? `la valeur varie d'environ ${pctText(perf.volatility, 1, false)} par an` : "il faut au moins 12 mois"}>
              {perf.volatility != null ? <Pct value={perf.volatility} /> : <span className="text-fg-faint">—</span>}
            </Stat>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <CumulativeCard curve={perf.curve} />
            <SourcesCard sources={perf.sources} byClass={perf.byClass} />
          </div>

          <PeriodsCard years={perf.years} monthly={perf.monthly} parts={parts} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <CalendarCard calendar={perf.calendar} stats={perf.stats} />
            <RankingCard rows={view?.ranking ?? []} nameOf={nameOf} />
          </div>

          <EnvelopeTable rows={rows} wholeHistory={monthsBack == null} />

          {/* Servi plus rarement : en bas de page. */}
          <PerformanceCompare data={pf.data} state={pf.state} history={history} idx={pf.idx} options={options} />

          <p className="text-xs text-fg-faint">
            Le <b>rendement annualisé</b> tient compte de la date de chaque versement. Il s'affiche à partir d'un an : sur quelques jours, annualiser n'a pas de sens. Le <b>rendement cumulé</b> et le calendrier mesurent seulement les placements, sans l'effet de l'argent ajouté, mois par mois. Le <b>gain cumulé</b>, en euros, est ce que les placements ont rapporté depuis le début de la période, versements déduits. Une
            baisse et sa remontée dans un même mois n'y apparaissent donc pas. Les transferts entre enveloppes comptent pour chaque enveloppe, mais pas pour le total. « Gain après impôts » : ce qui resterait si tout était retiré aujourd'hui.
          </p>
        </div>
      )}
    </>
  );
}
