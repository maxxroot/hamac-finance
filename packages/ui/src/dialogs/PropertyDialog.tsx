import { useEffect, useState } from "react";
import { PROPERTY_KIND_LABELS, PROPERTY_KINDS, PROPERTY_OWNERSHIP_LABELS, PROPERTY_OWNERSHIPS, NO_PROPERTY_DETAILS, estimateNotaryFees, propertyFees, propertyTotalCost, type Property, type PropertyKind, type PropertyOwnership } from "@hamac/core";
import type { PropertyInput } from "@hamac/api";
import { Amount } from "@/components/Amount";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, PercentInput, Select, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { AllocationChoice } from "./AllocationChoice";
import { DismembermentFields, dismembermentComplete } from "@/components/DismembermentFields";
import { todayIso } from "@/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

type PropertyDraft = Required<Omit<PropertyInput, "id">> & { id?: string };

const notaryEstimate = (d: PropertyDraft) => estimateNotaryFees(d.purchasePrice ?? 0, d.newBuild, d.purchaseDate);

const emptyProperty = (): PropertyDraft => ({ kind: "residence_principale", ownership: "nom_propre", name: "", value: 0, valueDate: todayIso(), purchasePrice: null, purchaseDate: null, newBuild: false, notaryFees: 0, agencyFees: 0, initialWorks: 0, otherFees: 0, ...NO_PROPERTY_DETAILS, share: 1, inAllocation: null, classId: null, comment: "", archived: false });

export function PropertyDialog({ open, property, onClose }: { open: boolean; property: Property | null; onClose: () => void }) {
  const [d, setD] = useState<PropertyDraft>(emptyProperty());
  const save = useMutate("properties.upsert", { success: property ? "Bien mis à jour" : "Bien ajouté" });
  const idx = useWorkspaceIndex();
  const classes = idx?.ws.params.customClasses ?? [];
  const companies = (idx?.ws.companies ?? []).filter((c) => !c.archived || c.id === d.companyId);
  const viaCompany = d.ownership === "sci" || d.ownership === "sci_familiale";
  // Tant que le montant n'a pas été saisi, il suit l'estimation.
  const [notaryAuto, setNotaryAuto] = useState(true);
  useEffect(() => {
    if (!open) return;
    const draft: PropertyDraft = property ? { ...property } : emptyProperty();
    const auto = draft.notaryFees === 0;
    setNotaryAuto(auto);
    setD(auto ? { ...draft, notaryFees: notaryEstimate(draft) } : draft);
  }, [open, property]);
  const set = <K extends keyof PropertyDraft>(k: K, v: PropertyDraft[K]) =>
    setD((x) => {
      const next = { ...x, [k]: v };
      return notaryAuto ? { ...next, notaryFees: notaryEstimate(next) } : next;
    });
  const setNotary = (v: number | null) => {
    setNotaryAuto(false);
    setD((x) => ({ ...x, notaryFees: v ?? 0 }));
  };
  const applyEstimate = () => {
    setNotaryAuto(true);
    setD((x) => ({ ...x, notaryFees: notaryEstimate(x) }));
  };
  const totalCost = propertyTotalCost(d);
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
          <Button variant="primary" disabled={save.isPending || !d.name.trim() || d.share <= 0 || !dismembermentComplete(d)} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            {property ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={3}>
          <Field label="Nom">{(id) => <TextInput id={id} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="ex. Appartement Lyon" autoFocus />}</Field>
          <Field label="Utilisation">
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
          <Field label="Statut">
            {(id) => (
              <Select id={id} value={d.ownership} onChange={(e) => set("ownership", e.target.value as PropertyOwnership)}>
                {PROPERTY_OWNERSHIPS.map((o) => (
                  <option key={o} value={o}>
                    {PROPERTY_OWNERSHIP_LABELS[o]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FormGrid>
        <FormGrid cols={3}>
          <Field label="Valeur estimée" help="Du bien entier.">{(id) => <MoneyInput id={id} value={d.value} onChange={(v) => set("value", v ?? 0)} />}</Field>
          <Field label="Estimée le">{(id) => <TextInput id={id} type="date" value={d.valueDate ?? ""} onChange={(e) => set("valueDate", e.target.value || null)} />}</Field>
          <Field label={viaCompany && d.companyId ? "Part détenue par la SCI" : "Part détenue"} help={viaCompany && d.companyId ? "Souvent 100 % : vos parts de la SCI s'appliquent en plus." : "50 % pour un bien à deux, ou vos parts de la SCI."}>
            {(id) => <PercentInput id={id} value={d.share} onChange={(v) => set("share", v ?? 0)} />}
          </Field>
        </FormGrid>
        {viaCompany && (
          <Field label="Société" help={companies.length ? "La SCI qui détient le bien : ses parts et ses crédits se calculent ensemble (page Immobilier › Sociétés)." : "Créez d'abord la SCI dans la page Immobilier, carte « Sociétés (SCI) », pour y rattacher ses biens."}>
            {(id) => (
              <Select id={id} value={d.companyId ?? ""} onChange={(e) => set("companyId", e.target.value || null)}>
                <option value="">Aucune : la part détenue ci-dessus suffit</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({Math.round(c.share * 1000) / 10} % des parts)
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <DismembermentFields value={d} onChange={(v) => setD((x) => ({ ...x, ...v }))} />
        <FormGrid cols={3}>
          <Field label="Prix d'achat (facultatif)">{(id) => <MoneyInput id={id} value={d.purchasePrice} onChange={(v) => set("purchasePrice", v)} />}</Field>
          <Field label="Date d'achat (facultative)">{(id) => <TextInput id={id} type="date" value={d.purchaseDate ?? ""} onChange={(e) => set("purchaseDate", e.target.value || null)} />}</Field>
          <Field label="État à l'achat">
            {(id) => (
              <Select id={id} value={d.newBuild ? "neuf" : "ancien"} onChange={(e) => set("newBuild", e.target.value === "neuf")}>
                <option value="ancien">Ancien</option>
                <option value="neuf">Neuf ou en construction</option>
              </Select>
            )}
          </Field>
        </FormGrid>
        <div>
          <div className="mb-2 text-xs font-medium text-fg-muted">Frais d'achat, pour le bien entier (facultatifs)</div>
          <FormGrid>
            <Field
              label="Frais de notaire"
              help={
                notaryAuto ? (
                  "Estimés d'après le prix, l'état et la date d'achat. Modifiables."
                ) : (
                  <button type="button" className="underline hover:text-fg" onClick={applyEstimate}>
                    Reprendre l'estimation
                  </button>
                )
              }
            >
              {(id) => <MoneyInput id={id} value={d.notaryFees} onChange={setNotary} />}
            </Field>
            <Field label="Frais d'agence">{(id) => <MoneyInput id={id} value={d.agencyFees} onChange={(v) => set("agencyFees", v ?? 0)} />}</Field>
            <Field label="Travaux à l'achat">{(id) => <MoneyInput id={id} value={d.initialWorks} onChange={(v) => set("initialWorks", v ?? 0)} />}</Field>
            <Field label="Autres frais" help="Garantie du prêt, frais de dossier…">{(id) => <MoneyInput id={id} value={d.otherFees} onChange={(v) => set("otherFees", v ?? 0)} />}</Field>
          </FormGrid>
        </div>
        {totalCost != null ? (
          <p className="text-sm text-fg-muted">
            Coût d'achat complet : <b className="text-fg"><Amount value={totalCost} /></b>, frais compris.
          </p>
        ) : (
          propertyFees(d) > 0 && <p className="text-sm text-fg-muted">Indiquez le prix d'achat pour obtenir le coût d'achat complet.</p>
        )}
        <AllocationChoice value={d.inAllocation} defaultLabel="comme la classe Immobilier" onChange={(v) => set("inAllocation", v)} />
        {classes.length > 0 && (
          <Field label="Classe d'actifs" help="Sans classe, le bien compte dans la classe Immobilier.">
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
        {property && <Checkbox checked={d.archived} onChange={(v) => set("archived", v)} label="Archivé (ne compte plus dans le patrimoine)" />}
      </div>
    </Modal>
  );
}
