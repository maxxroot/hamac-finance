import { Plus } from "lucide-react";
import { useState } from "react";
import { EXPENSE_CATEGORY_LABELS, type PropertyExpense } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { RowActions } from "@/components/RowActions";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { ExpenseDialog } from "@/dialogs/ExpenseDialog";
import { formatDate } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

/** Dépenses du bien, datées et par catégorie. */
export function ExpensesCard({ propertyId, expenses }: { propertyId: string; expenses: readonly PropertyExpense[] }) {
  const [editing, setEditing] = useState<PropertyExpense | "new" | null>(null);
  const del = useMutate("propertyExpenses.delete", { success: "Dépense supprimée" });
  return (
    <Card>
      <CardTitle
        hint={
          <Button className="h-8" onClick={() => setEditing("new")}>
            <Plus size={14} /> Nouvelle dépense
          </Button>
        }
      >
        Dépenses
      </CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Dépense</Th>
            <Th>Date</Th>
            <Th align="right">Montant</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 && <EmptyRow cols={4}>Aucune dépense. Ajoutez la taxe foncière, l'assurance ou les travaux.</EmptyRow>}
          {expenses.map((e) => (
            <Tr key={e.id} className="group">
              <Td>
                <span className="font-medium">{EXPENSE_CATEGORY_LABELS[e.category]}</span>
                {e.label && <div className="text-xs text-fg-faint">{e.label}</div>}
              </Td>
              <Td className="whitespace-nowrap">
                {formatDate(e.date)}
                {e.yearly && (
                  <div className="mt-0.5">
                    <Badge>{e.untilYear ? `Chaque année jusqu'en ${e.untilYear}` : "Chaque année"}</Badge>
                  </div>
                )}
              </Td>
              <Td align="right"><Amount value={e.amount} /></Td>
              <Td className="w-20"><RowActions onEdit={() => setEditing(e)} onDelete={() => confirm("Supprimer cette dépense ?") && del.mutate({ id: e.id })} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <ExpenseDialog open={editing !== null} propertyId={propertyId} expense={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </Card>
  );
}
