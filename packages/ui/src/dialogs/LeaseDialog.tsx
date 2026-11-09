import { useEffect, useState } from "react";
import { LEASE_KIND_LABELS, LEASE_KINDS, defaultLeaseMonths, defaultTenantNoticeMonths, leaseDurationNote, leaseEnd, leaseRenews, maxDeposit, validateLease, type Lease, type LeaseKind, type LeaseNoticeBy, type Property } from "@hamac/core";
import type { LeaseInput } from "@hamac/api";
import { Amount } from "@/components/Amount";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, NumberInput, Select, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { formatDate, todayIso } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

type LeaseDraft = Required<Omit<LeaseInput, "id">> & { id?: string };

const emptyLease = (property: Property): LeaseDraft => ({ propertyId: property.id, kind: "vide", tenant: "", startDate: todayIso(), durationMonths: defaultLeaseMonths("vide", property.ownership), rent: 0, charges: 0, deposit: 0, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", guarantor: "", tenantInsuranceUntil: null });

export function LeaseDialog({ open, property, lease, others, onClose }: { open: boolean; property: Property; lease: Lease | null; others: readonly Lease[]; onClose: () => void }) {
  const [d, setD] = useState<LeaseDraft>(() => emptyLease(property));
  // Tant qu'il n'a pas été saisi, le dépôt suit le plafond légal.
  const [depositAuto, setDepositAuto] = useState(true);
  const save = useMutate("leases.upsert", { success: lease ? "Bail mis à jour" : "Bail ajouté" });
  useEffect(() => {
    if (!open) return;
    setD(lease ? { ...lease } : emptyLease(property));
    setDepositAuto(!lease);
  }, [open, lease, property]);

  const update = (patch: Partial<LeaseDraft>) =>
    setD((x) => {
      const next = { ...x, ...patch };
      return depositAuto ? { ...next, deposit: maxDeposit(next.kind, next.rent) ?? 0 } : next;
    });
  const changeKind = (kind: LeaseKind) =>
    update({ kind, durationMonths: defaultLeaseMonths(kind, property.ownership), noticeMonths: null, ...(!leaseRenews(kind) && d.noticeBy === "proprietaire" ? { noticeBy: null, noticeDate: null } : {}) });
  const changeNoticeBy = (by: LeaseNoticeBy | null) => update(by ? { noticeBy: by, noticeDate: d.noticeDate ?? todayIso(), noticeMonths: null } : { noticeBy: null, noticeDate: null, noticeMonths: null });

  const error = validateLease(d, others);
  const end = leaseEnd(d);
  const depositCap = maxDeposit(d.kind, d.rent);
  const depositTooHigh = depositCap != null && d.deposit > depositCap;
  const noticeChoice = d.kind === "vide" || d.kind === "autre";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lease ? "Modifier le bail" : "Nouveau bail"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !d.startDate || d.durationMonths < 1 || d.rent <= 0 || error != null || (d.depositReturned != null && !d.depositReturnedOn)} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            {lease ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Type de bail">
            {(id) => (
              <Select id={id} value={d.kind} onChange={(e) => changeKind(e.target.value as LeaseKind)}>
                {LEASE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LEASE_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Locataire (facultatif)">{(id) => <TextInput id={id} value={d.tenant} onChange={(e) => update({ tenant: e.target.value })} />}</Field>
        </FormGrid>
        <FormGrid>
          <Field label="Début du bail">{(id) => <TextInput id={id} type="date" value={d.startDate} onChange={(e) => update({ startDate: e.target.value })} />}</Field>
          <Field label="Durée (mois)" help={leaseDurationNote(d.kind, property.ownership, d.durationMonths) ?? `Soit ${Math.round((d.durationMonths / 12) * 10) / 10} ans.`}>
            {(id) => <NumberInput id={id} decimals={0} grouping={false} value={d.durationMonths} onChange={(v) => update({ durationMonths: v == null ? 0 : Math.round(v) })} />}
          </Field>
        </FormGrid>
        <FormGrid cols={3}>
          <Field label="Loyer hors charges" help="Par mois, pour le bien entier.">{(id) => <MoneyInput id={id} value={d.rent} onChange={(v) => update({ rent: v ?? 0 })} />}</Field>
          <Field label="Charges" help="Récupérables, par mois.">{(id) => <MoneyInput id={id} value={d.charges} onChange={(v) => update({ charges: v ?? 0 })} />}</Field>
          <Field
            label="Dépôt de garantie (caution)"
            help={depositTooHigh ? <span className="text-warning">Au-delà du maximum légal de {<Amount value={depositCap} />}.</span> : d.kind === "mobilite" ? "Interdit pour un bail mobilité." : "Calculé d'après le loyer, modifiable."}
          >
            {(id) => (
              <MoneyInput
                id={id}
                value={d.deposit}
                onChange={(v) => {
                  setDepositAuto(false);
                  setD((x) => ({ ...x, deposit: v ?? 0 }));
                }}
              />
            )}
          </Field>
        </FormGrid>

        <FormGrid cols={3}>
          <Field label="Propriétaire (facultatif)" help="Nom imprimé sur les quittances.">{(id) => <TextInput id={id} value={d.landlord} onChange={(e) => update({ landlord: e.target.value })} />}</Field>
          <Field label="Garant (facultatif)">{(id) => <TextInput id={id} value={d.guarantor} onChange={(e) => update({ guarantor: e.target.value })} />}</Field>
          <Field label="Assurance du locataire valable jusqu'au">{(id) => <TextInput id={id} type="date" value={d.tenantInsuranceUntil ?? ""} onChange={(e) => update({ tenantInsuranceUntil: e.target.value || null })} />}</Field>
        </FormGrid>
        <Checkbox checked={d.reminders} onChange={(v) => update({ reminders: v })} label="Me rappeler les échéances de ce bail, deux mois à l'avance" />

        {lease && (
          <div>
            <div className="mb-2 text-xs font-medium text-fg-muted">Fin du bail</div>
            <FormGrid cols={3}>
              <Field label="Congé">
                {(id) => (
                  <Select id={id} value={d.noticeBy ?? ""} onChange={(e) => changeNoticeBy((e.target.value || null) as LeaseNoticeBy | null)}>
                    <option value="">Aucun</option>
                    <option value="locataire">Donné par le locataire</option>
                    {leaseRenews(d.kind) && <option value="proprietaire">Donné par le propriétaire</option>}
                  </Select>
                )}
              </Field>
              {d.noticeBy && <Field label="Reçu le">{(id) => <TextInput id={id} type="date" value={d.noticeDate ?? ""} onChange={(e) => update({ noticeDate: e.target.value || null })} />}</Field>}
              {d.noticeBy === "locataire" && noticeChoice && (
                <Field label="Préavis" help="1 mois : motif justifié ou commune en zone tendue.">
                  {(id) => (
                    <Select id={id} value={String(d.noticeMonths ?? defaultTenantNoticeMonths(d.kind))} onChange={(e) => update({ noticeMonths: Number(e.target.value) })}>
                      <option value="3">3 mois</option>
                      <option value="1">1 mois</option>
                    </Select>
                  )}
                </Field>
              )}
              <Field label="Départ réel (facultatif)" help="Si différent de la fin calculée.">{(id) => <TextInput id={id} type="date" value={d.actualEnd ?? ""} onChange={(e) => update({ actualEnd: e.target.value || null })} />}</Field>
            </FormGrid>
            <div className="mt-4">
              <FormGrid cols={3}>
                <Field label="Dépôt rendu" help="Montant restitué à la sortie.">
                  {(id) => <MoneyInput id={id} value={d.depositReturned} onChange={(v) => setD((x) => ({ ...x, depositReturned: v, depositReturnedOn: v == null ? null : (x.depositReturnedOn ?? todayIso()) }))} />}
                </Field>
                {d.depositReturned != null && <Field label="Rendu le">{(id) => <TextInput id={id} type="date" value={d.depositReturnedOn ?? ""} onChange={(e) => setD((x) => ({ ...x, depositReturnedOn: e.target.value || null }))} />}</Field>}
                {d.depositReturned != null && d.depositReturned < d.deposit && <Field label="Motif de la retenue">{(id) => <TextInput id={id} value={d.depositReason} onChange={(e) => setD((x) => ({ ...x, depositReason: e.target.value }))} />}</Field>}
              </FormGrid>
            </div>
          </div>
        )}

        {error ? <p className="text-sm text-negative">{error}</p> : <p className="text-sm text-fg-muted">{end ? `Le bail se termine le ${formatDate(end)}.` : "Sans congé, le bail se reconduit automatiquement pour la même durée."}</p>}
      </div>
    </Modal>
  );
}
