import { useEffect, useState } from "react";
import { FULL_OWNERSHIP, OTHER_ASSET_KIND_LABELS, OTHER_ASSET_KINDS, canBeDismembered, type OtherAsset, type OtherAssetKind } from "@hamac/core";
import type { OtherAssetInput } from "@hamac/api";
import { DismembermentFields, dismembermentComplete } from "@/shared/components/DismembermentFields";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, NumberInput, PercentInput, Select, Textarea, TextInput } from "@/shared/components/form";
import { Button } from "@/shared/components/ui";
import { todayIso } from "@/shared/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/shared/lib/workspace";
import { AllocationChoice } from "@/features/entry";

type Draft = Required<Omit<OtherAssetInput, "id">> & { id?: string };

/** Valeurs de départ selon le type : décote et délai habituels, modifiables. */
const DEFAULTS: Record<OtherAssetKind, Pick<Draft, "quickSaleDiscount" | "saleDelayMonths" | "depreciation">> = {
  metal: { quickSaleDiscount: 0.05, saleDelayMonths: 0, depreciation: null },
  objet: { quickSaleDiscount: 0.3, saleDelayMonths: 6, depreciation: null },
  vehicule: { quickSaleDiscount: 0.15, saleDelayMonths: 1, depreciation: 0.15 },
  societe: { quickSaleDiscount: 0.3, saleDelayMonths: 12, depreciation: null },
  compte_courant: { quickSaleDiscount: null, saleDelayMonths: 12, depreciation: null },
  pret: { quickSaleDiscount: null, saleDelayMonths: null, depreciation: null },
  autre: { quickSaleDiscount: 0.3, saleDelayMonths: 3, depreciation: null },
};

const empty = (kind: OtherAssetKind = "metal"): Draft => ({
  kind,
  name: "",
  value: 0,
  valueDate: todayIso(),
  purchasePrice: null,
  purchaseDate: null,
  share: 1,
  dismemberment: "pleine",
  usufructBirthDate: null,
  usufructEnd: null,
  ...DEFAULTS[kind],
  loanPrincipal: null,
  loanRate: null,
  loanTermMonths: null,
  loanFirstPayment: null,
  classId: null,
  inAllocation: null,
  comment: "",
  archived: false,
});

export function OtherAssetDialog({ open, asset, onClose }: Readonly<{ open: boolean; asset: OtherAsset | null; onClose: () => void }>) {
  const [d, setD] = useState<Draft>(empty());
  const save = useMutate("otherAssets.upsert", { success: asset ? "Bien mis à jour" : "Bien ajouté" });
  const classes = useWorkspaceIndex()?.ws.params.customClasses ?? [];
  useEffect(() => {
    if (open) setD(asset ? { ...asset } : empty());
  }, [open, asset]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const pret = d.kind === "pret";
  const schedule = pret && d.loanPrincipal != null && d.loanTermMonths != null && d.loanFirstPayment != null;
  const valid = d.name.trim() && d.share > 0 && (!canBeDismembered(d.kind) || dismembermentComplete(d));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={asset ? "Modifier le bien" : "Nouveau bien"}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!valid || save.isPending} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            {asset ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={2}>
          <Field label="Type">
            {(id) => (
              <Select
                id={id}
                value={d.kind}
                onChange={(e) => {
                  const kind = e.target.value as OtherAssetKind;
                  // À la création, le type propose sa décote et son délai habituels.
                  // Hors parts de société, le bien est en pleine propriété.
                  const ownership = canBeDismembered(kind) ? {} : FULL_OWNERSHIP;
                  setD((x) => (asset ? { ...x, kind, ...ownership } : { ...x, kind, ...DEFAULTS[kind], ...ownership }));
                }}
              >
                {OTHER_ASSET_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {OTHER_ASSET_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Nom">{(id) => <TextInput id={id} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder={pret ? "ex. Prêt à un proche" : "ex. Pièces d'or"} autoFocus />}</Field>
        </FormGrid>

        {pret && (
          <div>
            <div className="mb-2 text-xs font-medium text-fg-muted">Échéancier (facultatif) : la somme due se calcule alors toute seule</div>
            <FormGrid>
              <Field label="Somme prêtée">{(id) => <MoneyInput id={id} value={d.loanPrincipal} onChange={(v) => set("loanPrincipal", v)} />}</Field>
              <Field label="Taux annuel">{(id) => <PercentInput id={id} value={d.loanRate} onChange={(v) => set("loanRate", v)} />}</Field>
              <Field label="Durée (mois)">{(id) => <NumberInput id={id} decimals={0} value={d.loanTermMonths} onChange={(v) => set("loanTermMonths", v == null ? null : Math.max(1, Math.round(v)))} />}</Field>
              <Field label="Première échéance">{(id) => <TextInput id={id} type="date" value={d.loanFirstPayment ?? ""} onChange={(e) => set("loanFirstPayment", e.target.value || null)} />}</Field>
            </FormGrid>
            <p className="mt-1.5 text-xs text-fg-faint">Un prêt de plus de 5 000 € se déclare aux impôts (formulaire 2062), et une reconnaissance de dette protège les deux parties.</p>
          </div>
        )}

        {!schedule && (
          <FormGrid cols={3}>
            <Field label={pret ? "Somme encore due" : "Valeur estimée"} help={pret ? undefined : "Du bien entier."}>
              {(id) => <MoneyInput id={id} value={d.value} onChange={(v) => set("value", v ?? 0)} />}
            </Field>
            <Field label="Estimée le">{(id) => <TextInput id={id} type="date" value={d.valueDate ?? ""} onChange={(e) => set("valueDate", e.target.value || null)} />}</Field>
            {!pret && (
              <Field label="Baisse de valeur par an" help={d.kind === "vehicule" ? "Une voiture perd souvent 15 % par an." : "Facultative."}>
                {(id) => <PercentInput id={id} value={d.depreciation} onChange={(v) => set("depreciation", v)} />}
              </Field>
            )}
          </FormGrid>
        )}

        <FormGrid cols={3}>
          <Field label={pret ? "Date du prêt" : "Date d'achat"} help="Sert au calcul de l'impôt à la vente.">
            {(id) => <TextInput id={id} type="date" value={d.purchaseDate ?? ""} onChange={(e) => set("purchaseDate", e.target.value || null)} />}
          </Field>
          {!pret && <Field label="Prix d'achat" help="Facultatif, pour le bien entier.">{(id) => <MoneyInput id={id} value={d.purchasePrice} onChange={(v) => set("purchasePrice", v)} />}</Field>}
          <Field label="Part détenue" help="50 % pour un bien à deux.">{(id) => <PercentInput id={id} value={d.share} onChange={(v) => set("share", v == null ? 1 : Math.min(1, Math.max(0.01, v)))} />}</Field>
        </FormGrid>

        {canBeDismembered(d.kind) && <DismembermentFields value={d} onChange={(v) => setD((x) => ({ ...x, ...v }))} />}

        <FormGrid cols={2}>
          <Field label="Décote en cas de vente rapide" help="Ce qu'on perd en vendant vite.">
            {(id) => <PercentInput id={id} value={d.quickSaleDiscount} onChange={(v) => set("quickSaleDiscount", v)} />}
          </Field>
          <Field label="Délai pour vendre ou récupérer l'argent (mois)" help={pret ? "Sans échéancier : quand le prêt doit être remboursé." : undefined}>
            {(id) => <NumberInput id={id} decimals={0} value={d.saleDelayMonths} onChange={(v) => set("saleDelayMonths", v == null ? null : Math.max(0, Math.round(v)))} />}
          </Field>
        </FormGrid>

        {classes.length > 0 && (
          <FormGrid cols={2}>
            <Field label="Classe d'actifs" help="Sans classe, le bien reste hors de la répartition.">
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
          </FormGrid>
        )}
        {d.classId && <AllocationChoice value={d.inAllocation} defaultLabel="comme sa classe" onChange={(v) => set("inAllocation", v)} />}

        <Field label="Commentaire">{(id) => <Textarea id={id} value={d.comment} onChange={(e) => set("comment", e.target.value)} placeholder="Où il se trouve, factures, certificat d'authenticité…" />}</Field>
        {asset && <Checkbox checked={d.archived} onChange={(v) => set("archived", v)} label="Archivé : ne compte plus dans le patrimoine, historique compris" />}
      </div>
    </Modal>
  );
}
