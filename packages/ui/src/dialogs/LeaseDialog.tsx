import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LEASE_GUARANTEE_KINDS, LEASE_GUARANTEE_LABELS, LEASE_KIND_LABELS, defaultLeaseMonths, defaultTenantNoticeMonths, leaseDurationNote, leaseEnd, leaseKindsFor, leaseRenews, leaseRenters, maxDeposit, renterName, validateLease, type Lease, type LeaseGuaranteeKind, type LeaseKind, type LeaseNoticeBy, type Lot, type Property } from "@hamac/core";
import type { LeaseGuaranteeInput, LeaseInput, RenterInput } from "@hamac/api";
import { Amount } from "@/components/Amount";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, NumberInput, Select, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { formatDate, todayIso } from "@/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

type RenterRow = Required<Omit<RenterInput, "id">> & { id?: string };
type GuaranteeRow = Required<Omit<LeaseGuaranteeInput, "id">> & { id?: string };
type LeaseDraft = Required<Omit<LeaseInput, "id" | "renters" | "guarantees">> & { id?: string; renters: RenterRow[]; guarantees: GuaranteeRow[] };

const emptyRenter = (): RenterRow => ({ firstName: "", lastName: "", email: "", phone: "", forwardingAddress: "", comment: "" });
const emptyGuarantee = (): GuaranteeRow => ({ kind: "caution", name: "", contact: "", amount: null, until: null, comment: "" });

const emptyLease = (property: Property, lot: Lot | null, kind: LeaseKind): LeaseDraft => ({ propertyId: property.id, lotId: lot?.id ?? null, kind, renters: [emptyRenter()], guarantees: [], startDate: todayIso(), durationMonths: defaultLeaseMonths(kind, property.ownership), rent: 0, charges: 0, deposit: 0, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: null, landlordAddress: "", dueDay: 1 });

/** Bail d'un lot : `lot` null pour un bien sans lot, dont le logement sera créé au premier bail. */
export function LeaseDialog({ open, property, lot, lease, others, onClose }: { open: boolean; property: Property; lot: Lot | null; lease: Lease | null; others: readonly Lease[]; onClose: () => void }) {
  const idx = useWorkspaceIndex();
  const ws = idx?.ws;
  const lotKind = lot?.kind ?? (property.rentalMode === "chambres" ? "chambre" : "logement");
  const allowed = leaseKindsFor(property.rentalMode, lotKind);
  const kinds = lease && !allowed.includes(lease.kind) ? [lease.kind, ...allowed] : allowed;
  const [d, setD] = useState<LeaseDraft>(() => emptyLease(property, lot, allowed[0]));
  // Tant qu'il n'a pas été saisi, le dépôt suit le plafond légal.
  const [depositAuto, setDepositAuto] = useState(true);
  const save = useMutate("leases.upsert", { success: lease ? "Bail mis à jour" : "Bail ajouté" });
  useEffect(() => {
    if (!open) return;
    if (lease && ws) {
      const renters = leaseRenters(lease.id, ws.leaseRenters, ws.renters).map(({ id, firstName, lastName, email, phone, forwardingAddress, comment }) => ({ id, firstName, lastName, email, phone, forwardingAddress, comment }));
      const guarantees = ws.leaseGuarantees.filter((g) => g.leaseId === lease.id).sort((a, b) => a.sortOrder - b.sortOrder).map(({ id, kind, name, contact, amount, until, comment }) => ({ id, kind, name, contact, amount, until, comment }));
      setD({ ...lease, renters, guarantees });
    } else setD(emptyLease(property, lot, allowed[0]));
    setDepositAuto(!lease);
  }, [open, lease, property, lot]);

  const update = (patch: Partial<LeaseDraft>) =>
    setD((x) => {
      const next = { ...x, ...patch };
      return depositAuto ? { ...next, deposit: maxDeposit(next.kind, next.rent) ?? 0 } : next;
    });
  const changeKind = (kind: LeaseKind) =>
    update({ kind, durationMonths: defaultLeaseMonths(kind, property.ownership), noticeMonths: null, ...(!leaseRenews(kind) && d.noticeBy === "proprietaire" ? { noticeBy: null, noticeDate: null } : {}) });
  const changeNoticeBy = (by: LeaseNoticeBy | null) => update(by ? { noticeBy: by, noticeDate: d.noticeDate ?? todayIso(), noticeMonths: null } : { noticeBy: null, noticeDate: null, noticeMonths: null });
  const setRenter = (i: number, patch: Partial<RenterRow>) => setD((x) => ({ ...x, renters: x.renters.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const setGuarantee = (i: number, patch: Partial<GuaranteeRow>) => setD((x) => ({ ...x, guarantees: x.guarantees.map((g, j) => (j === i ? { ...g, ...patch } : g)) }));

  const lots = ws?.lots.filter((l) => l.propertyId === property.id) ?? [];
  const error = validateLease(d, others, lots);
  const end = error ? null : leaseEnd(d);
  const depositCap = maxDeposit(d.kind, d.rent);
  const depositTooHigh = depositCap != null && d.deposit > depositCap;
  const noticeChoice = d.kind === "vide" || d.kind === "autre";
  // Une ligne restée vide est ignorée ; une ligne commencée demande un nom.
  const blank = (r: RenterRow) => !r.id && ![r.firstName, r.lastName, r.email, r.phone, r.forwardingAddress].some((v) => v.trim());
  const unnamed = d.renters.some((r) => !blank(r) && !r.firstName.trim() && !r.lastName.trim());
  const reusable = (ws?.renters ?? []).filter((r) => !d.renters.some((x) => x.id === r.id)).sort((a, b) => renterName(a).localeCompare(renterName(b), "fr"));
  const colocation = property.rentalMode === "colocation";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lease ? "Modifier le bail" : lot ? `Nouveau bail · ${lot.name}` : "Nouveau bail"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !d.startDate || d.durationMonths < 1 || d.rent <= 0 || error != null || unnamed || (d.depositReturned != null && !d.depositReturnedOn)} onClick={() => save.mutate({ ...d, renters: d.renters.filter((r) => !blank(r)) }, { onSuccess: onClose })}>
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
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {LEASE_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Début du bail">{(id) => <TextInput id={id} type="date" value={d.startDate} onChange={(e) => update({ startDate: e.target.value })} />}</Field>
        </FormGrid>
        <FormGrid>
          <Field label="Durée (mois)" help={leaseDurationNote(d.kind, property.ownership, d.durationMonths) ?? `Soit ${Math.round((d.durationMonths / 12) * 10) / 10} ans.`}>
            {(id) => <NumberInput id={id} decimals={0} grouping={false} value={d.durationMonths} onChange={(v) => update({ durationMonths: v == null ? 0 : Math.round(v) })} />}
          </Field>
          <Field label="Loyer dû le" help="Jour du mois prévu au bail.">
            {(id) => <NumberInput id={id} decimals={0} grouping={false} value={d.dueDay} onChange={(v) => update({ dueDay: v == null ? 1 : Math.min(31, Math.max(1, Math.round(v))) })} />}
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Assurance du locataire valable jusqu'au">{(id) => <TextInput id={id} type="date" value={d.tenantInsuranceUntil ?? ""} onChange={(e) => update({ tenantInsuranceUntil: e.target.value || null })} />}</Field>
        </FormGrid>
        <FormGrid cols={3}>
          <Field label="Loyer hors charges" help={lot && lot.kind !== "logement" ? `Par mois, pour ${lot.name.toLowerCase()}.` : "Par mois, pour le logement entier."}>{(id) => <MoneyInput id={id} value={d.rent} onChange={(v) => update({ rent: v ?? 0 })} />}</Field>
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

        <section aria-label="Locataires">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium text-fg-muted">{colocation ? "Colocataires (chacun signe le bail)" : "Locataires"}</div>
            <div className="flex flex-wrap gap-2">
              {reusable.length > 0 && (
                <Select
                  aria-label="Reprendre un locataire déjà saisi"
                  value=""
                  onChange={(e) => {
                    const r = reusable.find((x) => x.id === e.target.value);
                    if (r) setD((x) => ({ ...x, renters: [...x.renters.filter((y) => y.id || y.firstName.trim() || y.lastName.trim()), { id: r.id, firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone, forwardingAddress: r.forwardingAddress, comment: r.comment }] }));
                  }}
                >
                  <option value="">Reprendre un locataire…</option>
                  {reusable.map((r) => (
                    <option key={r.id} value={r.id}>
                      {renterName(r)}
                    </option>
                  ))}
                </Select>
              )}
              <Button className="h-8" onClick={() => setD((x) => ({ ...x, renters: [...x.renters, emptyRenter()] }))}>
                <Plus size={14} /> Ajouter un locataire
              </Button>
            </div>
          </div>
          {d.renters.length === 0 && <p className="text-sm text-fg-muted">Aucun locataire indiqué.</p>}
          <div className="space-y-3">
            {d.renters.map((r, i) => (
              <div key={r.id ?? `nouveau-${i}`} className="rounded-lg border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{renterName(r) || `Locataire ${i + 1}`}</span>
                  <button className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label={`Retirer ${renterName(r) || `le locataire ${i + 1}`}`} onClick={() => setD((x) => ({ ...x, renters: x.renters.filter((_, j) => j !== i) }))}>
                    <X size={14} />
                  </button>
                </div>
                <FormGrid>
                  <Field label="Prénom">{(id) => <TextInput id={id} value={r.firstName} onChange={(e) => setRenter(i, { firstName: e.target.value })} />}</Field>
                  <Field label="Nom">{(id) => <TextInput id={id} value={r.lastName} onChange={(e) => setRenter(i, { lastName: e.target.value })} />}</Field>
                  <Field label="E-mail (facultatif)">{(id) => <TextInput id={id} type="email" value={r.email} onChange={(e) => setRenter(i, { email: e.target.value })} />}</Field>
                  <Field label="Téléphone (facultatif)">{(id) => <TextInput id={id} type="tel" value={r.phone} onChange={(e) => setRenter(i, { phone: e.target.value })} />}</Field>
                </FormGrid>
                {lease && <div className="mt-3"><Field label="Adresse après le départ (facultative)" help="Pour rendre le dépôt de garantie.">{(id) => <TextInput id={id} value={r.forwardingAddress} onChange={(e) => setRenter(i, { forwardingAddress: e.target.value })} />}</Field></div>}
              </div>
            ))}
          </div>
          {unnamed && <p className="mt-2 text-sm text-warning">Indiquez le prénom ou le nom de chaque locataire, ou retirez la ligne.</p>}
        </section>

        <section aria-label="Garanties">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-fg-muted">Garanties</div>
            <Button className="h-8" onClick={() => setD((x) => ({ ...x, guarantees: [...x.guarantees, emptyGuarantee()] }))}>
              <Plus size={14} /> Ajouter une garantie
            </Button>
          </div>
          {d.guarantees.length === 0 && <p className="text-sm text-fg-muted">Aucune garantie : caution d'une personne, Visale, assurance loyers impayés…</p>}
          <div className="space-y-3">
            {d.guarantees.map((g, i) => (
              <div key={g.id ?? `nouvelle-${i}`} className="rounded-lg border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{LEASE_GUARANTEE_LABELS[g.kind]}</span>
                  <button className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label={`Retirer la garantie ${i + 1}`} onClick={() => setD((x) => ({ ...x, guarantees: x.guarantees.filter((_, j) => j !== i) }))}>
                    <X size={14} />
                  </button>
                </div>
                <FormGrid>
                  <Field label="Type">
                    {(id) => (
                      <Select id={id} value={g.kind} onChange={(e) => setGuarantee(i, { kind: e.target.value as LeaseGuaranteeKind })}>
                        {LEASE_GUARANTEE_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {LEASE_GUARANTEE_LABELS[k]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={g.kind === "caution" ? "Personne qui se porte caution" : "Organisme"}>{(id) => <TextInput id={id} value={g.name} onChange={(e) => setGuarantee(i, { name: e.target.value })} />}</Field>
                  <Field label="Coordonnées (facultatives)">{(id) => <TextInput id={id} value={g.contact} onChange={(e) => setGuarantee(i, { contact: e.target.value })} />}</Field>
                  <Field label="Montant garanti (facultatif)">{(id) => <MoneyInput id={id} value={g.amount} onChange={(v) => setGuarantee(i, { amount: v })} />}</Field>
                  <Field label="Jusqu'au (facultatif)" help="Fin de l'engagement, s'il est limité.">{(id) => <TextInput id={id} type="date" value={g.until ?? ""} onChange={(e) => setGuarantee(i, { until: e.target.value || null })} />}</Field>
                </FormGrid>
              </div>
            ))}
          </div>
        </section>

        <FormGrid>
          <Field label="Propriétaire (facultatif)" help="Nom imprimé sur les quittances.">{(id) => <TextInput id={id} value={d.landlord} onChange={(e) => update({ landlord: e.target.value })} />}</Field>
          <Field label="Adresse du propriétaire (facultative)" help="Imprimée sur le courrier de révision.">{(id) => <TextInput id={id} value={d.landlordAddress} onChange={(e) => update({ landlordAddress: e.target.value })} />}</Field>
        </FormGrid>
        {(d.kind === "vide" || d.kind === "meuble") && (
          <FormGrid>
            <div className="flex items-end pb-2">
              <Checkbox checked={d.revisable} onChange={(v) => update({ revisable: v })} label="Le bail prévoit une révision annuelle du loyer" />
            </div>
            {d.revisable && (
              <Field label="Trimestre de référence de l'indice" help="Indiqué dans le bail.">
                {(id) => (
                  <Select id={id} value={d.irlQuarter ?? ""} onChange={(e) => update({ irlQuarter: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Dernier publié à la date du bail</option>
                    <option value="1">1er trimestre</option>
                    <option value="2">2e trimestre</option>
                    <option value="3">3e trimestre</option>
                    <option value="4">4e trimestre</option>
                  </Select>
                )}
              </Field>
            )}
          </FormGrid>
        )}
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
