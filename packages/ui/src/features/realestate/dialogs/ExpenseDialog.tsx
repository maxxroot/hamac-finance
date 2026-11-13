import { useEffect, useState } from "react";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, RECOVERABLE_CATEGORIES, defaultParams, defaultRecoverableRate, rateFromAmount, roundCents, type ExpenseCategory, type PropertyExpense } from "@hamac/core";
import type { PropertyExpenseInput } from "@hamac/api";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, NumberInput, PercentInput, Select, TextInput } from "@/shared/components/form";
import { Button } from "@/shared/components/ui";
import { todayIso } from "@/shared/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/shared/lib/workspace";

type ExpenseDraft = Required<Omit<PropertyExpenseInput, "id">> & { id?: string };

const emptyExpense = (propertyId: string): ExpenseDraft => ({ propertyId, date: todayIso(), category: "taxe_fonciere", amount: 0, label: "", yearly: false, untilYear: null, improvement: false, recoverableRate: 0 });

export function ExpenseDialog({ open, propertyId, expense, onClose }: { open: boolean; propertyId: string; expense: PropertyExpense | null; onClose: () => void }) {
  const [d, setD] = useState<ExpenseDraft>(() => emptyExpense(propertyId));
  // TEOM de la taxe foncière : saisie en montant, convertie en part récupérable à l'enregistrement.
  const [teom, setTeom] = useState<number | null>(null);
  const coproRecoverable = (useWorkspaceIndex()?.ws.params ?? defaultParams()).rental.coproRecoverable;
  const save = useMutate("propertyExpenses.upsert", { success: expense ? "Dépense mise à jour" : "Dépense ajoutée" });
  useEffect(() => {
    if (!open) return;
    setD(expense ? { ...expense } : emptyExpense(propertyId));
    setTeom(expense?.category === "taxe_fonciere" ? roundCents(expense.amount * expense.recoverableRate) : null);
  }, [open, expense, propertyId]);
  const set = <K extends keyof ExpenseDraft>(k: K, v: ExpenseDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setCategory = (category: ExpenseCategory) => setD((x) => ({ ...x, category, recoverableRate: defaultRecoverableRate(category, coproRecoverable) }));
  const recoverable = RECOVERABLE_CATEGORIES.includes(d.category);
  const draft = (): ExpenseDraft => ({ ...d, recoverableRate: !recoverable ? 0 : d.category === "taxe_fonciere" ? rateFromAmount(teom ?? 0, d.amount) : d.recoverableRate });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? "Modifier la dépense" : "Nouvelle dépense"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !d.date || d.amount <= 0 || (teom ?? 0) > d.amount} onClick={() => save.mutate(draft(), { onSuccess: onClose })}>
            {expense ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Catégorie">
            {(id) => (
              <Select id={id} value={d.category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Libellé (facultatif)">{(id) => <TextInput id={id} value={d.label} onChange={(e) => set("label", e.target.value)} />}</Field>
          <Field label="Date">{(id) => <TextInput id={id} type="date" value={d.date} onChange={(e) => set("date", e.target.value)} />}</Field>
          <Field label="Montant" help="Pour le bien entier.">{(id) => <MoneyInput id={id} value={d.amount} onChange={(v) => set("amount", v ?? 0)} />}</Field>
          {d.category === "taxe_fonciere" && (
            <Field label="Dont ordures ménagères (TEOM)" help="Ligne de l'avis de taxe foncière, récupérée sur le locataire avec les charges." error={(teom ?? 0) > d.amount ? "Plus que la taxe foncière" : undefined}>
              {(id) => <MoneyInput id={id} value={teom} onChange={setTeom} />}
            </Field>
          )}
          {recoverable && d.category !== "taxe_fonciere" && (
            <Field label="Part récupérable sur le locataire" help={d.category === "copropriete" ? "Voir le décompte annuel du syndic. Deux tiers en général." : "Charges que le locataire rembourse avec ses provisions."}>
              {(id) => <PercentInput id={id} value={d.recoverableRate} onChange={(v) => set("recoverableRate", Math.min(1, Math.max(0, v ?? 0)))} />}
            </Field>
          )}
        </FormGrid>
        {d.category === "travaux" && <Checkbox checked={d.improvement} onChange={(v) => set("improvement", v)} label="Améliore le bien (agrandissement, rénovation…) : s'ajoute à son coût pour calculer le gain" />}
        <Checkbox checked={d.yearly} onChange={(v) => setD((x) => ({ ...x, yearly: v, untilYear: v ? x.untilYear : null }))} label="Chaque année, à la même date" />
        {d.yearly && (
          <FormGrid>
            <Field label="Dernière année (facultative)" help="Si le montant change : indiquez la dernière année ici, puis ajoutez une nouvelle dépense.">
              {(id) => <NumberInput id={id} decimals={0} grouping={false} value={d.untilYear} onChange={(v) => set("untilYear", v == null ? null : Math.round(v))} />}
            </Field>
          </FormGrid>
        )}
      </div>
    </Modal>
  );
}
