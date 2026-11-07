import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { LIVRET_LABELS, livretInterest, rateAt } from "@hamac/core";
import { AddAccountButton, EditAccountButton } from "@/components/AccountButtons";
import { Amount } from "@/components/Amount";
import { Field, PercentInput, Select, TextInput } from "@/components/form";
import { Movements } from "@/components/Movements";
import { Notice, Pct, Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { LivretsStatus } from "@/pages/Synthese";
import { Onboarding } from "@/pages/Onboarding";
import { cn } from "@/lib/cn";
import { formatDate, todayIso } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

export function Livrets() {
  const pf = usePortfolio();
  const year = +todayIso().slice(0, 4);

  const rows = useMemo(() => {
    if (!pf) return [];
    const { ws } = pf.idx;
    return pf.state.accounts
      .filter((a) => a.account.kind === "livret" && !a.account.archived)
      .map((a) => {
        const current = rateAt(ws.accountRates, a.account.id, pf.today);
        const interest = livretInterest(a.account.id, year, { transactions: ws.transactions, plans: ws.plans, skips: ws.skips, startMonth: ws.params.profile.startMonth }, ws.accountRates, a.account.rate, pf.today);
        return { s: a, rate: current?.rate ?? a.account.rate, rateFrom: current?.fromDate ?? null, interest };
      });
  }, [pf, year]);

  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;

  const total = rows.reduce((t, r) => t + r.s.value, 0);
  const estimated = rows.reduce((t, r) => t + r.interest.estimated, 0);
  const earned = rows.reduce((t, r) => t + r.interest.earnedToDate, 0);
  const avgRate = total > 0 ? rows.reduce((t, r) => t + r.s.value * (r.rate ?? 0), 0) / total : null;
  const order = [...rows].sort((a, b) => a.s.account.sortOrder - b.s.account.sortOrder).map((r) => `${r.s.account.name}${r.s.account.depositCeiling ? ` (${r.s.account.depositCeiling.toLocaleString("fr-FR")} €)` : ""}`);

  return (
    <>
      <PageHeader
        title="Livrets"
        description="Épargne de précaution. Créez vos livrets avec leur taux ; les mouvements se saisissent dans le Journal."
        actions={<AddAccountButton kind="livret" label="Ajouter un livret" />}
      />
      {rows.length === 0 ? (
        <Notice>Aucun livret pour l'instant. « Ajouter un livret » : type (LEP, LDDS, Livret A…), établissement, taux actuel et plafond.</Notice>
      ) : (
        <>
          <StatGrid>
            <Stat label="Total des livrets" sub={<>fourchette du plan <Amount value={pf.state.livrets.floor} compact /> – <Amount value={pf.state.livrets.ceiling} compact /></>}>
              <Amount value={total} compact />
            </Stat>
            <Stat label="Taux moyen pondéré">
              <Pct value={avgRate} digits={2} />
            </Stat>
            <Stat label={`Intérêts estimés ${year}`} sub="règle des quinzaines, versements programmés compris">
              <Amount value={estimated} compact />
            </Stat>
            <Stat label="Intérêts acquis à ce jour" sub={`crédités le 31/12/${year}`}>
              <Amount value={earned} compact />
            </Stat>
          </StatGrid>
          <div className="mb-6">
            <LivretsStatus />
          </div>

          <Table className="mb-2">
            <thead>
              <tr>
                <Th>Livret</Th>
                <Th>Établissement</Th>
                <Th align="right">Taux actuel</Th>
                <Th align="right">Plafond</Th>
                <Th align="right">Versement mensuel</Th>
                <Th align="right">Solde</Th>
                <Th align="right">Marge avant plafond</Th>
                <Th align="right">Intérêts {year}</Th>
                <Th align="right">Intérêts encaissés</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s: a, rate, rateFrom, interest }) => {
                const margin = a.account.depositCeiling != null ? a.account.depositCeiling - a.value : null;
                return (
                  <Tr key={a.account.id}>
                    <Td className="font-medium">
                      {a.account.name}
                      {a.account.livretType && a.account.livretType !== "AUTRE" && a.account.name !== LIVRET_LABELS[a.account.livretType] && <span className="text-fg-muted"> · {LIVRET_LABELS[a.account.livretType]}</span>}
                      {a.account.role && <div className="max-w-56 text-xs font-normal text-fg-faint">{a.account.role}</div>}
                    </Td>
                    <Td className="text-fg-muted">{(a.account.institutionId && pf.idx.institutionById.get(a.account.institutionId)?.name) || "—"}</Td>
                    <Td align="right">
                      <Pct value={rate} digits={2} />
                      {rateFrom && <div className="text-[11px] text-fg-faint">depuis le {formatDate(rateFrom)}</div>}
                    </Td>
                    <Td align="right">
                      <Amount value={a.account.depositCeiling} compact />
                    </Td>
                    <Td align="right">
                      <Amount value={a.currentMonthly} compact />
                    </Td>
                    <Td align="right" className="font-medium">
                      <Amount value={a.value} />
                    </Td>
                    <Td align="right" className={cn(margin != null && margin < 0 && "text-negative")} title={margin != null && margin < 0 ? "Au-delà du plafond de dépôt (les intérêts capitalisés peuvent légalement le dépasser)" : undefined}>
                      <Amount value={margin} compact />
                    </Td>
                    <Td align="right">
                      <Amount value={interest.estimated} />
                      <div className="text-[11px] text-fg-faint">
                        dont acquis <Amount value={interest.earnedToDate} compact />
                      </div>
                    </Td>
                    <Td align="right">
                      <Amount value={a.interests} />
                    </Td>
                    <Td className="w-10">
                      <EditAccountButton account={a.account} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          {order.length > 1 && <p className="mb-6 text-xs text-fg-faint">Ordre de remplissage : {order.join(" → ")}.</p>}
          <RateHistory accounts={rows.map((r) => r.s.account)} />
          <div className="mt-6">
            <Movements accountIds={rows.map((r) => r.s.account.id)} />
          </div>
        </>
      )}
    </>
  );
}

/** Historique des taux : chaque changement de taux, à partir de sa date. */
function RateHistory({ accounts }: { accounts: Array<{ id: string; name: string }> }) {
  const pf = usePortfolio();
  const set = useMutate("accountRates.set", { success: "Taux enregistré" });
  const del = useMutate("accountRates.delete");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [fromDate, setFromDate] = useState(todayIso());
  const [rate, setRate] = useState<number | null>(null);
  const rates = (pf?.idx.ws.accountRates ?? []).filter((r) => accounts.some((a) => a.id === r.accountId)).sort((a, b) => b.fromDate.localeCompare(a.fromDate));
  const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";
  return (
    <Card>
      <CardTitle hint="les taux réglementés changent souvent au 1er février et au 1er août">Historique des taux</CardTitle>
      <form
        className="mb-4 grid items-end gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const target = accountId || accounts[0]?.id;
          if (target && rate != null) set.mutate({ accountId: target, fromDate, rate }, { onSuccess: () => setRate(null) });
        }}
      >
        <Field label="Livret">
          {(id) => (
            <Select id={id} value={accountId || accounts[0]?.id} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nouveau taux à partir du">{(id) => <TextInput id={id} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />}</Field>
        <Field label="Taux">{(id) => <PercentInput id={id} value={rate} onChange={setRate} />}</Field>
        <Button type="submit" disabled={rate == null || !fromDate}>
          Enregistrer
        </Button>
      </form>
      <Table>
        <thead>
          <tr>
            <Th>Livret</Th>
            <Th>À partir du</Th>
            <Th align="right">Taux</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rates.length === 0 && <EmptyRow cols={4}>Aucun taux enregistré.</EmptyRow>}
          {rates.map((r) => (
            <Tr key={r.id} className="group">
              <Td>{name(r.accountId)}</Td>
              <Td>{formatDate(r.fromDate)}</Td>
              <Td align="right">
                <Pct value={r.rate} digits={2} />
              </Td>
              <Td className="w-8">
                <button className="text-fg-faint opacity-0 group-hover:opacity-100 hover:text-negative" onClick={() => del.mutate({ id: r.id })} aria-label="Supprimer">
                  <Trash2 size={13} />
                </button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
