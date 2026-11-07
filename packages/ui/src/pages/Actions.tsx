import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { advisedMonthlyPurchase, fiscalAnniversary, monthsElapsed, splitByTarget, type AccountState, type Asset, type PositionState } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Movements } from "@/components/Movements";
import { Notice, Pct, Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { PriceDialog } from "@/dialogs/PriceDialog";
import { Onboarding } from "@/pages/Onboarding";
import { formatDate, formatQty } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";

const PRICE_LABEL = { marche: "marché", manuel: "manuel", modele: "calculé", cout: "prix de revient" } as const;

export function Actions() {
  const pf = usePortfolio();
  const [pricing, setPricing] = useState<Asset | null>(null);
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const accounts = pf.state.accounts.filter((a) => (a.account.kind === "pea" || a.positions.some((p) => p.bucket === "croissance")) && !a.account.archived);
  return (
    <>
      <PageHeader title="Actions & ETF" description="Positions calculées depuis le journal. Le cours vient du fournisseur ; un cours saisi à la main l'emporte à date égale ou plus récente." />
      {accounts.length === 0 && <Notice>Aucun PEA ni position en actions.</Notice>}
      <div className="space-y-8">
        {accounts.map((a) => (
          <Envelope key={a.account.id} s={a} onPrice={setPricing} />
        ))}
      </div>
      <PriceDialog asset={pricing} onClose={() => setPricing(null)} />
    </>
  );
}

function Envelope({ s, onPrice }: { s: AccountState; onPrice: (a: Asset) => void }) {
  const pf = usePortfolio()!;
  const { params } = pf.data;
  const equities = s.positions.filter((p) => p.bucket === "croissance");
  const equityValue = equities.reduce((t, p) => t + p.value, 0);
  const isPea = s.account.kind === "pea";
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

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">
        {s.account.name} {s.account.institution && <span className="font-normal text-fg-muted">· {s.account.institution}</span>}
      </h2>
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
            <Th>Titre</Th>
            <Th align="right">Parts</Th>
            <Th align="right">PRU</Th>
            <Th align="right">Investi</Th>
            <Th align="right">Cours</Th>
            <Th align="right">Valeur</Th>
            <Th align="right">Plus-value</Th>
            <Th align="right">Part réelle</Th>
            <Th align="right">Cible</Th>
            <Th align="right">Écart</Th>
          </tr>
        </thead>
        <tbody>
          {equities.length === 0 && <EmptyRow cols={10}>Aucune position. Saisissez vos achats dans le journal.</EmptyRow>}
          {equities.map((p) => (
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
            <span className="text-fg-muted">Grille</span>
            <span>
              {(params.broker.feeRate * 100).toLocaleString("fr-FR")} % par ordre, min. {params.broker.minFee.toLocaleString("fr-FR")} €
            </span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-fg-muted">Frais de gestion des ETF / an</span>
            <Amount value={ter} />
          </div>
        </Card>
      </div>
      <Movements accountIds={[s.account.id]} limit={15} />
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
        <div className="text-[11px]">
          <Pct value={p.gainPct} signed />
        </div>
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
