import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Property, PropertyValue } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Field, FormGrid, Modal, MoneyInput, TextInput } from "@/components/form";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Button, Card, CardTitle } from "@/components/ui";
import { formatDate, todayIso } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

function ValueDialog({ open, propertyId, onClose }: { open: boolean; propertyId: string; onClose: () => void }) {
  const [date, setDate] = useState("");
  const [value, setValue] = useState<number | null>(null);
  const save = useMutate("propertyValues.add", { success: "Estimation enregistrée" });
  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setValue(null);
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle estimation"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !date || value == null} onClick={() => save.mutate({ propertyId, date, value: value! }, { onSuccess: onClose })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Estimée le">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Valeur du bien entier" help="La plus récente devient la valeur actuelle.">{(id) => <MoneyInput id={id} value={value} onChange={setValue} />}</Field>
      </FormGrid>
    </Modal>
  );
}

/** Estimations successives du bien : elles alimentent la page Historique. */
export function ValuesCard({ property, values }: { property: Property; values: readonly PropertyValue[] }) {
  const [adding, setAdding] = useState(false);
  const del = useMutate("propertyValues.delete", { success: "Estimation supprimée" });
  const past = [...values].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Card>
      <CardTitle
        hint={
          <Button className="h-8" onClick={() => setAdding(true)}>
            <Plus size={14} /> Nouvelle estimation
          </Button>
        }
      >
        Valeur dans le temps
      </CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th align="right">Valeur du bien entier</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          <Tr>
            <Td className="font-medium whitespace-nowrap">{property.valueDate ? formatDate(property.valueDate) : "Sans date"}</Td>
            <Td align="right" className="font-medium"><Amount value={property.value} /></Td>
            <Td className="text-xs text-fg-faint">actuelle</Td>
          </Tr>
          {past.length === 0 && <EmptyRow cols={3}>Pas encore d'estimation plus ancienne.</EmptyRow>}
          {past.map((v) => (
            <Tr key={v.id}>
              <Td className="whitespace-nowrap">{formatDate(v.date)}</Td>
              <Td align="right"><Amount value={v.value} /></Td>
              <Td className="w-10">
                <button className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label={`Supprimer l'estimation du ${formatDate(v.date)}`} onClick={() => del.mutate({ id: v.id })}>
                  <Trash2 size={13} />
                </button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <ValueDialog open={adding} propertyId={property.id} onClose={() => setAdding(false)} />
    </Card>
  );
}
