import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { advisedMonthlyPurchase, describeOrderFees, fiscalAnniversary, monthsElapsed, splitByTarget, tradeFeeFor, type AccountState, type Asset, type PositionState } from "@hamac/core";
import { AddAccountButton, EditAccountButton } from "@/components/AccountButtons";
import { AddTransactionButton, EmptyEnvelope } from "@/components/TransactionButton";
import { AccountEvolution, EvolutionToggle } from "@/components/AccountEvolution";
import { Amount } from "@/components/Amount";
import { Movements } from "@/components/Movements";
import { Notice, Pct, Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Tr } from "@/components/table";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { PriceDialog } from "@/dialogs/PriceDialog";
import { SortTh, useSortable } from "@/lib/sort";
import { Onboarding } from "@/pages/Onboarding";
import { formatDate, formatQty } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";

const PRICE_LABEL = { marche: "marché", manuel: "manuel", modele: "calculé", cout: "prix de revient" } as const;

export function Actions() {
  const pf = usePortfolio();
  const [pricing, setPricing] = useState<Asset | null>(null);
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  // Le PEA (un seul par personne) puis chaque compte-titres ; un compte-titres sans actions s'affiche en version compacte.
  const active = pf.state.accounts.filter((a) => !a.account.archived);
  const pea = active.filter((a) => a.account.kind === "pea" || a.account.kind === "pea_pme");
  const ctos = active.filter((a) => a.account.kind === "cto");
  const others = active.filter((a) => (a.account.kind === "assurance_vie" || a.account.kind === "per" || a.account.kind === "epargne_salariale") && a.positions.some((p) => p.bucket === "croissance"));
  const accounts = [...pea, ...ctos.filter((c) => c.positions.some((p) => p.bucket === "croissance")), ...others];
  const emptyCtos = ctos.filter((c) => !c.positions.some((p) => p.bucket === "croissance"));
  const target = accounts[0] ?? emptyCtos[0];
  return (
    <>
      <PageHeader
        title="Actions & ETF"
        description="Positions calculées depuis le journal. Le cours vient du fournisseur ; un cours saisi à la main l'emporte à date égale ou plus récente."
        actions={
          <>
            <AddAccountButton kind="cto" label="Ajouter un compte-titres" variant="ghost" />
            {target && <AddTransactionButton accountId={target.account.id} type="achat" assetKinds={["etf", "action", "fonds"]} accountKinds={["pea", "pea_pme", "cto", "assurance_vie", "per", "epargne_salariale"]} />}
          </>
        }
      />
      {pea.length === 0 && (
        <div className="mb-6">
          <EmptyEnvelope kind="pea" label="Ajouter un PEA">
            Pas encore de PEA (un seul par personne) : créez-le avec son établissement et sa date d'ouverture (règle des 5 ans).
          </EmptyEnvelope>
        </div>
      )}
      <div className="space-y-8">
        {accounts.map((a) => (
          <Envelope key={a.account.id} s={a} onPrice={setPricing} />
        ))}
      </div>
      {emptyCtos.length > 0 && (
        <div className="mt-8 space-y-2">
          <h2 className="text-sm font-medium text-fg-muted">Comptes-titres sans actions ni ETF</h2>
          {emptyCtos.map((c) => (
            <Card key={c.account.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.account.name}</span>
                {c.account.institutionId && <span className="text-sm text-fg-muted">· {pf.idx.institutionById.get(c.account.institutionId)?.name}</span>}
                <EditAccountButton account={c.account} />
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-fg-muted">
                  espèces <Amount value={c.cash} compact />
                </span>
                <AddTransactionButton accountId={c.account.id} type="achat" assetKinds={["etf", "action", "fonds"]} accountKinds={["pea", "pea_pme", "cto", "assurance_vie", "per", "epargne_salariale"]} label="Acheter des actions ou ETF" variant="secondary" />
              </div>
            </Card>
          ))}
        </div>
      )}
      <PriceDialog asset={pricing} onClose={() => setPricing(null)} />
    </>
  );
}

function Envelope({ s, onPrice }: { s: AccountState; onPrice: (a: Asset) => void }) {
  const [showEvolution, setShowEvolution] = useState(false);
  const pf = usePortfolio()!;
  const { params } = pf.data;
  const equities = s.positions.filter((p) => p.bucket === "croissance");
  const equityValue = equities.reduce((t, p) => t + p.value, 0);
  const posShare = (p: PositionState) => (equityValue > 0 ? p.value / equityValue : 0);
  const { sorted, by } = useSortable(equities, {
    titre: (p) => p.asset.name,
    parts: (p) => p.quantity,
    pru: (p) => p.pru,
    investi: (p) => p.cost,
    cours: (p) => p.price,
    valeur: (p) => p.value,
    pv: (p) => p.gain,
    pvPct: (p) => p.gainPct,
    part: (p) => posShare(p),
    cible: (p) => p.asset.targetWeight,
    ecart: (p) => (p.asset.targetWeight != null ? posShare(p) - p.asset.targetWeight : null),
  });
  const isPea = s.account.kind === "pea" || s.account.kind === "pea_pme";
  const five = isPea ? fiscalAnniversary(s.account.openedOn, 5) : null;
  const advised = isPea ? advisedMonthlyPurchase(s.cash, s.account.monthsToInvest, monthsElapsed(params, pf.today)) : 0;
  const targets = pf.idx.activeAssets.filter((a) => a.targetWeight && (a.kind === "etf" || a.kind === "action" || a.kind === "fonds"));
  const split = splitByTarget(
    advised,
    targets.map((a) => ({ assetId: a.id, value: equities.find((p) => p.asset.id === a.id)?.value ?? 0, target: a.targetWeight ?? 0 })),
  );
  const [s1, s2] = params.alerts.stressEquity;
  const share = pf.state.totals.value > 0 ? s.value / pf.state.totals.value : 0;
  const ter = equities.reduce((t, p) => t + p.value * (p.asset.ter ?? 0), 0);
  const missing = equities.filter((p) => p.priceUsed === "cout");
  const inst = s.account.institutionId ? pf.idx.institutionById.get(s.account.institutionId) : undefined;
  const fees = tradeFeeFor(s.account, pf.idx.institutionById, params);

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <span>
          {s.account.name} {inst && <span className="font-normal text-fg-muted">· {inst.name}</span>}
        </span>
        <EditAccountButton account={s.account} />
        <EvolutionToggle open={showEvolution} onToggle={() => setShowEvolution(!showEvolution)} />
      </h2>
      {showEvolution && (
        <div className="mb-5">
          <AccountEvolution accountIds={[s.account.id]} />
        </div>
      )}
      <StatGrid>
        <Stat label="Valeur totale" sub={<>{(share * 100).toFixed(1).replace(".", ",")} % du patrimoine</>}>
          <Amount value={s.value} compact />
        </Stat>
        <Stat label="Gain / perte" sub={<>versé net <Amount value={s.netContrib} compact /></>}>
          <Amount value={s.gain} signed compact />
        </Stat>
        <Stat label="Espèces à investir" tone={s.cash >= params.alerts.peaCashThreshold ? "warning" : s.cash < -0.01 ? "negative" : undefined} sub={<>versement mensuel <Amount value={s.currentMonthly} compact /></>}>
          <Amount value={s.cash} compact />
        </Stat>
        {isPea ? (
          <Stat label="Fiscalité allégée (5 ans)">{five ? (five <= pf.today ? <Badge tone="positive">depuis le {formatDate(five)}</Badge> : formatDate(five)) : <span className="text-sm text-fg-faint">date d'ouverture à renseigner</span>}</Stat>
        ) : (
          <Stat label="Frais payés">
            <Amount value={s.fees} />
          </Stat>
        )}
      </StatGrid>

      {missing.length > 0 && (
        <div className="mb-4">
          <Notice tone="warning">⚠ Cours indisponible pour {missing.map((p) => p.asset.name).join(", ")} : la valeur affichée est le prix de revient. Saisissez le cours à la main en attendant.</Notice>
        </div>
      )}

      <Table className="mb-5">
        <thead>
          <tr>
            <SortTh {...by("titre")}>Titre</SortTh>
            <SortTh {...by("parts")} align="right">
              Parts
            </SortTh>
            <SortTh {...by("pru")} align="right">
              PRU
            </SortTh>
            <SortTh {...by("investi")} align="right">
              Investi
            </SortTh>
            <SortTh {...by("cours")} align="right">
              Cours
            </SortTh>
            <SortTh {...by("valeur")} align="right">
              Valeur
            </SortTh>
            <SortTh {...by("pv")} align="right">
              Plus-value
            </SortTh>
            <SortTh {...by("pvPct")} align="right">
              Plus-value (%)
            </SortTh>
            <SortTh {...by("part")} align="right">
              Part réelle
            </SortTh>
            <SortTh {...by("cible")} align="right">
              Cible
            </SortTh>
            <SortTh {...by("ecart")} align="right">
              Écart
            </SortTh>
          </tr>
        </thead>
        <tbody>
          {equities.length === 0 && <EmptyRow cols={11}>Aucune position. Saisissez vos achats dans le journal.</EmptyRow>}
          {sorted.map((p) => (
            <PositionRow key={p.asset.id} p={p} total={equityValue} onPrice={onPrice} />
          ))}
          {equities.length > 0 && (
            <tr className="bg-surface-2/60 font-medium">
              <Td>Total</Td>
              <Td />
              <Td />
              <Td align="right">
                <Amount value={equities.reduce((t, p) => t + p.cost, 0)} />
              </Td>
              <Td />
              <Td align="right">
                <Amount value={equityValue} />
              </Td>
              <Td align="right">
                <Amount value={equities.reduce((t, p) => t + p.gain, 0)} signed />
              </Td>
              <Td align="right">
                <Pct value={(() => { const cost = equities.reduce((t, p) => t + p.cost, 0); return cost > 0 ? equities.reduce((t, p) => t + p.gain, 0) / cost : null; })()} signed />
              </Td>
              <Td align="right">100 %</Td>
              <Td align="right">
                <Pct value={equities.reduce((t, p) => t + (p.asset.targetWeight ?? 0), 0)} />
              </Td>
              <Td />
            </tr>
          )}
        </tbody>
      </Table>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        {isPea && (
          <Card>
            <CardTitle hint={`sur ${s.account.monthsToInvest ?? 1} mois`}>Achat conseillé ce mois-ci</CardTitle>
            <div className="text-2xl font-semibold">
              <Amount value={advised} />
            </div>
            {split.size > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {[...split.entries()]
                  .filter(([, v]) => v > 0)
                  .map(([id, v]) => (
                    <li key={id} className="flex justify-between gap-2">
                      <span className="truncate text-fg-muted">{pf.idx.assetById.get(id)?.name}</span>
                      <Amount value={v} />
                    </li>
                  ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-fg-faint">Les espèces sont étalées sur la durée choisie, puis réparties pour se rapprocher des parts cibles.</p>
          </Card>
        )}
        <Card>
          <CardTitle>Si les actions baissent</CardTitle>
          {[s1, s2].map((d) => (
            <div key={d} className="flex justify-between py-1 text-sm">
              <span className="text-fg-muted">de {Math.round(d * 100)} %</span>
              <span>
                <Amount value={-d * equityValue} signed /> <span className="text-fg-faint">({((-d * equityValue * 100) / (pf.state.totals.value || 1)).toFixed(1).replace(".", ",")} % du patrimoine)</span>
              </span>
            </div>
          ))}
          <p className="mt-2 text-xs text-fg-faint">Une baisse n'est une perte que si l'on vend.</p>
        </Card>
        <Card>
          <CardTitle>Frais</CardTitle>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-fg-muted">Courtage payé (total)</span>
            <Amount value={s.fees} />
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="shrink-0 text-fg-muted">{fees.source.label}</span>
            <span className="text-right">{fees.order ? describeOrderFees(fees.order) : "—"}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-fg-muted">Frais de gestion des ETF / an</span>
            <Amount value={ter} />
          </div>
        </Card>
      </div>
      <Movements accountIds={[s.account.id]} limit={15} type="achat" assetKinds={isPea ? undefined : ["etf", "action", "fonds"]} accountKinds={["pea", "pea_pme", "cto", "assurance_vie", "per", "epargne_salariale"]} title={s.account.kind === "pea" ? "Mouvements" : "Mouvements (actions, ETF et espèces)"} />
    </section>
  );
}

function PositionRow({ p, total, onPrice }: { p: PositionState; total: number; onPrice: (a: Asset) => void }) {
  const share = total > 0 ? p.value / total : 0;
  const target = p.asset.targetWeight;
  return (
    <Tr className="group">
      <Td className="font-medium">
        {p.asset.name}
        {p.asset.isin && <div className="font-mono text-xs font-normal text-fg-faint">{p.asset.isin}</div>}
      </Td>
      <Td align="right">{formatQty(p.quantity)}</Td>
      <Td align="right">
        <Amount value={p.pru} />
      </Td>
      <Td align="right">
        <Amount value={p.cost} />
      </Td>
      <Td align="right">
        <button className="inline-flex items-center gap-1.5 hover:text-accent" onClick={() => onPrice(p.asset)} title="Saisir le cours à la main">
          <Amount value={p.price} />
          <RefreshCw size={11} className="text-fg-faint opacity-0 group-hover:opacity-100" />
        </button>
        <div className="text-[11px] text-fg-faint">
          {PRICE_LABEL[p.priceUsed]}
          {p.priceDate ? ` · ${formatDate(p.priceDate)}` : ""}
        </div>
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
      <Td align="right">
        <Pct value={share} />
      </Td>
      <Td align="right">
        <Pct value={target} />
      </Td>
      <Td align="right">{target != null ? <Pct value={share - target} signed /> : "—"}</Td>
    </Tr>
  );
}
