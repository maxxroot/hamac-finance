import { useEffect, useState } from "react";
import type { PlanParams, Property, Provision } from "@hamac/core";
import { Field, FormGrid, Modal, MoneyInput, PercentInput, Select } from "@/shared/components/form";
import { Button } from "@/shared/components/ui";
import { useMutate } from "@/shared/lib/workspace";

type Choice = "plan" | Provision["kind"];
interface Draft {
  choice: Choice;
  value: number | null;
}

const draftOf = (p: Provision | null): Draft => (p ? { choice: p.kind, value: p.value } : { choice: "plan", value: null });
const provisionOf = (d: Draft): Provision | null => (d.choice === "plan" ? null : { kind: d.choice, value: d.value ?? 0 });

function ProvisionField({ label, planRate, draft, onChange }: { label: string; planRate: number; draft: Draft; onChange: (d: Draft) => void }) {
  return (
    <>
      <Field label={label}>
        {(id) => (
          <Select id={id} value={draft.choice} onChange={(e) => onChange({ choice: e.target.value as Choice, value: null })}>
            <option value="plan">Réglage du plan ({(planRate * 100).toLocaleString("fr-FR")} % du loyer)</option>
            <option value="taux">Un pourcentage du loyer</option>
            <option value="montant">Un montant par an</option>
          </Select>
        )}
      </Field>
      {draft.choice === "taux" && <Field label="Pourcentage du loyer hors charges">{(id) => <PercentInput id={id} value={draft.value} onChange={(v) => onChange({ ...draft, value: v })} />}</Field>}
      {draft.choice === "montant" && <Field label="Montant par an" help="Pour le bien entier.">{(id) => <MoneyInput id={id} value={draft.value} onChange={(v) => onChange({ ...draft, value: v })} />}</Field>}
      {draft.choice === "plan" && <div />}
    </>
  );
}

/** Provisions pour vacance et travaux du cashflow prévu d'un bien. */
export function ProvisionsDialog({ open, property, rental, onClose }: { open: boolean; property: Property; rental: PlanParams["rental"]; onClose: () => void }) {
  const [vacancy, setVacancy] = useState<Draft>(() => draftOf(property.vacancyProvision));
  const [works, setWorks] = useState<Draft>(() => draftOf(property.worksProvision));
  const save = useMutate("properties.setProvisions", { success: "Hypothèses enregistrées" });
  useEffect(() => {
    if (!open) return;
    setVacancy(draftOf(property.vacancyProvision));
    setWorks(draftOf(property.worksProvision));
  }, [open, property]);
  const tooHigh = [vacancy, works].some((d) => d.choice === "taux" && (d.value ?? 0) > 1);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hypothèses du cashflow prévu"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || tooHigh} onClick={() => save.mutate({ id: property.id, vacancy: provisionOf(vacancy), works: provisionOf(works) }, { onSuccess: onClose })}>
            Valider
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-fg-muted">
        Des sommes mises de côté chaque mois : les mois sans locataire, et les travaux d'entretien qui finiront par arriver. Les valeurs du plan se règlent dans Paramètres › Plan › Biens en location.
      </p>
      <FormGrid>
        <ProvisionField label="Vacance locative" planRate={rental.vacancyRate} draft={vacancy} onChange={setVacancy} />
        <ProvisionField label="Travaux et entretien" planRate={rental.worksRate} draft={works} onChange={setWorks} />
      </FormGrid>
    </Modal>
  );
}
