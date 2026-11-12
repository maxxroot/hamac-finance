import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { type Goal, type GoalAllocation, type GoalAllocationMode } from "@hamac/core";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, PercentInput, Select, Textarea, TextInput } from "@/shared/components/form";
import { Button } from "@/shared/components/ui";
import { todayIso } from "@/shared/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/shared/lib/workspace";

interface Draft {
  name: string;
  target: number | null;
  targetDate: string;
  startDate: string;
  rate: number;
  allocations: GoalAllocation[];
  comment: string;
  archived: boolean;
}

const blank = (): Draft => ({ name: "", target: null, targetDate: "", startDate: todayIso(), rate: 0, allocations: [], comment: "", archived: false });

/** Création et modification d'un projet : somme, date, comptes qui le financent et rendement supposé. */
export function GoalDialog({ open, goal, onClose }: Readonly<{ open: boolean; goal: Goal | null; onClose: () => void }>) {
  const idx = useWorkspaceIndex();
  const save = useMutate("goals.upsert", { success: goal ? "Projet mis à jour" : "Projet ajouté" });
  const [d, setD] = useState<Draft>(blank());
  useEffect(() => {
    if (open) setD(goal ? { ...goal, allocations: goal.allocations.map((a) => ({ ...a })) } : blank());
  }, [open, goal]);
  const accounts = (idx?.activeAccounts ?? []).filter((a) => !d.allocations.some((x) => x.accountId === a.id));
  const setAllocation = (i: number, patch: Partial<GoalAllocation>) => setD((x) => ({ ...x, allocations: x.allocations.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const valid = d.name.trim() && d.target && d.target > 0 && d.targetDate && d.startDate <= d.targetDate;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={goal ? `Modifier « ${goal.name} »` : "Nouveau projet"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!valid || save.isPending} onClick={() => d.target && save.mutate({ ...d, target: d.target, id: goal?.id }, { onSuccess: onClose })}>
            {goal ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={2}>
          <Field label="Projet">{(id) => <TextInput id={id} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="ex. Apport pour la résidence principale" autoFocus />}</Field>
          <Field label="Somme à réunir">{(id) => <MoneyInput id={id} value={d.target} onChange={(v) => setD({ ...d, target: v })} />}</Field>
          <Field label="Pour le">{(id) => <TextInput id={id} type="date" value={d.targetDate} onChange={(e) => setD({ ...d, targetDate: e.target.value })} />}</Field>
          <Field label="Depuis le" help="Début de l'effort : sert à dire si vous êtes en avance ou en retard.">
            {(id) => <TextInput id={id} type="date" value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value })} />}
          </Field>
          <Field label="Rendement supposé par an" help="0 % par prudence ; indiquez par exemple le taux du livret si l'argent y reste.">
            {(id) => <PercentInput id={id} value={d.rate} onChange={(v) => setD({ ...d, rate: v ?? 0 })} />}
          </Field>
        </FormGrid>

        <div>
          <div className="mb-2 text-xs font-medium text-fg-muted">Comptes qui financent le projet</div>
          {d.allocations.length === 0 && <p className="mb-2 text-sm text-fg-faint">Aucun compte : ajoutez ceux où vous mettez cet argent de côté.</p>}
          <div className="space-y-2">
            {d.allocations.map((a, i) => (
              <div key={a.accountId} className="grid grid-cols-[1fr_11rem_9rem_auto] items-end gap-2">
                <div className="pb-2 text-sm">{idx?.accountById.get(a.accountId)?.name ?? "Compte supprimé"}</div>
                <Field label={i === 0 ? "Part du compte" : ""}>
                  {(id) => (
                    <Select id={id} value={a.mode} onChange={(e) => setAllocation(i, { mode: e.target.value as GoalAllocationMode, value: e.target.value === "pourcentage" ? 1 : 0 })}>
                      <option value="pourcentage">En pourcentage</option>
                      <option value="montant">Montant réservé</option>
                    </Select>
                  )}
                </Field>
                <Field label="">
                  {(id) =>
                    a.mode === "pourcentage" ? (
                      <PercentInput id={id} value={a.value} onChange={(v) => setAllocation(i, { value: Math.min(1, Math.max(0, v ?? 0)) })} aria-label="Pourcentage du compte" />
                    ) : (
                      <MoneyInput id={id} value={a.value} onChange={(v) => setAllocation(i, { value: v ?? 0 })} aria-label="Montant réservé" />
                    )
                  }
                </Field>
                <button type="button" className="mb-2 rounded p-1 text-fg-faint hover:text-negative" aria-label="Retirer ce compte" onClick={() => setD((x) => ({ ...x, allocations: x.allocations.filter((_, j) => j !== i) }))}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          {accounts.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Select
                aria-label="Ajouter un compte"
                value=""
                onChange={(e) => e.target.value && setD((x) => ({ ...x, allocations: [...x.allocations, { accountId: e.target.value, mode: "pourcentage", value: 1 }] }))}
                className="max-w-xs"
              >
                <option value="">Ajouter un compte…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <Plus size={14} className="text-fg-faint" aria-hidden />
            </div>
          )}
          <p className="mt-2 text-xs text-fg-faint">En pourcentage, la somme suit la valeur du compte. Un montant réservé reste fixe tant que vous ne le changez pas, dans la limite de ce que contient le compte.</p>
        </div>

        <Field label="Commentaire">{(id) => <Textarea id={id} value={d.comment} onChange={(e) => setD({ ...d, comment: e.target.value })} />}</Field>
        {goal && <Checkbox checked={d.archived} onChange={(v) => setD({ ...d, archived: v })} label="Terminé ou abandonné (archivé)" />}
      </div>
    </Modal>
  );
}
