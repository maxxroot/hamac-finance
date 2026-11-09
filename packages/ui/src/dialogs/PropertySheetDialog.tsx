import { useEffect, useState } from "react";
import { ENERGY_LETTERS, PROPERTY_TYPE_LABELS, PROPERTY_TYPES, type EnergyLetter, type Property, type PropertyType } from "@hamac/core";
import { Checkbox, Field, FormGrid, Modal, NumberInput, Select, Textarea, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { useMutate } from "@/lib/workspace";

const toInt = (v: number | null) => (v == null ? null : Math.round(v));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-fg-muted">{title}</div>
      {children}
    </div>
  );
}

function EnergySelect({ label, value, onChange }: { label: string; value: EnergyLetter | null; onChange: (v: EnergyLetter | null) => void }) {
  return (
    <Field label={label}>
      {(id) => (
        <Select id={id} value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as EnergyLetter | null)}>
          <option value="">Non renseignée</option>
          {ENERGY_LETTERS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** Description du bien : tout est facultatif. */
export function PropertySheetDialog({ open, property, onClose }: { open: boolean; property: Property; onClose: () => void }) {
  const [d, setD] = useState<Property>(property);
  const save = useMutate("properties.upsert", { success: "Fiche mise à jour" });
  useEffect(() => {
    if (open) setD(property);
  }, [open, property]);
  const set = <K extends keyof Property>(k: K, v: Property[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fiche du bien"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Section title="Localisation">
          <div className="space-y-4">
            <Field label="Adresse">{(id) => <TextInput id={id} value={d.address} onChange={(e) => set("address", e.target.value)} autoFocus />}</Field>
            <FormGrid>
              <Field label="Code postal">{(id) => <TextInput id={id} value={d.postalCode} onChange={(e) => set("postalCode", e.target.value)} inputMode="numeric" />}</Field>
              <Field label="Ville">{(id) => <TextInput id={id} value={d.city} onChange={(e) => set("city", e.target.value)} />}</Field>
            </FormGrid>
          </div>
        </Section>

        <Section title="Caractéristiques">
          <FormGrid cols={3}>
            <Field label="Type de bien">
              {(id) => (
                <Select id={id} value={d.propertyType ?? ""} onChange={(e) => set("propertyType", (e.target.value || null) as PropertyType | null)}>
                  <option value="">Non renseigné</option>
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PROPERTY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Surface habitable (m²)">{(id) => <NumberInput id={id} decimals={2} value={d.surface} onChange={(v) => set("surface", v)} />}</Field>
            <Field label="Année de construction">{(id) => <NumberInput id={id} decimals={0} grouping={false} value={d.buildYear} onChange={(v) => set("buildYear", toInt(v))} />}</Field>
            <Field label="Pièces">{(id) => <NumberInput id={id} decimals={0} grouping={false} value={d.rooms} onChange={(v) => set("rooms", toInt(v))} />}</Field>
            <Field label="Chambres">{(id) => <NumberInput id={id} decimals={0} grouping={false} value={d.bedrooms} onChange={(v) => set("bedrooms", toInt(v))} />}</Field>
            <Field label="Étage">{(id) => <NumberInput id={id} decimals={0} grouping={false} value={d.floor} onChange={(v) => set("floor", toInt(v))} />}</Field>
          </FormGrid>
        </Section>

        <Section title="Équipements">
          <div className="space-y-3">
            <FormGrid>
              <Field label="Extérieur">{(id) => <TextInput id={id} value={d.outdoor} onChange={(e) => set("outdoor", e.target.value)} placeholder="ex. Balcon de 6 m²" />}</Field>
              <Field label="Chauffage">{(id) => <TextInput id={id} value={d.heating} onChange={(e) => set("heating", e.target.value)} placeholder="ex. Individuel au gaz" />}</Field>
            </FormGrid>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Checkbox checked={d.parking} onChange={(v) => set("parking", v)} label="Parking" />
              <Checkbox checked={d.cellar} onChange={(v) => set("cellar", v)} label="Cave" />
              <Checkbox checked={d.coOwnership} onChange={(v) => setD((x) => ({ ...x, coOwnership: v, syndic: v ? x.syndic : "" }))} label="En copropriété" />
            </div>
            {d.coOwnership && <Field label="Syndic">{(id) => <TextInput id={id} value={d.syndic} onChange={(e) => set("syndic", e.target.value)} />}</Field>}
          </div>
        </Section>

        <Section title="Énergie">
          <div className="space-y-3">
            <FormGrid cols={3}>
              <EnergySelect label="Note DPE" value={d.dpe} onChange={(v) => set("dpe", v)} />
              <EnergySelect label="Note climat (GES)" value={d.ges} onChange={(v) => set("ges", v)} />
              <Field label="DPE réalisé le">{(id) => <TextInput id={id} type="date" value={d.dpeDate ?? ""} onChange={(e) => set("dpeDate", e.target.value || null)} />}</Field>
            </FormGrid>
            <Checkbox checked={d.dpeReminders} onChange={(v) => set("dpeReminders", v)} label="M'alerter avant l'expiration du DPE et si cette note interdit de louer" />
          </div>
        </Section>

        <Field label="Notes">{(id) => <Textarea id={id} value={d.comment} maxLength={500} onChange={(e) => set("comment", e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}
