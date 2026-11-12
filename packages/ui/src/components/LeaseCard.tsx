import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { LEASE_GUARANTEE_LABELS, LEASE_KIND_LABELS, LEASE_STATUS_LABELS, leaseRenterNames, type Lot, NO_IRL_DATA, currentLease, depositRetained, dpeFreezesRent, irlQuarterLabel, leaseState, pendingRevisionAnniversary, proposeRevision, type Lease, type LeaseRent, type LeaseState, type Property, type RevisionProposal } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { ArrearsPanel } from "@/components/ArrearsPanel";
import { DetailLine } from "@/components/DetailLine";
import { RowActions } from "@/components/RowActions";
import { Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { LeaseDialog } from "@/dialogs/LeaseDialog";
import { LeaseRentDialog } from "@/dialogs/LeaseRentDialog";
import { RentRevisionDialog } from "@/dialogs/RentRevisionDialog";
import { formatDate, formatMonth } from "@/lib/numbers";
import { call } from "@/lib/transport";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

/**
 * Le bail en cours d'un lot, ses échéances, l'évolution du loyer et les baux précédents.
 * `lot` null : bien sans lot, dont le logement sera créé au premier bail. `all` : tous les baux du bien, pour les chevauchements.
 */
export function LeaseCard({ property, lot, named, leases, all, rents, today }: { property: Property; lot: Lot | null; named: boolean; leases: readonly Lease[]; all: readonly Lease[]; rents: readonly LeaseRent[]; today: string }) {
  const ws = useWorkspaceIndex()?.ws;
  const names = (l: Lease) => (ws ? leaseRenterNames(l.id, ws.leaseRenters, ws.renters) : "");
  const describeLease = (l: Lease) => [LEASE_KIND_LABELS[l.kind], names(l)].filter(Boolean).join(" · ");
  const [editing, setEditing] = useState<Lease | "new" | null>(null);
  const [newRent, setNewRent] = useState<LeaseState | null>(null);
  const deleteLease = useMutate("leases.delete", { success: "Bail supprimé" });
  const deleteRent = useMutate("leaseRents.delete", { success: "Loyer supprimé" });
  const states = leases.map((l) => leaseState(l, rents, today));
  const current = currentLease(states);
  const previous = states.filter((s) => s !== current).sort((a, b) => b.lease.startDate.localeCompare(a.lease.startDate));
  const currentRents = current ? rents.filter((r) => r.leaseId === current.lease.id) : [];
  const editedId = editing && editing !== "new" ? editing.id : null;
  const active = current?.status === "en_cours" || current?.status === "conge" ? current : null;
  const due = active ? pendingRevisionAnniversary(active.lease, rents, today) : null;
  const frozen = dpeFreezesRent(property.dpe);
  // L'indice ne change que quatre fois par an : inutile de le redemander à chaque affichage.
  const irl = useQuery({ queryKey: ["market.irl"], queryFn: () => call("market.irl"), enabled: due != null && !frozen, staleTime: 3_600_000 });
  const proposal = active && due && !frozen && !irl.isLoading ? proposeRevision(active.lease, rents, irl.data ?? NO_IRL_DATA, property, today) : null;
  const [revising, setRevising] = useState<RevisionProposal | null>(null);

  return (
    <Card>
      <CardTitle
        hint={
          <Button className="h-8" variant={current ? "secondary" : "primary"} onClick={() => setEditing("new")}>
            <Plus size={14} /> Nouveau bail
          </Button>
        }
      >
        {named && lot ? `Bail · ${lot.name}` : "Bail"}
      </CardTitle>
      {!current && <p className="text-sm text-fg-muted">{lot && named ? `Aucun bail pour ${lot.name.toLowerCase()}.` : "Aucun bail."} Ajoutez-en un pour suivre les loyers et les échéances.</p>}
      {current && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{describeLease(current.lease)}</span>
            <Badge tone={current.status === "en_cours" ? "accent" : "neutral"}>{LEASE_STATUS_LABELS[current.status]}</Badge>
          </div>
          <DetailLine label="Début">{formatDate(current.lease.startDate)}</DetailLine>
          <DetailLine label="Durée">{current.lease.durationMonths} mois</DetailLine>
          {current.end ? <DetailLine label="Fin du bail">{formatDate(current.end)}</DetailLine> : <DetailLine label="Prochaine échéance">{formatDate(current.termEnd)}</DetailLine>}
          {current.nextDeadline && <DetailLine label="Dernier jour pour donner congé">{formatDate(current.nextDeadline)}</DetailLine>}
          {current.noticeTooLateFor && <p className="py-1.5 text-xs text-warning">Congé trop tardif pour l'échéance du {formatDate(current.noticeTooLateFor)} : il vaut pour la suivante.</p>}
          {!current.lease.reminders && <DetailLine label="Rappels">Désactivés</DetailLine>}
          {(ws?.leaseGuarantees ?? [])
            .filter((g) => g.leaseId === current.lease.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((g) => (
              <DetailLine key={g.id} label={LEASE_GUARANTEE_LABELS[g.kind]}>
                {[g.name, g.until && `jusqu'au ${formatDate(g.until)}`].filter(Boolean).join(", ") || "—"}
              </DetailLine>
            ))}
          {current.lease.tenantInsuranceUntil && <DetailLine label="Assurance du locataire jusqu'au">{formatDate(current.lease.tenantInsuranceUntil)}</DetailLine>}
          <DetailLine label="Loyer hors charges"><Amount value={current.rent} /></DetailLine>
          <DetailLine label="Charges"><Amount value={current.charges} /></DetailLine>
          {current.lease.depositReturned == null ? (
            <DetailLine label="Dépôt de garantie (à restituer)"><Amount value={current.lease.deposit} /></DetailLine>
          ) : (
            <>
              <DetailLine label={`Dépôt rendu le ${formatDate(current.lease.depositReturnedOn)}`}><Amount value={current.lease.depositReturned} /></DetailLine>
              {depositRetained(current.lease) > 0 && (
                <DetailLine label={current.lease.depositReason ? `Retenue : ${current.lease.depositReason}` : "Retenue"}><Amount value={depositRetained(current.lease)} /></DetailLine>
              )}
            </>
          )}
          {ws && <ArrearsPanel lease={current.lease} ws={ws} today={today} />}
          {due && frozen && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg-muted">Anniversaire du {formatDate(due)} : avec une note DPE F ou G, le loyer ne peut pas être révisé.</p>}
          {proposal && (
            <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2.5">
              <div className="text-sm font-medium">Révision du loyer au {formatDate(proposal.anniversary)}</div>
              <p className="mt-0.5 text-sm text-fg-muted">
                {proposal.newRent != null ? (
                  <>
                    <Amount value={proposal.previousRent} /> → <b className="text-fg"><Amount value={proposal.newRent} /></b>, d'après l'indice du {irlQuarterLabel(proposal.quarterNew)}.
                  </>
                ) : (
                  <>L'indice du {irlQuarterLabel(proposal.quarterNew)} n'est pas encore connu : vous pourrez le saisir.</>
                )}
              </p>
              <Button className="mt-2 h-8" variant="primary" onClick={() => setRevising(proposal)}>
                Réviser le loyer
              </Button>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="h-8" onClick={() => setEditing(current.lease)}>
              Modifier ou donner congé
            </Button>
            <Button className="h-8" onClick={() => setNewRent(current)}>
              Nouveau loyer
            </Button>
            <Link className="inline-flex h-8 items-center rounded-lg px-3 text-sm text-fg-muted hover:bg-surface-3 hover:text-fg" to={`/impression/attestation/${current.lease.id}`} target="_blank" rel="noopener">
              Attestation de loyer
            </Link>
            <Button className="h-8" variant="ghost" onClick={() => confirm("Supprimer ce bail et son historique ?") && deleteLease.mutate({ id: current.lease.id })}>
              Supprimer
            </Button>
          </div>
          {currentRents.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-medium text-fg-muted">Évolution du loyer</div>
              {currentRents.map((r) => (
                <DetailLine key={r.id} label={`À partir de ${formatMonth(r.fromMonth)}`}>
                  <span className="inline-flex items-center gap-2">
                    {r.revision && (
                      <Link className="text-xs text-fg-muted underline hover:text-fg" to={`/impression/revision/${r.id}`} target="_blank" rel="noopener" aria-label={`Courrier de révision de ${formatMonth(r.fromMonth)}`}>
                        Courrier
                      </Link>
                    )}
                    <Amount value={r.rent} />
                    <button className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label={`Supprimer le loyer de ${formatMonth(r.fromMonth)}`} onClick={() => deleteRent.mutate({ id: r.id })}>
                      <Trash2 size={13} />
                    </button>
                  </span>
                </DetailLine>
              ))}
            </div>
          )}
        </>
      )}
      {previous.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-medium text-fg-muted">Autres baux</div>
          <Table>
            <thead>
              <tr>
                <Th>Bail</Th>
                <Th>Début</Th>
                <Th>Fin</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {previous.map((s) => (
                <Tr key={s.lease.id} className="group">
                  <Td>{describeLease(s.lease)}</Td>
                  <Td className="whitespace-nowrap">{formatDate(s.lease.startDate)}</Td>
                  <Td className="whitespace-nowrap">{s.end ? formatDate(s.end) : "—"}</Td>
                  <Td className="w-20"><RowActions onEdit={() => setEditing(s.lease)} onDelete={() => confirm("Supprimer ce bail et son historique ?") && deleteLease.mutate({ id: s.lease.id })} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <LeaseDialog open={editing !== null} property={property} lot={lot} lease={editing === "new" ? null : editing} others={all.filter((l) => l.id !== editedId)} onClose={() => setEditing(null)} />
      {active && <RentRevisionDialog proposal={revising} lease={active.lease} onClose={() => setRevising(null)} />}
      <LeaseRentDialog state={newRent} frozen={dpeFreezesRent(property.dpe)} onClose={() => setNewRent(null)} />
    </Card>
  );
}
