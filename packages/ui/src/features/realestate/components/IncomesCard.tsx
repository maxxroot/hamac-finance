import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { INCOME_CATEGORIES, INCOME_CATEGORY_LABELS, incomeSigned, type IncomeCategory, type PropertyIncome } from "@hamac/core";
import type { PropertyIncomeInput } from "@hamac/api";
import { Amount } from "@/shared/components/Amount";
import { Field, FormGrid, Modal, MoneyInput, Select, TextInput } from "@/shared/components/form";
import { RowActions } from "@/shared/components/RowActions";
import { EmptyRow, Table, Td, Th, Tr } from "@/shared/components/table";
import { Button, Card, CardTitle } from "@/shared/components/ui";
import { formatDate, todayIso } from "@/shared/lib/numbers";
import { useMutate } from "@/shared/lib/workspace";

type IncomeDraft = Required<Omit<PropertyIncomeInput, "id">> & { id?: string };
const emptyIncome = (propertyId: string): IncomeDraft => ({ propertyId, date: todayIso(), category: "regularisation_recue", amount: 0, label: "" });

function IncomeDialog({ open, propertyId, income, onClose }: { open: boolean; propertyId: string; income: PropertyIncome | null; onClose: () => void }) {
  const [d, setD] = useState<IncomeDraft>(() => emptyIncome(propertyId));
  const save = useMutate("propertyIncomes.upsert", { success: income ? "Recette mise à jour" : "Recette ajoutée" });
  useEffect(() => {
    if (open) setD(income ? { ...income } : emptyIncome(propertyId));
  }, [open, income, propertyId]);
  const set = <K extends keyof IncomeDraft>(k: K, v: IncomeDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={income ? "Modifier la recette" : "Nouvelle recette"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !d.date || d.amount <= 0} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            {income ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Type de recette">
          {(id) => (
            <Select id={id} value={d.category} onChange={(e) => set("category", e.target.value as IncomeCategory)}>
              {INCOME_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {INCOME_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Libellé (facultatif)">{(id) => <TextInput id={id} value={d.label} onChange={(e) => set("label", e.target.value)} />}</Field>
        <Field label="Date">{(id) => <TextInput id={id} type="date" value={d.date} onChange={(e) => set("date", e.target.value)} />}</Field>
        <Field label="Montant" help="Pour le bien entier, toujours positif.">{(id) => <MoneyInput id={id} value={d.amount} onChange={(v) => set("amount", v ?? 0)} />}</Field>
      </FormGrid>
    </Modal>
  );
}

/** Recettes hors loyer : régularisation des charges, indemnités. */
export function IncomesCard({ propertyId, incomes }: { propertyId: string; incomes: readonly PropertyIncome[] }) {
  const [editing, setEditing] = useState<PropertyIncome | "new" | null>(null);
  const del = useMutate("propertyIncomes.delete", { success: "Recette supprimée" });
  return (
    <Card>
      <CardTitle
        hint={
          <Button className="h-8" onClick={() => setEditing("new")}>
            <Plus size={14} /> Nouvelle recette
          </Button>
        }
      >
        Autres recettes
      </CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Recette</Th>
            <Th>Date</Th>
            <Th align="right">Montant</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {incomes.length === 0 && <EmptyRow cols={4}>Régularisation annuelle des charges, indemnité d'assurance…</EmptyRow>}
          {incomes.map((i) => (
            <Tr key={i.id} className="group">
              <Td>
                <span className="font-medium">{INCOME_CATEGORY_LABELS[i.category]}</span>
                {i.label && <div className="text-xs text-fg-faint">{i.label}</div>}
              </Td>
              <Td className="whitespace-nowrap">{formatDate(i.date)}</Td>
              <Td align="right"><Amount value={incomeSigned(i)} signed /></Td>
              <Td className="w-20"><RowActions onEdit={() => setEditing(i)} onDelete={() => confirm("Supprimer cette recette ?") && del.mutate({ id: i.id })} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <IncomeDialog open={editing !== null} propertyId={propertyId} income={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </Card>
  );
}
