import { Fragment, useState } from "react";
import type { Asset } from "@hamac/core";
import { incomeTaxRate } from "@hamac/core";
import { AddTransactionButton, EmptyEnvelope } from "@/components/TransactionButton";
import { AccountEvolution, EvolutionToggle, PositionEvolution } from "@/components/AccountEvolution";
import { Amount } from "@/components/Amount";
import { Movements } from "@/components/Movements";
import { Notice, Pct, Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr, DetailRow, ExpandButton, stopRowClick, useExpandedRow } from "@/components/table";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { PriceDialog } from "@/dialogs/PriceDialog";
import { SortTh, useSortable } from "@/lib/sort";
import type { PositionState } from "@hamac/core";
import { Onboarding } from "@/pages/Onboarding";
import { formatDate, formatQty } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";

export function Crypto() {
  const pf = usePortfolio();
  const [pricing, setPricing] = useState<Asset | null>(null);
  const [showEvolution, setShowEvolution] = useState(false);
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const { state, crypto, data } = pf;
  const accounts = state.accounts.filter((a) => a.account.kind === "crypto" && !a.account.archived);
  const ids = accounts.map((a) => a.account.id);
  const positions = accounts.flatMap((a) => a.positions);
  const value = accounts.reduce((s, a) => s + a.value, 0);
  const posValue = positions.reduce((s, p) => s + p.value, 0);
  const cash = accounts.reduce((s, a) => s + a.cash, 0);
  const netContrib = accounts.reduce((s, a) => s + a.netContrib, 0);
  const fees = accounts.reduce((s, a) => s + a.fees, 0);
  const latent = posValue - crypto.remainingAcquisition;
  const year = +pf.today.slice(0, 4);
  const salesThisYear = crypto.years.find((y) => y.year === year)?.grossSales ?? 0;
  const ir = incomeTaxRate(data.params);
  const ps = data.params.tax.socialGeneral;
  const taxIfSold = latent <= 0 || posValue + salesThisYear <= data.params.crypto.exemptionThreshold ? 0 : latent * (ir + ps);
  const [s1, s2] = data.params.alerts.stressCrypto;
  const missing = positions.filter((p) => p.priceUsed === "cout");

  return (
    <>
      <PageHeader
        title="Crypto"
        description="Par défaut hors allocation cible (réglable dans Paramètres › Répartition) : compte dans le patrimoine, l'historique et la performance, mais pas dans la répartition ni dans la projection."
        actions={accounts.length > 0 && <AddTransactionButton accountId={accounts[0].account.id} type="achat" />}
      />
      {accounts.length === 0 && (
        <EmptyEnvelope kind="crypto" label="Ajouter une plateforme">
          Aucune plateforme crypto : créez-la, rattachée à son établissement, pour commencer.
        </EmptyEnvelope>
      )}
      <StatGrid>
        <Stat label="Valeur totale" sub={<>{((value / (state.totals.value || 1)) * 100).toFixed(1).replace(".", ",")} % du patrimoine</>}>
          <Amount value={value} compact />
        </Stat>
        <Stat label="Gain / perte" sub={<>versé net <Amount value={netContrib} compact /></>}>
          <Amount value={value - netContrib} signed compact />
        </Stat>
        <Stat label="Euros sur la plateforme" tone={cash < -0.01 ? "negative" : undefined} sub={cash < -0.01 ? "Négatif : un versement manque dans le journal" : "Pas encore investis"}>
          <Amount value={cash} compact />
        </Stat>
        <Stat label="Frais payés">
          <Amount value={fees} />
        </Stat>
      </StatGrid>
      {accounts.length > 0 && (
        <div className="mb-5">
          <EvolutionToggle open={showEvolution} onToggle={() => setShowEvolution(!showEvolution)} />
          {showEvolution && (
            <div className="mt-2">
              <AccountEvolution accountIds={ids} />
            </div>
          )}
        </div>
      )}
      {missing.length > 0 && (
        <div className="mb-4">
          <Notice tone="warning">⚠ Cours non disponible pour {missing.map((p) => p.asset.name).join(", ")} : la valeur affichée est le prix d'achat. Saisissez le cours à la main.</Notice>
        </div>
      )}

      <CryptoPositions positions={positions} onPrice={setPricing} />

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card>
          <CardTitle>Si tout était vendu aujourd'hui</CardTitle>
          <div className="space-y-1.5 text-sm">
            <Row label="Plus-value latente (portefeuille global)">
              <Amount value={latent} signed />
            </Row>
            <Row label="Impôt estimé">
              <Amount value={taxIfSold} />
            </Row>
            <Row label="Valeur nette après impôt">
              <Amount value={value - taxIfSold} />
            </Row>
          </div>
        </Card>
        <Card>
          <CardTitle>Si les cryptos baissent</CardTitle>
          {[s1, s2].map((d) => (
            <Row key={d} label={`de ${Math.round(d * 100)} %${d >= 0.8 ? " (déjà arrivé plusieurs fois)" : ""}`}>
              <Amount value={-d * posValue} signed />
            </Row>
          ))}
        </Card>
        <Notice>
          Seules les ventes contre des euros sont imposables : garder ses cryptos ou les envoyer sur son propre portefeuille ne l'est pas. Plus-value = prix de cession − prix total d'acquisition × prix de cession / valeur globale du
          portefeuille (art. 150 VH bis). Rien à payer si les ventes de l'année ne dépassent pas {data.params.crypto.exemptionThreshold} €. Déclaration : formulaire 2086, et 3916-bis pour chaque compte sur une plateforme étrangère.
        </Notice>
      </div>

      <Card className="mb-6 p-0">
        <h2 className="px-5 pt-4 pb-3 text-sm font-medium text-fg-muted">Ventes contre des euros</h2>
        <Table className="rounded-none border-x-0 border-b-0">
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Crypto</Th>
              <Th align="right">Quantité</Th>
              <Th align="right">Cession brute</Th>
              <Th align="right">Frais</Th>
              <Th align="right">Valeur du portefeuille</Th>
              <Th align="right">Prix d'acquisition avant</Th>
              <Th align="right">Part imputée</Th>
              <Th align="right">Plus-value</Th>
            </tr>
          </thead>
          <tbody>
            {crypto.sales.length === 0 && <EmptyRow cols={9}>Aucune vente.</EmptyRow>}
            {crypto.sales.map((s) => (
              <Tr key={s.tx.id}>
                <Td>{formatDate(s.date)}</Td>
                <Td>{pf.idx.assetById.get(s.tx.assetId ?? "")?.name}</Td>
                <Td align="right">{formatQty(s.tx.quantity)}</Td>
                <Td align="right">
                  <Amount value={s.gross} />
                </Td>
                <Td align="right">
                  <Amount value={s.fee} />
                </Td>
                <Td align="right">
                  <Amount value={s.portfolioValue} />
                </Td>
                <Td align="right">
                  <Amount value={s.acquisitionBefore} />
                </Td>
                <Td align="right">
                  <Amount value={s.attributed} />
                </Td>
                <Td align="right">
                  <Amount value={s.gain} signed />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mb-6 p-0">
        <h2 className="px-5 pt-4 pb-3 text-sm font-medium text-fg-muted">Impôt par année</h2>
        <Table className="rounded-none border-x-0 border-b-0">
          <thead>
            <tr>
              <Th>Année</Th>
              <Th align="right">Total des ventes</Th>
              <Th align="right">Plus-values − moins-values</Th>
              <Th>Seuil de {data.params.crypto.exemptionThreshold} €</Th>
              <Th align="right">Impôt sur le revenu</Th>
              <Th align="right">Prélèvements sociaux</Th>
              <Th align="right">Total à payer</Th>
            </tr>
          </thead>
          <tbody>
            {crypto.years.length === 0 && <EmptyRow cols={7}>Aucune vente imposable.</EmptyRow>}
            {crypto.years.map((y) => (
              <Tr key={y.year}>
                <Td>{y.year}</Td>
                <Td align="right">
                  <Amount value={y.grossSales} />
                </Td>
                <Td align="right">
                  <Amount value={y.netGain} signed />
                </Td>
                <Td>{y.exempt ? <Badge tone="positive">Exonéré</Badge> : <Badge tone="accent">Imposable</Badge>}</Td>
                <Td align="right">
                  <Amount value={y.incomeTax} />
                </Td>
                <Td align="right">
                  <Amount value={y.social} />
                </Td>
                <Td align="right" className="font-medium">
                  <Amount value={y.total} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Movements accountIds={ids} limit={20} />
      <PriceDialog asset={pricing} onClose={() => setPricing(null)} />
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-sm">
      <span className="text-fg-muted">{label}</span>
      {children}
    </div>
  );
}

function CryptoPositions({ positions, onPrice }: { positions: PositionState[]; onPrice: (a: Asset) => void }) {
  const idx = usePortfolio()!.idx;
  const { isOpen, rowProps } = useExpandedRow();
  const { sorted, by } = useSortable(positions, {
    nom: (p) => p.asset.name,
    plateforme: (p) => idx.accountById.get(p.accountId)?.name,
    quantite: (p) => p.quantity,
    pru: (p) => p.pru,
    investi: (p) => p.cost,
    cours: (p) => p.price,
    valeur: (p) => p.value,
    pv: (p) => p.gain,
    pvPct: (p) => p.gainPct,
  });
  return (
    <Table className="mb-6">
      <thead>
        <tr>
          <SortTh {...by("nom")}>Crypto</SortTh>
          <SortTh {...by("plateforme")}>Plateforme</SortTh>
          <SortTh {...by("quantite")} align="right">Quantité</SortTh>
          <SortTh {...by("pru")} align="right">Prix de revient unitaire</SortTh>
          <SortTh {...by("investi")} align="right">Investi</SortTh>
          <SortTh {...by("cours")} align="right">Cours</SortTh>
          <SortTh {...by("valeur")} align="right">Valeur</SortTh>
          <SortTh {...by("pv")} align="right">Plus-value latente</SortTh>
          <SortTh {...by("pvPct")} align="right">(%)</SortTh>
        </tr>
      </thead>
      <tbody>
        {positions.length === 0 && <EmptyRow cols={9}>Aucune position.</EmptyRow>}
        {sorted.map((p) => (
          <Fragment key={`${p.accountId}-${p.asset.id}`}>
          <Tr {...rowProps(`${p.accountId}-${p.asset.id}`)}>
            <Td className="font-medium">
              <ExpandButton open={isOpen(`${p.accountId}-${p.asset.id}`)} label={p.asset.name} />
              {p.asset.name}
            </Td>
            <Td className="text-fg-muted">{idx.accountById.get(p.accountId)?.name}</Td>
            <Td align="right">{formatQty(p.quantity)}</Td>
            <Td align="right">
              <Amount value={p.pru} />
            </Td>
            <Td align="right">
              <Amount value={p.cost} />
            </Td>
            <Td align="right" onClick={stopRowClick}>
              <button className="hover:text-accent" onClick={() => onPrice(p.asset)} title="Saisir le cours à la main">
                <Amount value={p.price} />
              </button>
              <div className="text-[11px] text-fg-faint">{p.priceDate ? formatDate(p.priceDate) : "indisponible"}</div>
            </Td>
            <Td align="right" className="font-medium">
              <Amount value={p.value} />
            </Td>
            <Td align="right">
              <Amount value={p.gain} signed />
            </Td>
            <Td align="right">
              <Pct value={p.gainPct} signed />
            </Td>
          </Tr>
          {isOpen(`${p.accountId}-${p.asset.id}`) && (
            <DetailRow cols={9}>
              <PositionEvolution accountId={p.accountId} assetId={p.asset.id} />
            </DetailRow>
          )}
          </Fragment>
        ))}
      </tbody>
    </Table>
  );
}
