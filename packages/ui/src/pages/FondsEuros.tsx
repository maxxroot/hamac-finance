import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { accountAgeYears, fiscalAnniversary, monthsBetween, reconcile, type AccountState } from "@hamac/core";
import { EditAccountButton } from "@/components/AccountButtons";
import { AddTransactionButton, EmptyEnvelope } from "@/components/TransactionButton";
import { AccountEvolution, EvolutionToggle } from "@/components/AccountEvolution";
import { Amount } from "@/components/Amount";
import { Field, FormGrid, MoneyInput, NumberInput, PercentInput, TextInput } from "@/components/form";
import { Movements } from "@/components/Movements";
import { Pct, Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { formatDate, todayIso } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

export function FondsEuros() {
  const pf = usePortfolio();
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const contracts = pf.state.accounts.filter((a) => a.account.kind === "assurance_vie" && !a.account.archived);
  return (
    <>
      <PageHeader
        title="Fonds euros"
        description="Assurance-vie, capital garanti. Les mouvements se saisissent dans le journal ; ici : fiche du contrat, valeur relevée et taux servis."
        actions={contracts.length > 0 && <AddTransactionButton accountId={contracts[0].account.id} type="versement" />}
      />
      {contracts.length === 0 && (
        <EmptyEnvelope kind="assurance_vie" label="Ajouter un contrat">
          Aucun contrat d'assurance-vie : créez-le avec son établissement, sa date d'ouverture (règle des 8 ans) et sa clause bénéficiaire.
        </EmptyEnvelope>
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
  const rates = pf.idx.ws.fundRates.filter((r) => r.accountId === account.id);
  const avgRate = rates.length ? rates.reduce((t, r) => t + r.rate, 0) / rates.length : null;
  const interestsByYear = (year: number) => pf.idx.ws.transactions.filter((t) => t.accountId === account.id && t.type === "interets" && t.date.startsWith(`${year}-`)).reduce((t, x) => t + x.amount, 0);

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
            <dt className="text-fg-muted">Fiscalité allégée</dt>
            <dd>{eight ? (eight <= today ? <Badge tone="positive">depuis le {formatDate(eight)}</Badge> : `le ${formatDate(eight)} (8 ans)`) : "renseigner la date d'ouverture"}</dd>
            <dt className="text-fg-muted">Clause bénéficiaire</dt>
            <dd>{account.beneficiaryClause ? <Badge tone="positive">rédigée</Badge> : <Badge tone="accent">à rédiger</Badge>}</dd>
            <dt className="text-fg-muted">Garantie FGAP</dt>
            <dd>
              marge de <Amount value={fgap - s.value} compact /> sous {fgap.toLocaleString("fr-FR")} €
            </dd>
            <dt className="text-fg-muted">Frais</dt>
            <dd>
              {offer ? (
                <>
                  versements <Pct value={offer.entryFee} digits={2} /> · gestion <Pct value={offer.euroFee} digits={2} /> / an
                </>
              ) : (
                <span className="text-fg-faint">à renseigner dans Paramètres › Établissements</span>
              )}
            </dd>
            <dt className="text-fg-muted">Taux moyen servi</dt>
            <dd>
              <Pct value={avgRate} /> <span className="text-fg-faint">(hypothèse du plan <Pct value={pf.data.params.returns.fondsEuros} />)</span>
            </dd>
          </dl>
        </Card>
        <Reconciliation s={s} />
        <RatesCard accountId={account.id} rates={rates} interestsByYear={interestsByYear} />
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

function RatesCard({ accountId, rates, interestsByYear }: { accountId: string; rates: Array<{ year: number; rate: number; comment: string }>; interestsByYear: (y: number) => number }) {
  const set = useMutate("fundRates.set", { success: "Taux enregistré" });
  const del = useMutate("fundRates.delete");
  const [year, setYear] = useState<number | null>(new Date().getFullYear() - 1);
  const [rate, setRate] = useState<number | null>(null);
  return (
    <Card>
      <CardTitle>Taux servis</CardTitle>
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
                <button className="text-fg-faint opacity-0 group-hover:opacity-100 hover:text-negative" onClick={() => del.mutate({ accountId, year: r.year })} aria-label="Supprimer">
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
        <Button disabled={year == null || rate == null} onClick={() => year != null && rate != null && set.mutate({ accountId, year, rate }, { onSuccess: () => setRate(null) })}>
          Ajouter
        </Button>
      </div>
    </Card>
  );
}
