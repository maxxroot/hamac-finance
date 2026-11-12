import { useEffect, useState } from "react";
import { lotIsActive, sortLots, type Property, type PropertyReminder } from "@hamac/core";
import type { PropertyReminderInput } from "@hamac/api";
import { Checkbox, Field, FormGrid, Modal, Select, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { todayIso } from "@/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

type ReminderDraft = Required<Omit<PropertyReminderInput, "id">> & { id?: string };

/** Rappel saisi à la main sur un bien loué : assemblée générale, entretien, relance… */
export function ReminderDialog({ open, properties, reminder, onClose }: { open: boolean; properties: readonly Property[]; reminder: PropertyReminder | null; onClose: () => void }) {
  const ws = useWorkspaceIndex()?.ws;
  const fresh = (): ReminderDraft => ({ propertyId: properties[0]?.id ?? "", lotId: null, date: todayIso(), yearly: false, label: "", comment: "", doneOn: null });
  const [d, setD] = useState<ReminderDraft>(fresh);
  const save = useMutate("propertyReminders.upsert", { success: reminder ? "Rappel mis à jour" : "Rappel ajouté" });
  useEffect(() => {
    if (open) setD(reminder ? { ...reminder } : fresh());
    // `fresh` lit les biens du moment : relu à chaque ouverture.
  }, [open, reminder]);
  const property = properties.find((p) => p.id === d.propertyId);
  const lots = property ? sortLots((ws?.lots ?? []).filter((l) => l.propertyId === property.id && (lotIsActive(l, property.rentalMode) || l.id === d.lotId))) : [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={reminder ? "Modifier le rappel" : "Nouveau rappel"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !d.label.trim() || !d.propertyId || !d.date} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            {reminder ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="De quoi s'agit-il ?">{(id) => <TextInput id={id} value={d.label} onChange={(e) => setD((x) => ({ ...x, label: e.target.value }))} placeholder="ex. Assemblée générale, entretien de la chaudière" autoFocus />}</Field>
        <FormGrid>
          <Field label="Bien">
            {(id) => (
              <Select id={id} value={d.propertyId} onChange={(e) => setD((x) => ({ ...x, propertyId: e.target.value, lotId: null }))}>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {lots.length > 1 && (
            <Field label="Lot (facultatif)">
              {(id) => (
                <Select id={id} value={d.lotId ?? ""} onChange={(e) => setD((x) => ({ ...x, lotId: e.target.value || null }))}>
                  <option value="">Tout le bien</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </FormGrid>
        <FormGrid>
          <Field label="Date">{(id) => <TextInput id={id} type="date" value={d.date} onChange={(e) => setD((x) => ({ ...x, date: e.target.value }))} />}</Field>
          <div className="flex items-end pb-2">
            <Checkbox checked={d.yearly} onChange={(v) => setD((x) => ({ ...x, yearly: v, doneOn: null }))} label="Chaque année à la même date" />
          </div>
        </FormGrid>
        <Field label="Commentaire (facultatif)">{(id) => <TextInput id={id} value={d.comment} onChange={(e) => setD((x) => ({ ...x, comment: e.target.value }))} />}</Field>
      </div>
    </Modal>
  );
}
