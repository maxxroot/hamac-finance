import { Plus } from "lucide-react";
import { useState } from "react";
import { EXPENSE_CATEGORY_LABELS, ownerAmount, recoverableAmount, type PropertyExpense } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { RowActions } from "@/shared/components/RowActions";
import { EmptyRow, Table, Td, Th, Tr } from "@/shared/components/table";
import { Badge, Button, Card, CardTitle } from "@/shared/components/ui";
import { ExpenseDialog } from "@/features/realestate/dialogs/ExpenseDialog";
import { formatDate } from "@/shared/lib/numbers";
import { useMutate } from "@/shared/lib/workspace";

/** Dépenses du bien, datées et par catégorie, avec ce qui reste à la charge du propriétaire une fois la part récupérable demandée au locataire. */
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
            <Th align="right">À votre charge</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 && <EmptyRow cols={5}>Aucune dépense. Ajoutez la taxe foncière, l'assurance ou les travaux.</EmptyRow>}
          {expenses.map((e) => (
            <Tr key={e.id} className="group">
              <Td>
                <span className="font-medium">{EXPENSE_CATEGORY_LABELS[e.category]}</span>
                {e.label && <div className="text-xs text-fg-faint">{e.label}</div>}
                {e.improvement && (
                  <div className="mt-0.5">
                    <Badge tone="accent">Amélioration</Badge>
                  </div>
                )}
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
              <Td align="right">
                <Amount value={ownerAmount(e)} />
                {recoverableAmount(e) > 0 && (
                  <div className="text-xs text-fg-faint">
                    <Amount value={recoverableAmount(e)} /> récupérables
                  </div>
                )}
              </Td>
              <Td className="w-20"><RowActions onEdit={() => setEditing(e)} onDelete={() => confirm("Supprimer cette dépense ?") && del.mutate({ id: e.id })} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <ExpenseDialog open={editing !== null} propertyId={propertyId} expense={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </Card>
  );
}
