import { CalendarX2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Schedule, addMonth, monthOf, monthsBetweenInclusive, retirementYear, type Account } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { ContributionSplitCard } from "@/components/CustomAllocationCards";
import { Field, MoneyInput, Select, TextInput } from "@/components/form";
import { Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { cn } from "@/lib/cn";
import { capitalize, formatMonth, todayIso } from "@/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

export function Versements() {
  const idx = useWorkspaceIndex();
  const [showAll, setShowAll] = useState(false);
  const today = todayIso();
  const current = monthOf(today);

  const schedule = useMemo(() => (idx ? new Schedule(idx.ws.plans, idx.ws.skips, idx.ws.params.profile.startMonth, idx.ws.params.profile.contributionDay) : null), [idx]);

  if (!idx || !schedule) return null;
  if (idx.ws.accounts.length === 0) return <Onboarding />;

  const { params } = idx.ws;
  const withPlans = idx.activeAccounts.filter((a) => idx.ws.plans.some((p) => p.accountId === a.id));
  const endMonth = `${retirementYear(params)}-12`;
  const allMonths = monthsBetweenInclusive(params.profile.startMonth, endMonth);
  const months = showAll ? allMonths : allMonths.filter((m) => m >= addMonth(current, -3) && m <= addMonth(current, 14));
  const monthlyTotal = withPlans.reduce((s, a) => s + schedule.current(a.id, today), 0);
  const dueDay = Number(schedule.dueDate(current).slice(8));
  const paidThisMonth = schedule.isPaid(current, today);

  return (
    <>
      <PageHeader
        title="Versements"
        description="Versements mensuels programmés, compte par compte. Un mois écoulé est considéré comme versé, sauf s'il est déclaré manqué."
      />

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle hint={`Prélevés le ${params.profile.contributionDay} de chaque mois, à partir de ${formatMonth(params.profile.startMonth)} (Paramètres › Plan)`}>Programmation</CardTitle>
          <PlanForm accounts={idx.activeAccounts} defaultMonth={current < params.profile.startMonth ? params.profile.startMonth : current} />
          <div className="mt-5 space-y-3">
            {withPlans.length === 0 && <p className="text-sm text-fg-muted">Aucun versement programmé.</p>}
            {withPlans.map((a) => (
              <AccountPlans key={a.id} account={a} current={schedule.current(a.id, today)} />
            ))}
          </div>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardTitle>Ce mois-ci</CardTitle>
            <div className="text-3xl font-semibold tracking-tight">
              <Amount value={monthlyTotal} />
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {paidThisMonth ? "versés" : "prélevés"} le {dueDay} sur {withPlans.filter((a) => schedule.current(a.id, today) > 0).length} compte(s)
            </p>
          </Card>
          <SkipsCard accounts={withPlans} />
        </div>
      </div>

      <ContributionSplitCard />

      <Card className="p-0">
        <div className="flex min-h-14 items-center justify-between px-5 pt-3 pb-1">
          <h2 className="text-sm font-medium text-fg-muted">Calendrier</h2>
          {withPlans.length > 0 && (
            <Button variant="ghost" className="-mr-3 h-8 text-accent" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Afficher autour d'aujourd'hui" : `Tout afficher (${allMonths.length} mois)`}
            </Button>
          )}
        </div>
        {withPlans.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-fg-muted">Programmez un premier versement pour voir le calendrier.</p>
        ) : (
          <div className="max-h-[560px] overflow-y-auto">
            <Table className="rounded-none border-x-0 border-b-0">
              <thead>
                <tr>
                  <Th className="w-full pl-5">Mois</Th>
                  <Th align="right">Âge</Th>
                  {withPlans.map((a) => (
                    <Th key={a.id} align="right">
                      {a.name}
                    </Th>
                  ))}
                  <Th align="right">Total</Th>
                  <Th align="right" className="pr-5">État</Th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const total = withPlans.reduce((s, a) => s + schedule.amount(a.id, m), 0);
                  const past = m < current;
                  const isCurrent = m === current;
                  return (
                    <Tr key={m} className={cn(isCurrent && "bg-accent/10", !past && !isCurrent && "text-fg-muted")}>
                      <Td className={cn("pl-5 whitespace-nowrap", isCurrent && "font-semibold text-accent")}>{capitalize(formatMonth(m))}</Td>
                      <Td align="right">{Number(m.slice(0, 4)) - params.profile.birthYear}</Td>
                      {withPlans.map((a) => {
                        const amount = schedule.amount(a.id, m);
                        const skipped = schedule.planned(a.id, m) > amount;
                        return (
                          <Td key={a.id} align="right" className={cn(skipped && "text-warning")} title={skipped ? "Mois manqué (tout ou partie)" : undefined}>
                            {amount ? <Amount value={amount} compact /> : <span className="text-fg-faint">–</span>}
                          </Td>
                        );
                      })}
                      <Td align="right" className="font-medium">
                        <Amount value={total} compact />
                      </Td>
                      <Td align="right" className="pr-5 whitespace-nowrap">
                        {schedule.isPaid(m, today) ? <Badge tone="positive">✓ versé</Badge> : <span className="text-xs">à venir</span>}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}

function PlanForm({ accounts, defaultMonth }: { accounts: Account[]; defaultMonth: string }) {
  const set = useMutate("plans.set", { success: "Versement programmé" });
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [month, setMonth] = useState(defaultMonth);
  const [amount, setAmount] = useState<number | null>(null);
  return (
    <form
      className="grid items-end gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!accountId || amount == null) return;
        set.mutate({ accountId, fromMonth: month, amount }, { onSuccess: () => setAmount(null) });
      }}
    >
      <Field label="Compte">
        {(id) => (
          <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="À partir de">{(id) => <TextInput id={id} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>
      <Field label="Montant par mois">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>
      <Button variant="primary" type="submit" disabled={set.isPending || amount == null}>
        Programmer
      </Button>
      <p className="text-xs text-fg-faint sm:col-span-4">Le nouveau montant s'applique à partir du mois choisi ; 0 arrête le versement.</p>
    </form>
  );
}

function AccountPlans({ account, current }: { account: Account; current: number }) {
  const idx = useWorkspaceIndex();
  const del = useMutate("plans.delete");
  const plans = idx?.ws.plans.filter((p) => p.accountId === account.id) ?? [];
  return (
    <div className="rounded-xl border border-line bg-surface-2/50 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{account.name}</span>
        <span className="text-sm text-fg-muted">
          actuellement <Amount value={current} className="text-fg" /> / mois
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {plans.map((p) => (
          <span key={p.id} className="group inline-flex items-center gap-2 rounded-lg bg-surface-3 px-2.5 py-1 text-xs">
            <span className="text-fg-muted">dès {formatMonth(p.fromMonth)}</span>
            <Amount value={p.amount} compact />
            <button className="text-fg-faint hover:text-negative" aria-label="Supprimer" onClick={() => del.mutate({ id: p.id })}>
              <Trash2 size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function SkipsCard({ accounts }: { accounts: Account[] }) {
  const idx = useWorkspaceIndex();
  const add = useMutate("skips.upsert", { success: "Mois manqué enregistré" });
  const del = useMutate("skips.delete");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [month, setMonth] = useState(monthOf(todayIso()));
  const [amount, setAmount] = useState<number | null>(null);
  const skips = idx?.ws.skips ?? [];
  return (
    <Card>
      <CardTitle>
        <span className="inline-flex items-center gap-2">
          <CalendarX2 size={15} /> Mois manqués
        </span>
      </CardTitle>
      {accounts.length === 0 ? (
        <p className="text-sm text-fg-muted">Rien à déclarer tant qu'aucun versement n'est programmé.</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const target = accountId || accounts[0]?.id;
            if (!target || amount == null) return;
            add.mutate({ accountId: target, month, amount }, { onSuccess: () => setAmount(null) });
          }}
        >
          <Select value={accountId || accounts[0]?.id} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <div className="grid gap-2">
            <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mois" />
            <MoneyInput value={amount} onChange={setAmount} placeholder="non versé" aria-label="Montant non versé" />
          </div>
          <Button type="submit" className="w-full" disabled={amount == null}>
            Déclarer
          </Button>
        </form>
      )}
      {skips.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {skips.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2">
              <span className="text-fg-muted">
                {capitalize(formatMonth(s.month))} · {idx?.accountById.get(s.accountId)?.name}
              </span>
              <span className="flex items-center gap-2">
                <Amount value={-s.amount} />
                <button className="text-fg-faint hover:text-negative" onClick={() => del.mutate({ id: s.id })} aria-label="Supprimer">
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
