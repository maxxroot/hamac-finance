import { useEffect, useState } from "react";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory, type PropertyExpense } from "@hamac/core";
import type { PropertyExpenseInput } from "@hamac/api";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, NumberInput, Select, TextInput } from "@/shared/components/form";
import { Button } from "@/shared/components/ui";
import { todayIso } from "@/shared/lib/numbers";
import { useMutate } from "@/shared/lib/workspace";

type ExpenseDraft = Required<Omit<PropertyExpenseInput, "id">> & { id?: string };

const emptyExpense = (propertyId: string): ExpenseDraft => ({ propertyId, date: todayIso(), category: "taxe_fonciere", amount: 0, label: "", yearly: false, untilYear: null, improvement: false });

export function ExpenseDialog({ open, propertyId, expense, onClose }: { open: boolean; propertyId: string; expense: PropertyExpense | null; onClose: () => void }) {
  const [d, setD] = useState<ExpenseDraft>(() => emptyExpense(propertyId));
  const save = useMutate("propertyExpenses.upsert", { success: expense ? "Dépense mise à jour" : "Dépense ajoutée" });
  useEffect(() => {
    if (open) setD(expense ? { ...expense } : emptyExpense(propertyId));
  }, [open, expense, propertyId]);
  const set = <K extends keyof ExpenseDraft>(k: K, v: ExpenseDraft[K]) => setD((x) => ({ ...x, [k]: v }));
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
          <Button variant="primary" disabled={save.isPending || !d.date || d.amount <= 0} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            {expense ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Catégorie">
            {(id) => (
              <Select id={id} value={d.category} onChange={(e) => set("category", e.target.value as ExpenseCategory)}>
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
