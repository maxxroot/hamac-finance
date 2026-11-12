import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { proposeContributions, type PlanParams } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Field, MoneyInput, TextInput } from "@/shared/components/form";
import { EmptyRow, Table, Td, Th, Tr } from "@/shared/components/table";
import { Button, Card, CardTitle } from "@/shared/components/ui";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useToast } from "@/shared/lib/toast";
import { call } from "@/shared/lib/transport";
import { formatMonth } from "@/shared/lib/numbers";
import { WORKSPACE_KEY, useMutate } from "@/shared/lib/workspace";

/**
 * Gestion suggérée : la capacité d'épargne mensuelle est répartie entre les comptes selon
 * les allocations personnalisées, le matelas de précaution, puis l'allocation de base.
 * Les montants proposés s'appliquent en un clic au calendrier des versements.
 */
export function SuggestedContributions({ defaultFromMonth }: { defaultFromMonth: string }) {
  const pf = usePortfolio();
  const qc = useQueryClient();
  const toast = useToast();
  const saveParams = useMutate("params.update");
  const params = pf?.data.params;
  const [capacity, setCapacity] = useState<number | null>(params?.contributions.capacity || null);
  const [fromMonth, setFromMonth] = useState(defaultFromMonth);
  const [applying, setApplying] = useState(false);

  const proposal = useMemo(() => (pf && params && capacity ? proposeContributions(params, pf.state, capacity) : null), [pf, params, capacity]);
  if (!pf || !params) return null;
  const names = pf.idx.accountById;
  const changes = proposal?.lines.filter((l) => l.amount !== l.current) ?? [];
  const capacityChanged = (capacity ?? 0) !== params.contributions.capacity;

  const saveCapacity = (next: PlanParams["contributions"]) => saveParams.mutateAsync({ ...params, contributions: next });

  const apply = async () => {
    if (!proposal) return;
    setApplying(true);
    try {
      if (capacityChanged) await saveCapacity({ ...params.contributions, capacity: capacity ?? 0 });
      for (const l of changes) await call("plans.set", { accountId: l.accountId, fromMonth, amount: l.amount });
      await qc.invalidateQueries({ queryKey: WORKSPACE_KEY });
      toast("success", `Versements programmés à partir de ${formatMonth(fromMonth)}`);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle hint={<>répartie selon vos allocations (<Link to="/parametres?onglet=Répartition" className="text-accent hover:underline">Paramètres › Répartition</Link>)</>}>Ma capacité d'épargne</CardTitle>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Montant que je peux épargner chaque mois">{(id) => <MoneyInput id={id} value={capacity} onChange={setCapacity} />}</Field>
          <Button disabled={!capacityChanged || saveParams.isPending} onClick={() => saveCapacity({ ...params.contributions, capacity: capacity ?? 0 }).then(() => toast("success", "Capacité enregistrée"))}>
            Enregistrer
          </Button>
        </div>
        <p className="mt-2 text-xs text-fg-faint">
          Ordre de priorité : vos allocations personnalisées (part des versements), puis le matelas de précaution s'il est sous le plancher, puis l'allocation de base vers les classes d'actifs en retard sur leur cible.
        </p>
      </Card>

      <Card className="p-0">
        <div className="px-5 pt-5 pb-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-fg-muted">
            <Sparkles size={14} /> Répartition suggérée
          </h2>
        </div>
        <Table className="rounded-none border-x-0">
          <thead>
            <tr>
              <Th className="pl-5">Compte</Th>
              <Th align="right">Actuel</Th>
              <Th align="right">Suggéré</Th>
              <Th align="right">Écart</Th>
              <Th className="pr-5">Pourquoi</Th>
            </tr>
          </thead>
          <tbody>
            {!proposal && <EmptyRow cols={5}>Indiquez votre capacité d'épargne mensuelle pour voir la répartition.</EmptyRow>}
            {proposal?.lines.map((l) => {
              const gap = l.amount - l.current;
              return (
                <Tr key={l.accountId}>
                  <Td className="pl-5 whitespace-nowrap">{names.get(l.accountId)?.name}</Td>
                  <Td align="right" className="text-fg-muted">
                    <Amount value={l.current} />
                  </Td>
                  <Td align="right" className="font-medium">
                    <Amount value={l.amount} />
                  </Td>
                  <Td align="right" className={gap === 0 ? "text-fg-faint" : undefined}>
                    {gap === 0 ? "=" : <Amount value={gap} signed />}
                  </Td>
                  <Td className="pr-5 text-xs text-fg-muted">{l.reasons.length ? l.reasons.join(" · ") : l.amount === 0 ? "Plus de versement suggéré" : ""}</Td>
                </Tr>
              );
            })}
            {proposal && (
              <Tr className="font-medium">
                <Td className="pl-5">Total</Td>
                <Td align="right" className="text-fg-muted">
                  <Amount value={proposal.lines.reduce((s, l) => s + l.current, 0)} />
                </Td>
                <Td align="right">
                  <Amount value={proposal.lines.reduce((s, l) => s + l.amount, 0)} />
                </Td>
                <Td />
                <Td className="pr-5" />
              </Tr>
            )}
          </tbody>
        </Table>
        {proposal && (
          <div className="space-y-3 px-5 py-4">
            {proposal.notes.map((n) => (
              <p key={n} className="text-xs text-warning">
                {n}
              </p>
            ))}
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Appliquer à partir de">{(id) => <TextInput id={id} type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className="w-48" />}</Field>
              <Button variant="primary" disabled={applying || (!changes.length && !capacityChanged) || !fromMonth} onClick={apply}>
                {changes.length ? `Appliquer ces montants (${changes.length} compte${changes.length > 1 ? "s" : ""})` : "Déjà appliqué"}
              </Button>
            </div>
            <p className="text-xs text-fg-faint">Les versements programmés de chaque compte sont remplacés à partir de ce mois ; les mois précédents ne changent pas.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
