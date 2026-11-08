import { useEffect, useState } from "react";
import { PROPERTY_KIND_LABELS, PROPERTY_KINDS, type Property, type PropertyKind } from "@hamac/core";
import type { PropertyInput } from "@hamac/api";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, PercentInput, Select, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { todayIso } from "@/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

type PropertyDraft = Required<Omit<PropertyInput, "id">> & { id?: string };

const emptyProperty = (): PropertyDraft => ({ kind: "residence_principale", name: "", value: 0, valueDate: todayIso(), purchasePrice: null, purchaseDate: null, share: 1, inAllocation: false, classId: null, comment: "", archived: false });

export function PropertyDialog({ open, property, onClose }: { open: boolean; property: Property | null; onClose: () => void }) {
  const [d, setD] = useState<PropertyDraft>(emptyProperty());
  const save = useMutate("properties.upsert", { success: property ? "Bien mis à jour" : "Bien ajouté" });
  const classes = useWorkspaceIndex()?.ws.params.customClasses ?? [];
  useEffect(() => {
    if (open) setD(property ? { ...property } : emptyProperty());
  }, [open, property]);
  const set = <K extends keyof PropertyDraft>(k: K, v: PropertyDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={property ? "Modifier le bien" : "Nouveau bien"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !d.name.trim() || d.share <= 0} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            {property ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Nom">{(id) => <TextInput id={id} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="ex. Appartement Lyon" autoFocus />}</Field>
          <Field label="Type">
            {(id) => (
              <Select id={id} value={d.kind} onChange={(e) => set("kind", e.target.value as PropertyKind)}>
                {PROPERTY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {PROPERTY_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FormGrid>
        <FormGrid cols={3}>
          <Field label="Valeur estimée" help="Du bien entier.">{(id) => <MoneyInput id={id} value={d.value} onChange={(v) => set("value", v ?? 0)} />}</Field>
          <Field label="Estimée le">{(id) => <TextInput id={id} type="date" value={d.valueDate ?? ""} onChange={(e) => set("valueDate", e.target.value || null)} />}</Field>
          <Field label="Part détenue" help="50 % pour un bien à deux.">{(id) => <PercentInput id={id} value={d.share} onChange={(v) => set("share", v ?? 0)} />}</Field>
        </FormGrid>
        <FormGrid>
          <Field label="Prix d'achat (facultatif)">{(id) => <MoneyInput id={id} value={d.purchasePrice} onChange={(v) => set("purchasePrice", v)} />}</Field>
          <Field label="Date d'achat (facultative)">{(id) => <TextInput id={id} type="date" value={d.purchaseDate ?? ""} onChange={(e) => set("purchaseDate", e.target.value || null)} />}</Field>
        </FormGrid>
        <Checkbox checked={d.inAllocation} onChange={(v) => set("inAllocation", v)} label="Inclure ce bien dans l'allocation cible" />
        {d.inAllocation && classes.length > 0 && (
          <Field label="Classe d'actifs" help="Sans classe, le bien compte avec les actions.">
            {(id) => (
              <Select id={id} value={d.classId ?? ""} onChange={(e) => set("classId", e.target.value || null)}>
                <option value="">Aucune</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {property && <Checkbox checked={d.archived} onChange={(v) => set("archived", v)} label="Archivé (vendu : ne compte plus dans le patrimoine)" />}
      </div>
    </Modal>
  );
}
