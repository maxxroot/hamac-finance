import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { LEASE_KIND_LABELS, LEASE_STATUS_LABELS, currentLease, leaseState, type Lease, type LeaseRent, type LeaseState, type Property } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { DetailLine } from "@/components/DetailLine";
import { RowActions } from "@/components/RowActions";
import { Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { LeaseDialog } from "@/dialogs/LeaseDialog";
import { LeaseRentDialog } from "@/dialogs/LeaseRentDialog";
import { formatDate, formatMonth } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

const describeLease = (l: Lease) => (l.tenant ? `${LEASE_KIND_LABELS[l.kind]} · ${l.tenant}` : LEASE_KIND_LABELS[l.kind]);

/** Le bail en cours du bien, ses échéances, l'évolution du loyer et les baux précédents. */
export function LeaseCard({ property, leases, rents, today }: { property: Property; leases: readonly Lease[]; rents: readonly LeaseRent[]; today: string }) {
  const [editing, setEditing] = useState<Lease | "new" | null>(null);
  const [newRent, setNewRent] = useState<LeaseState | null>(null);
  const deleteLease = useMutate("leases.delete", { success: "Bail supprimé" });
  const deleteRent = useMutate("leaseRents.delete", { success: "Loyer supprimé" });
  const states = leases.map((l) => leaseState(l, rents, today));
  const current = currentLease(states);
  const previous = states.filter((s) => s !== current).sort((a, b) => b.lease.startDate.localeCompare(a.lease.startDate));
  const currentRents = current ? rents.filter((r) => r.leaseId === current.lease.id) : [];
  const editedId = editing && editing !== "new" ? editing.id : null;

  return (
    <Card>
      <CardTitle
        hint={
          <Button className="h-8" variant={current ? "secondary" : "primary"} onClick={() => setEditing("new")}>
            <Plus size={14} /> Nouveau bail
          </Button>
        }
      >
        Bail
      </CardTitle>
      {!current && <p className="text-sm text-fg-muted">Aucun bail. Ajoutez-en un pour suivre les loyers et les échéances.</p>}
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
          <DetailLine label="Loyer hors charges"><Amount value={current.rent} /></DetailLine>
          <DetailLine label="Charges"><Amount value={current.charges} /></DetailLine>
          <DetailLine label="Dépôt de garantie (à restituer)"><Amount value={current.lease.deposit} /></DetailLine>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="h-8" onClick={() => setEditing(current.lease)}>
              Modifier ou donner congé
            </Button>
            <Button className="h-8" onClick={() => setNewRent(current)}>
              Nouveau loyer
            </Button>
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
      <LeaseDialog open={editing !== null} property={property} lease={editing === "new" ? null : editing} others={leases.filter((l) => l.id !== editedId)} onClose={() => setEditing(null)} />
      <LeaseRentDialog state={newRent} onClose={() => setNewRent(null)} />
    </Card>
  );
}
