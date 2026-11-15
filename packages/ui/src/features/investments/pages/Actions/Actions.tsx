import { useState } from "react";
import type { Asset } from "@hamac/core";
import { AddAccountButton, AddTransactionButton, AdvisedPurchaseCard, EmptyAccount, Movements, Onboarding } from "@/features/entry";
import { Amount } from "@/shared/components/Amount";
import { Notice, Stat, StatGrid } from "@/shared/components/Stat";
import { Card, CardTitle, PageHeader } from "@/shared/components/ui";
import { PriceDialog } from "@/features/investments/dialogs/PriceDialog";
import { usePortfolio } from "@/shared/lib/portfolio";
import { AccountStrip } from "./_AccountStrip";
import { LISTED_ACCOUNT_KINDS, LISTED_ASSET_KINDS, listed } from "./_listed";
import { PositionsTable } from "./_PositionsTable";
import { TargetsCard } from "./_TargetsCard";

/**
 * Actions & ETF, tous comptes confondus : une ligne par titre et par compte, les parts calculées sur l'ensemble.
 * Le détail d'un compte (achat conseillé, frais, mouvements d'espèces) est sur sa propre page.
 */
export function Actions() {
  const pf = usePortfolio();
  const [pricing, setPricing] = useState<Asset | null>(null);
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const { params } = pf.data;
  // Le PEA (un seul par personne), chaque compte-titres même sans actions, puis les contrats qui en détiennent.
  const active = pf.state.accounts.filter((a) => !a.account.archived);
  const peas = active.filter((a) => a.account.kind === "pea" || a.account.kind === "pea_pme");
  const ctos = active.filter((a) => a.account.kind === "cto");
  const others = active.filter((a) => (a.account.kind === "assurance_vie" || a.account.kind === "per" || a.account.kind === "epargne_salariale") && a.positions.some(listed));
  const accounts = [...peas, ...ctos, ...others];
  const positions = accounts.flatMap((a) => a.positions.filter(listed));
  const value = positions.reduce((t, p) => t + p.value, 0);
  const cost = positions.reduce((t, p) => t + p.cost, 0);
  // Espèces à investir en actions : celles des PEA et des comptes-titres (celles d'un contrat vont d'abord au fonds euros).
  const cash = [...peas, ...ctos].reduce((t, a) => t + a.cash, 0);
  const peaCash = peas.reduce((t, a) => t + a.cash, 0);
  const ter = positions.reduce((t, p) => t + p.value * (p.asset.ter ?? 0), 0);
  // Courtage des achats et ventes de ces titres, y compris ceux qui ont été vendus depuis.
  const isListed = (assetId: string) => LISTED_ASSET_KINDS.includes(pf.idx.assetById.get(assetId)?.kind ?? "fonds_euros");
  const brokerage = accounts.reduce((t, a) => t + a.positionTotals.reduce((u, p) => u + (isListed(p.assetId) ? p.fees : 0), 0), 0);
  const missing = [...new Set(positions.filter((p) => p.priceUsed === "cout").map((p) => p.asset.name))];
  const [s1, s2] = params.alerts.stressEquity;
  const total = pf.state.totals.value;
  const target = accounts[0];

  return (
    <>
      <PageHeader
        title="Actions & ETF"
        description="Toutes vos lignes d'actions, d'ETF et de fonds, tous comptes confondus. Cliquez sur un compte pour voir sa composition complète."
        actions={
          <>
            <AddAccountButton kind="cto" label="Ajouter un compte-titres" variant="ghost" />
            {target && <AddTransactionButton accountId={target.account.id} type="achat" assetKinds={LISTED_ASSET_KINDS} accountKinds={LISTED_ACCOUNT_KINDS} />}
          </>
        }
      />
      {peas.length === 0 && (
        <div className="mb-6">
          <EmptyAccount kind="pea" label="Ajouter un PEA">
            Pas encore de PEA (un seul par personne) : créez-le avec son établissement et sa date d'ouverture (règle des 5 ans).
          </EmptyAccount>
        </div>
      )}
      {accounts.length > 0 && (
        <>
          <AccountStrip accounts={accounts} />
          <StatGrid>
            <Stat label="Valeur des actions et ETF" sub={<>{((total > 0 ? value / total : 0) * 100).toFixed(1).replace(".", ",")} % du patrimoine</>}>
              <Amount value={value} compact />
            </Stat>
            <Stat label="Plus-value latente" sub={<>investi <Amount value={cost} compact /></>}>
              <Amount value={value - cost} signed compact />
            </Stat>
            <Stat label="Espèces à investir" tone={peaCash >= params.alerts.peaCashThreshold ? "warning" : cash < -0.01 ? "negative" : undefined} sub="sur les PEA et comptes-titres">
              <Amount value={cash} compact />
            </Stat>
            <Stat label="Frais de gestion des ETF / an" sub={<>courtage payé <Amount value={brokerage} compact /></>}>
              <Amount value={ter} />
            </Stat>
          </StatGrid>
          {missing.length > 0 && (
            <div className="mb-4">
              <Notice tone="warning">⚠ Cours indisponible pour {missing.join(", ")} : la valeur affichée est le prix de revient. Saisissez le cours à la main en attendant.</Notice>
            </div>
          )}
          <PositionsTable positions={positions} onPrice={setPricing} />
          <div className="mb-5 grid gap-5 @3xl:grid-cols-3">
            {peas.map((p) => (
              <AdvisedPurchaseCard key={p.account.id} s={p} withAccount />
            ))}
            <Card>
              <CardTitle>Si les actions baissent</CardTitle>
              {[s1, s2].map((d) => (
                <div key={d} className="flex justify-between py-1 text-sm">
                  <span className="text-fg-muted">de {Math.round(d * 100)} %</span>
                  <span>
                    <Amount value={-d * value} signed /> <span className="text-fg-faint">({((-d * value * 100) / (total || 1)).toFixed(1).replace(".", ",")} % du patrimoine)</span>
                  </span>
                </div>
              ))}
              <p className="mt-2 text-xs text-fg-faint">Une baisse n'est une perte que si l'on vend.</p>
            </Card>
            <TargetsCard positions={positions} />
          </div>
          <Movements accountIds={accounts.map((a) => a.account.id)} limit={20} type="achat" assetKinds={LISTED_ASSET_KINDS} withCash={false} accountKinds={LISTED_ACCOUNT_KINDS} title="Mouvements (actions et ETF)" />
        </>
      )}
      <PriceDialog asset={pricing} onClose={() => setPricing(null)} />
    </>
  );
}
