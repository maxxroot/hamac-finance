import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import { ACCOUNT_KIND_LABELS, fiscalAnniversary, holdsEuroFunds, LIVRET_LABELS, type AccountState } from "@hamac/core";
import { AddTransactionButton, AdvisedPurchaseCard, EditAccountButton, Movements } from "@/features/entry";
import { AccountEvolution } from "@/shared/components/AccountEvolution";
import { Amount } from "@/shared/components/Amount";
import { Pct, Stat, StatGrid } from "@/shared/components/Stat";
import { Badge, Card, CardTitle, PageHeader } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { StatementCard } from "@/features/accounts/components/StatementCard";
import { Composition } from "./_Composition";
import { Facts } from "./_Facts";
import { Holdings } from "./_Holdings";

/** Page d'un compte : sa composition complète, toutes classes d'actifs confondues, ses caractéristiques et ses mouvements. */
export function Compte() {
  const { id } = useParams();
  const pf = usePortfolio();
  if (!pf) return null;
  const s = pf.state.accounts.find((a) => a.account.id === id);
  if (!s) return <Missing />;
  const { account } = s;
  const inst = account.institutionId ? pf.idx.institutionById.get(account.institutionId) : undefined;
  const kindLabel = account.kind === "livret" && account.livretType ? LIVRET_LABELS[account.livretType] : ACCOUNT_KIND_LABELS[account.kind];
  const share = pf.state.totals.value > 0 ? s.value / pf.state.totals.value : 0;
  const isPea = account.kind === "pea" || account.kind === "pea_pme";
  const lists = s.positions.length > 0 || s.crowdProjects.length > 0;

  return (
    <>
      <Link to="/comptes" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-accent">
        <ArrowLeft size={14} aria-hidden /> Mes comptes
      </Link>
      <PageHeader
        title={account.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{[kindLabel, inst?.name, account.openedOn && `ouvert le ${formatDate(account.openedOn)}`].filter(Boolean).join(" · ")}</span>
            {account.archived && <Badge>archivé</Badge>}
            {account.role && <span className="text-fg-faint">— {account.role}</span>}
          </span>
        }
        actions={
          <>
            <EditAccountButton account={account} />
            {!account.archived && <AddTransactionButton accountId={account.id} />}
          </>
        }
      />

      <StatGrid>
        <Stat label="Valeur" sub={<>{(share * 100).toFixed(1).replace(".", ",")} % du patrimoine</>}>
          <Amount value={s.value} compact />
        </Stat>
        <Stat label="Gain / perte" sub={<>versé net <Amount value={s.netContrib} compact /></>}>
          <Amount value={s.gain} signed compact />
        </Stat>
        {account.kind === "livret" ? (
          <Stat label="Taux" sub={account.depositCeiling ? <>plafond <Amount value={account.depositCeiling} compact /></> : undefined}>
            <Pct value={account.rate} digits={2} />
          </Stat>
        ) : (
          <Stat label={lists ? "Espèces non investies" : "Solde"} tone={s.cash < -0.01 ? "negative" : undefined} sub={<>versement mensuel <Amount value={s.currentMonthly} compact /></>}>
            <Amount value={s.cash} compact />
          </Stat>
        )}
        <FourthStat s={s} today={pf.today} />
      </StatGrid>

      <Composition s={s} />
      {lists && <Holdings s={s} />}

      <div className="mb-5 grid gap-5 @3xl:grid-cols-3">
        <Facts s={s} />
        {isPea && <AdvisedPurchaseCard s={s} />}
        {holdsEuroFunds(account) && <StatementCard s={s} />}
      </div>

      <Card className="mb-5">
        <CardTitle hint="Une courbe par titre détenu">Évolution</CardTitle>
        <AccountEvolution accountIds={[account.id]} />
      </Card>

      <Movements accountIds={[account.id]} limit={30} />
    </>
  );
}

/** Quatrième indicateur, selon le compte : la date qui allège l'impôt, ou les frais payés. */
function FourthStat({ s, today }: { s: AccountState; today: string }) {
  const years = s.account.kind === "pea" || s.account.kind === "pea_pme" ? 5 : s.account.kind === "assurance_vie" ? 8 : null;
  if (years) {
    const date = fiscalAnniversary(s.account.openedOn, years);
    return (
      <Stat label={`Fiscalité allégée (${years} ans)`}>
        {date ? date <= today ? <Badge tone="positive">depuis le {formatDate(date)}</Badge> : formatDate(date) : <span className="text-sm text-fg-faint">date d'ouverture à renseigner</span>}
      </Stat>
    );
  }
  if (s.account.kind === "livret") {
    return (
      <Stat label="Intérêts reçus">
        <Amount value={s.interests} compact />
      </Stat>
    );
  }
  return (
    <Stat label="Frais payés">
      <Amount value={s.fees} />
    </Stat>
  );
}

function Missing() {
  return (
    <Card className="mx-auto mt-10 max-w-lg text-center">
      <p className="text-sm text-fg-muted">Ce compte n'existe pas ou a été supprimé.</p>
      <Link to="/comptes" className="mt-3 inline-block text-sm text-accent hover:underline">
        Revenir à Mes comptes
      </Link>
    </Card>
  );
}
