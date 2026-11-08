import { useState } from "react";
import { CROWD_LINE_LABELS, formatEur, type Account, type CrowdLineStatus, type CrowdProjectState } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Field, Modal, MoneyInput, Select, TextInput } from "@/components/form";
import { Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button } from "@/components/ui";
import { formatDate, formatMonth, todayIso } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

const TONES: Record<CrowdLineStatus, "neutral" | "accent" | "positive" | "negative"> = { verse: "positive", a_venir: "neutral", non_verse: "negative", en_pause: "accent" };

/** Échéancier d'un projet : déclarer une échéance non versée, mettre le projet en pause ou le faire reprendre. */
export function CrowdScheduleDialog({ state, calculated, onClose }: { state: CrowdProjectState | null; calculated: boolean; onClose: () => void }) {
  const save = useMutate("crowdProjects.upsert");
  if (!state) return null;
  const { project, lines, paused } = state;
  const today = todayIso();
  const toggleMissed = (date: string, missed: boolean) => save.mutate({ ...project, missedInterests: missed ? [...project.missedInterests, date] : project.missedInterests.filter((d) => d !== date) });
  const pause = () => save.mutate({ ...project, interestPauses: [...project.interestPauses, { from: today, to: null }] });
  const resume = () => save.mutate({ ...project, interestPauses: project.interestPauses.map((p) => (p.to == null || p.to >= today ? { ...p, to: today } : p)) });
  return (
    <Modal open onClose={onClose} title={`Échéances : ${project.name}`} width="max-w-3xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">{paused ? "Paiements en pause : aucune échéance n'est comptée." : calculated ? "Chaque échéance passée compte comme versée, sauf si vous la déclarez non versée." : "Les intérêts se déclarent pour toute la plateforme ; cet échéancier sert au suivi du capital."}</p>
          <Button disabled={save.isPending} onClick={paused ? resume : pause}>
            {paused ? "Reprendre les paiements" : "Mettre en pause"}
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th align="right">Intérêts bruts</Th>
                <Th align="right">Capital</Th>
                <Th>État</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <Tr key={l.date}>
                  <Td className="num whitespace-nowrap">{formatDate(l.date)}</Td>
                  <Td align="right"><Amount value={l.interest} /></Td>
                  <Td align="right" className="text-fg-muted"><Amount value={l.principal} /></Td>
                  <Td><Badge tone={TONES[l.status]}>{CROWD_LINE_LABELS[l.status]}</Badge></Td>
                  <Td className="text-right">
                    {l.status === "verse" && (
                      <Button variant="ghost" className="h-7 text-xs" disabled={save.isPending} onClick={() => toggleMissed(l.date, true)}>
                        Non versé
                      </Button>
                    )}
                    {l.status === "non_verse" && (
                      <Button variant="ghost" className="h-7 text-xs" disabled={save.isPending} onClick={() => toggleMissed(l.date, false)}>
                        Finalement versé
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </Modal>
  );
}

/** Intérêts d'un mois pour toute la plateforme, enregistrés au journal. */
export function DeclareInterestDialog({ platforms, withheld, journal, onClose }: { platforms: readonly Account[]; withheld: ReadonlyMap<string, boolean>; journal: ReadonlyArray<{ accountId: string; type: string; date: string; amount: number }>; onClose: () => void }) {
  const [accountId, setAccountId] = useState(platforms[0]?.id ?? "");
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [amount, setAmount] = useState<number | null>(null);
  const save = useMutate("transactions.upsert", { success: "Intérêts enregistrés" });
  const already = journal.filter((t) => t.accountId === accountId && t.type === "interets" && t.date.startsWith(`${month}-`)).reduce((s, t) => s + t.amount, 0);
  const [y, m] = month.split("-").map(Number);
  const lastDay = month ? `${month}-${String(new Date(Date.UTC(y!, m!, 0)).getUTCDate()).padStart(2, "0")}` : "";
  return (
    <Modal
      open
      onClose={onClose}
      title="Déclarer les intérêts du mois"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !accountId || !month || !amount || amount <= 0} onClick={() => save.mutate({ date: lastDay, type: "interets", accountId, amount: amount!, comment: `Intérêts de ${formatMonth(month)}` }, { onSuccess: onClose })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Plateforme">
          {(id) => (
            <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {platforms.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Mois">{(id) => <TextInput id={id} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>
        <Field label="Intérêts reçus" help={withheld.get(accountId) ? "Montant net, tel que crédité : la plateforme prélève les impôts." : "Montant brut : les impôts seront à payer."}>
          {(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}
        </Field>
        {already > 0 && <p className="text-sm text-warning">Déjà {formatEur(already)} déclarés pour ce mois sur cette plateforme.</p>}
      </div>
    </Modal>
  );
}
