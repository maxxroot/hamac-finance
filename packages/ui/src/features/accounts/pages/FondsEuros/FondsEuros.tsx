import { fiscalAnniversary, holdsEuroFunds } from "@hamac/core";
import { AddTransactionButton, EmptyAccount, Movements, NEW_FUND_PRESET, Onboarding } from "@/features/entry";
import { AccountStrip } from "@/shared/components/AccountStrip";
import { Amount } from "@/shared/components/Amount";
import { Pct, Stat, StatGrid } from "@/shared/components/Stat";
import { Badge, PageHeader } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { fundLines, weightedAverageRate } from "@/features/accounts/lib/fundLines";
import { FundTable } from "./_FundTable";

/**
 * Fonds euros, tous contrats confondus : une ligne par fonds et par contrat, avec ses taux servis.
 * La fiche d'un contrat (ancienneté, frais, clause, relevé de l'assureur) est sur sa propre page.
 */
export function FondsEuros() {
  const pf = usePortfolio();
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const contracts = pf.state.accounts.filter((a) => holdsEuroFunds(a.account) && !a.account.archived);
  const lines = fundLines(contracts, pf.idx.ws.fundRates, pf.idx.assetById);
  const balance = lines.reduce((t, l) => t + l.balance, 0);
  const income = lines.reduce((t, l) => t + l.income, 0);
  const total = pf.state.totals.value;
  const first = contracts[0]?.account.id;
  return (
    <>
      <PageHeader
        title="Fonds euros"
        description="Le support à capital garanti de vos contrats d'assurance-vie et de PER, tous contrats confondus. Les mouvements se saisissent dans le journal ; ici : le solde et les taux servis de chaque fonds euros. Cliquez sur un contrat pour voir sa fiche et le contrôler avec le relevé de l'assureur."
        actions={
          first && (
            <>
              <AddTransactionButton accountId={first} type="arbitrage" variant="ghost" label="Arbitrage" />
              <AddTransactionButton accountId={first} type="versement" assetId={NEW_FUND_PRESET} variant="ghost" label="Verser sur un autre fonds euros" />
              <AddTransactionButton accountId={first} type="versement" />
            </>
          )
        }
      />
      {contracts.length === 0 ? (
        <EmptyAccount kind="assurance_vie" label="Ajouter un contrat">
          Aucun contrat d'assurance-vie : créez-le avec son établissement, sa date d'ouverture (règle des 8 ans) et sa clause bénéficiaire.
        </EmptyAccount>
      ) : (
        <>
          <AccountStrip
            accounts={contracts}
            body={(s) => {
              const euros = s.positions.filter((p) => p.asset.kind === "fonds_euros").reduce((t, p) => t + p.value, 0);
              const eight = s.account.kind === "assurance_vie" ? fiscalAnniversary(s.account.openedOn, 8) : null;
              return (
                <>
                  <span>
                    <Amount value={euros} compact /> <span className="text-fg-muted">en fonds euros</span>
                  </span>
                  {s.account.kind === "assurance_vie" &&
                    (eight ? eight <= pf.today ? <Badge tone="positive">8 ans passés</Badge> : <span className="text-xs text-fg-muted">8 ans le {formatDate(eight)}</span> : <span className="text-xs text-fg-faint">date d'ouverture à renseigner</span>)}
                </>
              );
            }}
          />
          <StatGrid>
            <Stat label="Encours des fonds euros" sub={<>{((total > 0 ? balance / total : 0) * 100).toFixed(1).replace(".", ",")} % du patrimoine</>}>
              <Amount value={balance} compact />
            </Stat>
            <Stat label="Intérêts reçus" sub="depuis l'ouverture des contrats">
              <Amount value={income} compact />
            </Stat>
            <Stat label="Taux moyen servi" sub={<>pondéré par les soldes · hypothèse du plan <Pct value={pf.data.params.returns.fondsEuros} /></>}>
              <Pct value={weightedAverageRate(lines)} digits={2} />
            </Stat>
            <Stat label="Versements mensuels" sub="sur ces contrats">
              <Amount value={contracts.reduce((t, s) => t + s.currentMonthly, 0)} compact />
            </Stat>
          </StatGrid>
          <FundTable lines={lines} />
          <Movements accountIds={contracts.map((c) => c.account.id)} limit={20} title="Mouvements des contrats" />
        </>
      )}
    </>
  );
}
