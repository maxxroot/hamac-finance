import { useEffect, useState } from "react";
import { LOT_KIND_LABELS, defaultLotName, lotKindsFor, type Lot, type LotKind, type Property } from "@hamac/core";
import type { LotInput } from "@hamac/api";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, NumberInput, Select, TextInput } from "@/shared/components/form";
import { Button } from "@/shared/components/ui";
import { useMutate } from "@/shared/lib/workspace";

type LotDraft = Required<Omit<LotInput, "id">> & { id?: string };

/** Lot d'un bien : ce qui se loue. Un lot déjà loué garde sa nature. */
export function LotDialog({ open, property, lot, lots, rented, onClose }: { open: boolean; property: Property; lot: Lot | null; lots: readonly Lot[]; rented: boolean; onClose: () => void }) {
  const kinds = lotKindsFor(property.rentalMode);
  const choices = lot && !kinds.includes(lot.kind) ? [lot.kind, ...kinds] : kinds;
  const fresh = (): LotDraft => {
    const kind = kinds[0];
    return { propertyId: property.id, name: defaultLotName(kind, lots), kind, surface: null, targetRent: null, comment: "", archived: false, sortOrder: lots.length };
  };
  const [d, setD] = useState<LotDraft>(fresh);
  const save = useMutate("lots.upsert", { success: lot ? "Lot mis à jour" : "Lot ajouté" });
  useEffect(() => {
    if (open) setD(lot ? { ...lot } : fresh());
    // `fresh` lit les lots du moment : relu à chaque ouverture.
  }, [open, lot]);
  const changeKind = (kind: LotKind) => setD((x) => ({ ...x, kind, name: !lot && x.name === defaultLotName(x.kind, lots) ? defaultLotName(kind, lots) : x.name }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lot ? `Modifier ${lot.name.toLowerCase()}` : "Nouveau lot"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !d.name.trim()} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            {lot ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Nature" help={rented && lot ? "Ce lot a déjà des baux : sa nature ne change plus." : undefined}>
            {(id) => (
              <Select id={id} value={d.kind} disabled={rented && lot != null} onChange={(e) => changeKind(e.target.value as LotKind)}>
                {choices.map((k) => (
                  <option key={k} value={k}>
                    {LOT_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Nom">{(id) => <TextInput id={id} value={d.name} onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))} />}</Field>
        </FormGrid>
        <FormGrid>
          <Field label="Surface en m² (facultative)">{(id) => <NumberInput id={id} decimals={1} value={d.surface} onChange={(v) => setD((x) => ({ ...x, surface: v != null && v > 0 ? v : null }))} />}</Field>
          <Field label="Loyer espéré (facultatif)" help="Hors charges, par mois. Sert à mesurer l'occupation et ce que coûte un lot vide.">
            {(id) => <MoneyInput id={id} value={d.targetRent} onChange={(v) => setD((x) => ({ ...x, targetRent: v }))} />}
          </Field>
        </FormGrid>
        <Field label="Commentaire (facultatif)">{(id) => <TextInput id={id} value={d.comment} onChange={(e) => setD((x) => ({ ...x, comment: e.target.value }))} />}</Field>
        {lot && <Checkbox checked={d.archived} onChange={(v) => setD((x) => ({ ...x, archived: v }))} label="Archiver : ce lot n'est plus proposé à la location (son historique reste)" />}
      </div>
    </Modal>
  );
}
