import { useEffect, useState } from "react";
import { loanState, type Loan, type Property } from "@hamac/core";
import type { LoanInput } from "@hamac/api";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, NumberInput, PercentInput, Select, TextInput } from "@/components/form";
import { Amount } from "@/components/Amount";
import { Button } from "@/components/ui";
import { formatDate, todayIso } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

type LoanDraft = Required<Omit<LoanInput, "id">> & { id?: string };

const emptyLoan = (): LoanDraft => ({ name: "", propertyId: null, principal: 0, rate: 0.03, termMonths: 240, firstPayment: todayIso(), insurance: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false });

export function LoanDialog({ open, loan, properties, onClose }: { open: boolean; loan: Loan | null; properties: readonly Property[]; onClose: () => void }) {
  const [d, setD] = useState<LoanDraft>(emptyLoan());
  const save = useMutate("loans.upsert", { success: loan ? "Crédit mis à jour" : "Crédit ajouté" });
  useEffect(() => {
    if (open) setD(loan ? { ...loan } : emptyLoan());
  }, [open, loan]);
  const set = <K extends keyof LoanDraft>(k: K, v: LoanDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const balanceIncomplete = (d.manualBalance == null) !== (d.manualBalanceDate == null);
  const valid = d.name.trim() && d.principal > 0 && d.termMonths >= 1 && d.firstPayment && !balanceIncomplete;
  const preview = valid ? loanState({ ...d, id: d.id ?? "apercu" }, todayIso()) : null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={loan ? "Modifier le crédit" : "Nouveau crédit"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !valid} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            {loan ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Nom">{(id) => <TextInput id={id} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="ex. Prêt résidence principale" autoFocus />}</Field>
          <Field label="Bien financé (facultatif)">
            {(id) => (
              <Select id={id} value={d.propertyId ?? ""} onChange={(e) => set("propertyId", e.target.value || null)}>
                <option value="">Aucun</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FormGrid>
        <FormGrid cols={3}>
          <Field label="Montant emprunté">{(id) => <MoneyInput id={id} value={d.principal} onChange={(v) => set("principal", v ?? 0)} />}</Field>
          <Field label="Taux annuel">{(id) => <PercentInput id={id} value={d.rate} onChange={(v) => set("rate", v ?? 0)} />}</Field>
          <Field label="Durée (mois)" help={`Soit ${Math.round((d.termMonths / 12) * 10) / 10} ans.`}>{(id) => <NumberInput id={id} decimals={0} grouping={false} value={d.termMonths} onChange={(v) => set("termMonths", v == null ? 0 : Math.round(v))} />}</Field>
        </FormGrid>
        <FormGrid>
          <Field label="Première échéance">{(id) => <TextInput id={id} type="date" value={d.firstPayment} onChange={(e) => set("firstPayment", e.target.value)} />}</Field>
          <Field label="Assurance par mois">{(id) => <MoneyInput id={id} value={d.insurance} onChange={(v) => set("insurance", v ?? 0)} />}</Field>
        </FormGrid>

        <div>
          <div className="mb-2 text-xs font-medium text-fg-muted">Saisie manuelle (facultative), d'après un relevé de la banque</div>
          <FormGrid cols={3}>
            <Field label="Échéance hors assurance" help="Vide : calculée.">{(id) => <MoneyInput id={id} value={d.manualPayment} onChange={(v) => set("manualPayment", v)} />}</Field>
            <Field label="Capital restant dû" help="Vide : calculé.">{(id) => <MoneyInput id={id} value={d.manualBalance} onChange={(v) => set("manualBalance", v)} />}</Field>
            <Field label="À la date du" error={balanceIncomplete ? "Indiquez le capital et sa date." : null}>{(id) => <TextInput id={id} type="date" value={d.manualBalanceDate ?? ""} onChange={(e) => set("manualBalanceDate", e.target.value || null)} />}</Field>
          </FormGrid>
        </div>

        {preview && (
          <p className="text-sm text-fg-muted">
            Échéance <b className="text-fg"><Amount value={preview.payment} /></b>, capital restant dû aujourd'hui <b className="text-fg"><Amount value={preview.balance} /></b>, dernière échéance le {formatDate(preview.endDate)}.
          </p>
        )}
        {loan && <Checkbox checked={d.archived} onChange={(v) => set("archived", v)} label="Archivé (soldé : ne compte plus dans le patrimoine)" />}
      </div>
    </Modal>
  );
}
