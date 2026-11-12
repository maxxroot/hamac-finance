import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { accountAgeYears, fiscalAnniversary, holdsEuroFunds, monthsBetween, reconcile, type AccountState, type Asset, type FundRate, type PositionState } from "@hamac/core";
import { EditAccountButton } from "@/components/AccountButtons";
import { AddTransactionButton, EmptyAccount } from "@/components/TransactionButton";
import { AccountEvolution, EvolutionToggle } from "@/components/AccountEvolution";
import { Amount } from "@/components/Amount";
import { Field, FormGrid, MoneyInput, NumberInput, PercentInput, TextInput } from "@/components/form";
import { Movements } from "@/components/Movements";
import { Pct, Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { NEW_FUND_PRESET } from "@/dialogs/TransactionDialog";
import { formatDate, todayIso } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

export function FondsEuros() {
  const pf = usePortfolio();
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const contracts = pf.state.accounts.filter((a) => holdsEuroFunds(a.account.kind) && !a.account.archived);
  return (
    <>
      <PageHeader
        title="Fonds euros"
        description="Le support à capital garanti de vos contrats d'assurance-vie et de PER. Les mouvements se saisissent dans le journal ; ici : chaque contrat, sa valeur relevée, et le solde et les taux servis de chacun de ses fonds euros."
        actions={contracts.length > 0 && <AddTransactionButton accountId={contracts[0].account.id} type="versement" />}
      />
      {contracts.length === 0 && (
        <EmptyAccount kind="assurance_vie" label="Ajouter un contrat">
          Aucun contrat d'assurance-vie : créez-le avec son établissement, sa date d'ouverture (règle des 8 ans) et sa clause bénéficiaire.
        </EmptyAccount>
      )}
      <div className="space-y-8">
        {contracts.map((c) => (
          <Contract key={c.account.id} s={c} />
        ))}
      </div>
    </>
  );
}

function Contract({ s }: { s: AccountState }) {
  const [showEvolution, setShowEvolution] = useState(false);
  const pf = usePortfolio()!;
  const { account } = s;
  const today = pf.today;
  const eight = fiscalAnniversary(account.openedOn, 8);
  const ageY = accountAgeYears(account.openedOn, today);
  const ageM = account.openedOn ? monthsBetween(account.openedOn, today) % 12 : null;
  const fgap = pf.data.params.alerts.fgapGuarantee;
  const inst = account.institutionId ? pf.idx.institutionById.get(account.institutionId) : undefined;
  const offer = inst?.offers.assurance_vie;
  const isLifeInsurance = account.kind === "assurance_vie";
  // Fonds euros du contrat : son support par défaut, ceux qui ont un solde et ceux qui ont des taux saisis.
  const rates = pf.idx.ws.fundRates.filter((r) => r.accountId === account.id);
  const fundIds = [...new Set([account.defaultAssetId, ...s.positions.filter((p) => p.asset.kind === "fonds_euros").map((p) => p.asset.id), ...rates.map((r) => r.assetId)].filter((x): x is string => !!x))];
  const funds = fundIds.flatMap((id) => pf.idx.assetById.get(id) ?? []);

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <span>
          {account.name} {inst && <span className="font-normal text-fg-muted">· {inst.name}</span>}
        </span>
        <EditAccountButton account={account} />
        <EvolutionToggle open={showEvolution} onToggle={() => setShowEvolution(!showEvolution)} />
      </h2>
      {showEvolution && (
        <div className="mb-5">
          <AccountEvolution accountIds={[account.id]} />
        </div>
      )}
      <StatGrid>
        <Stat label="Valeur calculée">
          <Amount value={s.value} compact />
        </Stat>
        <Stat label="Versé net">
          <Amount value={s.netContrib} compact />
        </Stat>
        <Stat label="Gain cumulé" sub={<>dont intérêts <Amount value={s.interests} compact /></>}>
          <Amount value={s.gain} signed compact />
        </Stat>
        <Stat label="Versement mensuel">
          <Amount value={s.currentMonthly} compact />
        </Stat>
      </StatGrid>

      <div className="mb-5 grid gap-5 @3xl:grid-cols-3">
        <Card>
          <CardTitle>Contrat</CardTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-fg-muted">Ouvert le</dt>
            <dd>{formatDate(account.openedOn)}</dd>
            <dt className="text-fg-muted">Ancienneté</dt>
            <dd>{ageY != null ? `${ageY} an${ageY > 1 ? "s" : ""} et ${ageM} mois` : "—"}</dd>
            {isLifeInsurance && (
              <>
                <dt className="text-fg-muted">Fiscalité allégée</dt>
                <dd>{eight ? (eight <= today ? <Badge tone="positive">depuis le {formatDate(eight)}</Badge> : `le ${formatDate(eight)} (8 ans)`) : "renseigner la date d'ouverture"}</dd>
                <dt className="text-fg-muted">Clause bénéficiaire</dt>
                <dd>{account.beneficiaryClause ? <Badge tone="positive">rédigée</Badge> : <Badge tone="accent">à rédiger</Badge>}</dd>
              </>
            )}
            <dt className="text-fg-muted">Garantie FGAP</dt>
            <dd>
              marge de <Amount value={fgap - s.value} compact /> sous {fgap.toLocaleString("fr-FR")} €
            </dd>
            {isLifeInsurance && <dt className="text-fg-muted">Frais</dt>}
            {isLifeInsurance && <dd>
              {offer ? (
                <>
                  versements <Pct value={offer.entryFee} digits={2} /> · gestion <Pct value={offer.euroFee} digits={2} /> / an
                </>
              ) : (
                <span className="text-fg-faint">à renseigner dans Paramètres › Établissements</span>
              )}
            </dd>}
          </dl>
        </Card>
        <Reconciliation s={s} />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg-muted">Fonds euros du contrat</h3>
        <AddTransactionButton accountId={account.id} type="versement" assetId={NEW_FUND_PRESET} variant="ghost" label="Verser sur un autre fonds euros" />
      </div>
      {funds.length === 0 && (
        <p className="mb-5 text-sm text-fg-muted">Aucun fonds euros : l'argent du contrat hors unités de compte reste en espèces. Choisissez son fonds euros dans la fiche du contrat (crayon).</p>
      )}
      <div className="mb-5 grid gap-5 @3xl:grid-cols-2">
        {funds.map((f) => (
          <FundCard key={f.id} s={s} fund={f} position={s.positions.find((p) => p.asset.id === f.id)} rates={rates.filter((r) => r.assetId === f.id)} />
        ))}
      </div>
      <Movements accountIds={[account.id]} limit={15} />
    </section>
  );
}

function Reconciliation({ s }: { s: AccountState }) {
  const save = useMutate("statements.upsert", { success: "Relevé enregistré" });
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const pf = usePortfolio();
  // Écart calculé à la date du relevé, et non avec la valeur du jour.
  const row = useMemo(() => (pf ? reconcile(pf.data, pf.today).find((r) => r.account.id === s.account.id) : undefined), [pf, s.account.id]);
  const gap = row?.valueGap ?? null;
  return (
    <Card>
      <CardTitle>Contrôle avec le relevé</CardTitle>
      {s.lastStatement ? (
        <div className="mb-4 text-sm">
          Relevé du {formatDate(s.lastStatement.date)} : <Amount value={s.lastStatement.value} />
          <div className="mt-1">
            {gap != null && Math.abs(gap) >= 1 ? (
              <span className="text-warning">
                Écart de <Amount value={gap} signed /> à la date du relevé : saisir une « Correction » dans le journal.
              </span>
            ) : (
              <span className="text-positive">✓ Concorde avec le calcul</span>
            )}
          </div>
        </div>
      ) : (
        <p className="mb-4 text-sm text-fg-muted">Relevez la valeur sur le site de l'assureur pour vérifier le calcul.</p>
      )}
      <FormGrid>
        <Field label="Valeur relevée">{(id) => <MoneyInput id={id} value={value} onChange={setValue} />}</Field>
        <Field label="Le">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      </FormGrid>
      <Button className="mt-3 w-full" disabled={value == null} onClick={() => value != null && save.mutate({ accountId: s.account.id, date, value }, { onSuccess: () => setValue(null) })}>
        Enregistrer le relevé
      </Button>
    </Card>
  );
}

/** Un fonds euros dans un contrat : solde, intérêts reçus et taux servis année par année. */
function FundCard({ s, fund, position, rates }: { s: AccountState; fund: Asset; position: PositionState | undefined; rates: FundRate[] }) {
  const pf = usePortfolio()!;
  const { account } = s;
  const isDefault = account.defaultAssetId === fund.id;
  const avgRate = rates.length ? rates.reduce((t, r) => t + r.rate, 0) / rates.length : null;
  // Mêmes règles que le calcul : les intérêts sans support vont au fonds par défaut ; un coupon d'obligation n'en est pas.
  const interestsByYear = (year: number) =>
    pf.idx.ws.transactions
      .filter((t) => t.accountId === account.id && t.type === "interets" && t.date.startsWith(`${year}-`) && (t.assetId === fund.id || (t.assetId == null && isDefault)))
      .reduce((t, x) => t + x.amount, 0);
  return (
    <Card>
      <CardTitle hint={isDefault ? <Badge tone="positive">support par défaut</Badge> : undefined}>{fund.name}</CardTitle>
      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-fg-muted">Solde</dt>
        <dd>
          <Amount value={position?.value ?? 0} />
        </dd>
        <dt className="text-fg-muted">Intérêts reçus</dt>
        <dd>
          <Amount value={position?.income ?? 0} />
        </dd>
        <dt className="text-fg-muted">Taux moyen servi</dt>
        <dd>
          <Pct value={avgRate} /> <span className="text-fg-faint">(hypothèse du plan <Pct value={pf.data.params.returns.fondsEuros} />)</span>
        </dd>
      </dl>
      <RatesCard accountId={account.id} assetId={fund.id} rates={rates} interestsByYear={interestsByYear} />
    </Card>
  );
}

function RatesCard({ accountId, assetId, rates, interestsByYear }: { accountId: string; assetId: string; rates: Array<{ year: number; rate: number; comment: string }>; interestsByYear: (y: number) => number }) {
  const set = useMutate("fundRates.set", { success: "Taux enregistré" });
  const del = useMutate("fundRates.delete");
  const [year, setYear] = useState<number | null>(new Date().getFullYear() - 1);
  const [rate, setRate] = useState<number | null>(null);
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium text-fg-muted">Taux servis</h4>
      <Table className="mb-3">
        <thead>
          <tr>
            <Th>Année</Th>
            <Th align="right">Taux net</Th>
            <Th align="right">Intérêts saisis</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rates.length === 0 && <EmptyRow cols={4}>Aucun taux saisi.</EmptyRow>}
          {rates.map((r) => (
            <Tr key={r.year} className="group">
              <Td>{r.year}</Td>
              <Td align="right">
                <Pct value={r.rate} />
              </Td>
              <Td align="right">
                <Amount value={interestsByYear(r.year)} />
              </Td>
              <Td className="w-8">
                <button className="text-fg-faint opacity-0 group-hover:opacity-100 hover:text-negative" onClick={() => del.mutate({ accountId, assetId, year: r.year })} aria-label="Supprimer">
                  <Trash2 size={13} />
                </button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <Field label="Année">{(id) => <NumberInput id={id} decimals={0} grouping={false} value={year} onChange={setYear} />}</Field>
        <Field label="Taux">{(id) => <PercentInput id={id} value={rate} onChange={setRate} />}</Field>
        <Button disabled={year == null || rate == null} onClick={() => year != null && rate != null && set.mutate({ accountId, assetId, year, rate }, { onSuccess: () => setRate(null) })}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
