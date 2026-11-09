import { useEffect, useState } from "react";
import { LOAN_INSURANCE_MODE_LABELS, LOAN_INSURANCE_MODES, LOAN_KIND_LABELS, LOAN_KINDS, loanHasProperty, loanState, type Loan, type LoanInsuranceMode, type LoanKind, type Property } from "@hamac/core";
import type { LoanInput } from "@hamac/api";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, NumberInput, PercentInput, Select, TextInput } from "@/components/form";
import { Amount } from "@/components/Amount";
import { Button } from "@/components/ui";
import { formatDate, todayIso } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

type LoanDraft = Required<Omit<LoanInput, "id">> & { id?: string };

const emptyLoan = (): LoanDraft => ({ kind: "immobilier", name: "", propertyId: null, share: 1, principal: 0, rate: 0.03, termMonths: 240, firstPayment: todayIso(), insuranceMode: "montant", insurance: 0, insuranceRate: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false });

export function LoanDialog({ open, loan, properties, onClose }: { open: boolean; loan: Loan | null; properties: readonly Property[]; onClose: () => void }) {
  const [d, setD] = useState<LoanDraft>(emptyLoan());
  const save = useMutate("loans.upsert", { success: loan ? "Crédit mis à jour" : "Crédit ajouté" });
  useEffect(() => {
    if (open) setD(loan ? { ...loan } : emptyLoan());
  }, [open, loan]);
  const set = <K extends keyof LoanDraft>(k: K, v: LoanDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const balanceIncomplete = (d.manualBalance == null) !== (d.manualBalanceDate == null);
  const valid = d.name.trim() && d.principal > 0 && d.termMonths >= 1 && d.firstPayment && !balanceIncomplete && d.share > 0 && d.share <= 1;
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
        <FormGrid cols={loanHasProperty(d.kind) ? 3 : 2}>
          <Field label="Type">
            {(id) => (
              <Select id={id} value={d.kind} onChange={(e) => set("kind", e.target.value as LoanKind)}>
                {LOAN_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LOAN_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Nom">{(id) => <TextInput id={id} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder={LOAN_KIND_LABELS[d.kind]} autoFocus />}</Field>
          {loanHasProperty(d.kind) && (
            <Field label="Bien concerné (facultatif)">
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
          )}
        </FormGrid>
        <FormGrid cols={3}>
          <Field label="Montant emprunté">{(id) => <MoneyInput id={id} value={d.principal} onChange={(v) => set("principal", v ?? 0)} />}</Field>
          <Field label="Taux d'intérêt annuel" help="Taux nominal, hors assurance.">{(id) => <PercentInput id={id} value={d.rate} onChange={(v) => set("rate", v ?? 0)} />}</Field>
          <Field label="Durée (mois)" help={`Soit ${Math.round((d.termMonths / 12) * 10) / 10} ans.`}>{(id) => <NumberInput id={id} decimals={0} grouping={false} value={d.termMonths} onChange={(v) => set("termMonths", v == null ? 0 : Math.round(v))} />}</Field>
        </FormGrid>
        <FormGrid cols={3}>
          <Field label="Première échéance">{(id) => <TextInput id={id} type="date" value={d.firstPayment} onChange={(e) => set("firstPayment", e.target.value)} />}</Field>
          <Field label="Assurance basée sur">
            {(id) => (
              <Select id={id} value={d.insuranceMode} onChange={(e) => set("insuranceMode", e.target.value as LoanInsuranceMode)}>
                {LOAN_INSURANCE_MODES.map((m) => (
                  <option key={m} value={m}>
                    {LOAN_INSURANCE_MODE_LABELS[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {d.insuranceMode === "montant" ? (
            <Field label="Montant par mois">{(id) => <MoneyInput id={id} value={d.insurance} onChange={(v) => set("insurance", v ?? 0)} />}</Field>
          ) : (
            <Field label="Taux annuel de l'assurance" help="Multipliez-le par la quotité si elle n'est pas de 100 %.">
              {(id) => <PercentInput id={id} value={d.insuranceRate} onChange={(v) => set("insuranceRate", v ?? 0)} />}
            </Field>
          )}
        </FormGrid>
        <FormGrid cols={3}>
          <Field label="Part à ma charge" help="50 % si le montant saisi est le crédit entier, remboursé à deux.">{(id) => <PercentInput id={id} value={d.share} onChange={(v) => set("share", v ?? 0)} />}</Field>
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
            Échéance <b className="text-fg"><Amount value={preview.payment} /></b> + assurance <b className="text-fg"><Amount value={preview.insurance} /></b> ce mois-ci, capital restant dû aujourd'hui <b className="text-fg"><Amount value={preview.balance} /></b>, dernière échéance le {formatDate(preview.endDate)}. Coût total : <b className="text-fg"><Amount value={preview.totalInterest + preview.totalInsurance} /></b>, dont <Amount value={preview.totalInterest} /> d'intérêts et <Amount value={preview.totalInsurance} /> d'assurance.
            {d.share < 1 && (
              <>
                {" "}À votre charge : <b className="text-fg"><Amount value={preview.heldMonthly} /></b> par mois et <b className="text-fg"><Amount value={preview.heldBalance} /></b> de capital restant dû.
              </>
            )}
          </p>
        )}
        {loan && <Checkbox checked={d.archived} onChange={(v) => set("archived", v)} label="Archivé (soldé : ne compte plus dans le patrimoine)" />}
      </div>
    </Modal>
  );
}
