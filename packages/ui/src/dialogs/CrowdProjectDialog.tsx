import { useEffect, useState } from "react";
import { CROWD_REPAYMENT_LABELS, CROWD_REPAYMENTS, CROWD_STATUS_LABELS, CROWD_STATUSES, crowdExtensionError, crowdInitialEndDate, type Account, type CrowdProject, type CrowdRepayment, type CrowdStatus } from "@hamac/core";
import type { CrowdProjectInput } from "@hamac/api";
import { Field, FormGrid, Modal, MoneyInput, NumberInput, PercentInput, Select, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { AllocationChoice } from "./AllocationChoice";
import { formatDate, todayIso } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

type Draft = Required<Omit<CrowdProjectInput, "id">> & { id?: string };

const empty = (accountId: string): Draft => ({ accountId, name: "", amount: 0, rate: 0.09, startDate: todayIso(), termMonths: 12, repayment: "in_fine", status: "en_cours", statusDate: null, extendedTo: null, repaidCapital: null, expectedRecovery: null, inAllocation: null, comment: "" });

export function CrowdProjectDialog({ open, project, platforms, onClose }: { open: boolean; project: CrowdProject | null; platforms: readonly Account[]; onClose: () => void }) {
  const [d, setD] = useState<Draft>(empty(""));
  const save = useMutate("crowdProjects.upsert", { success: project ? "Projet mis à jour" : "Projet ajouté" });
  useEffect(() => {
    if (open) setD(project ? { ...project, extendedTo: project.extendedTo ?? null } : empty(platforms[0]?.id ?? ""));
  }, [open, project, platforms]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setStatus = (status: CrowdStatus) => setD((x) => ({ ...x, status, statusDate: status === "en_cours" ? null : (x.statusDate ?? todayIso()) }));
  const extensionError = crowdExtensionError(d);
  const initialEnd = crowdInitialEndDate(d);
  const valid = d.accountId && d.name.trim() && d.amount > 0 && (d.termMonths == null || d.termMonths >= 1) && d.startDate && !extensionError;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? "Modifier le projet" : "Nouveau projet"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !valid} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            {project ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Plateforme">
            {(id) => (
              <Select id={id} value={d.accountId} onChange={(e) => set("accountId", e.target.value)}>
                {platforms.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Nom du projet">{(id) => <TextInput id={id} value={d.name} onChange={(e) => set("name", e.target.value)} autoFocus />}</Field>
        </FormGrid>
        <FormGrid cols={3}>
          <Field label="Montant investi">{(id) => <MoneyInput id={id} value={d.amount} onChange={(v) => set("amount", v ?? 0)} />}</Field>
          <Field label="Taux annuel">{(id) => <PercentInput id={id} value={d.rate} onChange={(v) => set("rate", v)} />}</Field>
          <Field label="Durée (mois)">{(id) => <NumberInput id={id} decimals={0} grouping={false} value={d.termMonths} onChange={(v) => set("termMonths", v == null ? null : Math.round(v))} />}</Field>
        </FormGrid>
        <FormGrid>
          <Field label="Date d'investissement" help="L'argent quitte les espèces de la plateforme à cette date.">{(id) => <TextInput id={id} type="date" value={d.startDate} onChange={(e) => set("startDate", e.target.value)} />}</Field>
          <Field label="Remboursement">
            {(id) => (
              <Select id={id} value={d.repayment} onChange={(e) => set("repayment", e.target.value as CrowdRepayment)}>
                {CROWD_REPAYMENTS.map((r) => (
                  <option key={r} value={r}>
                    {CROWD_REPAYMENT_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FormGrid>
        <FormGrid cols={d.status === "en_cours" ? 2 : 3}>
          <Field label="Statut">
            {(id) => (
              <Select id={id} value={d.status} onChange={(e) => setStatus(e.target.value as CrowdStatus)}>
                {CROWD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CROWD_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {d.status !== "en_cours" && <Field label={d.status === "rembourse" ? "Remboursé le" : "Depuis le"}>{(id) => <TextInput id={id} type="date" value={d.statusDate ?? ""} onChange={(e) => set("statusDate", e.target.value || null)} />}</Field>}
          <Field label="Capital déjà remboursé" help="Vide : calculé.">{(id) => <MoneyInput id={id} value={d.repaidCapital} onChange={(v) => set("repaidCapital", v)} />}</Field>
        </FormGrid>
        <Field label="Échéance prolongée au" help={initialEnd ? `Facultatif : si la plateforme repousse l'échéance initiale du ${formatDate(initialEnd)}.` : "Facultatif : si la plateforme repousse l'échéance."} error={extensionError}>
          {(id) => <TextInput id={id} type="date" value={d.extendedTo ?? ""} onChange={(e) => set("extendedTo", e.target.value || null)} />}
        </Field>
        {d.status === "defaut" && (
          <Field label="Montant espéré" help="Vide : le projet compte pour 0 € tant que vous ne savez pas.">
            {(id) => <MoneyInput id={id} value={d.expectedRecovery} onChange={(v) => set("expectedRecovery", v)} />}
          </Field>
        )}
        <AllocationChoice value={d.inAllocation} defaultLabel="comme la plateforme" onChange={(v) => set("inAllocation", v)} />
      </div>
    </Modal>
  );
}
