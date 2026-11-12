import { Plus } from "lucide-react";
import { useState } from "react";
import { LOT_KIND_LABELS, RENTAL_MODE_LABELS, leaseRenterNames, lotFitsMode, lotStatus, sortLots, type Lease, type LeaseRent, type LeaseRenter, type Lot, type Property, type Renter } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { RowActions } from "@/components/RowActions";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { LotDialog } from "@/dialogs/LotDialog";
import { formatDate } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

/** Ce qui se loue dans le bien, et où en est chaque lot. */
export function LotsCard({ property, lots, leases, rents, renters, links, today }: { property: Property; lots: readonly Lot[]; leases: readonly Lease[]; rents: readonly LeaseRent[]; renters: readonly Renter[]; links: readonly LeaseRenter[]; today: string }) {
  const [editing, setEditing] = useState<Lot | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const remove = useMutate("lots.delete", { success: "Lot supprimé" });
  const archive = useMutate("lots.upsert", { success: "Lot archivé" });
  const sorted = sortLots(lots);
  const archived = sorted.filter((l) => l.archived);
  const shown = sorted.filter((l) => showArchived || !l.archived);
  const rentedIds = new Set(leases.map((l) => l.lotId));
  const edited = editing && editing !== "new" ? editing : null;
  const hint = property.rentalMode === "chambres" ? "Une ligne par chambre, plus les annexes louées à part." : "Le logement, et les annexes louées à part (parking, cave).";
  return (
    <Card>
      <CardTitle
        hint={
          <Button className="h-8" onClick={() => setEditing("new")}>
            <Plus size={14} /> Ajouter un lot
          </Button>
        }
      >
        Lots
      </CardTitle>
      <p className="mb-2 text-sm text-fg-muted">
        {RENTAL_MODE_LABELS[property.rentalMode]}. {hint}
      </p>
      <Table>
        <thead>
          <tr>
            <Th>Lot</Th>
            <Th>Situation</Th>
            <Th align="right">Loyer</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && <EmptyRow cols={4}>{property.rentalMode === "chambres" ? "Ajoutez les chambres du bien pour y rattacher leurs baux." : "Le logement sera créé avec le premier bail."}</EmptyRow>}
          {shown.map((lot) => {
            const s = lotStatus(lot, leases, rents, today);
            const who = s.current ? leaseRenterNames(s.current.lease.id, links, renters) : "";
            return (
              <Tr key={lot.id} className="group">
                <Td className="font-medium">
                  {lot.name}
                  <div className="text-xs font-normal text-fg-faint">
                    {LOT_KIND_LABELS[lot.kind]}
                    {lot.surface != null && ` · ${lot.surface.toLocaleString("fr-FR")} m²`}
                  </div>
                </Td>
                <Td>
                  {lot.archived ? (
                    <Badge>Archivé</Badge>
                  ) : !lotFitsMode(lot.kind, property.rentalMode) ? (
                    <Badge>Hors du mode de location</Badge>
                  ) : s.current ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <Badge tone="positive">Loué</Badge>
                      {who && <span className="text-sm text-fg-muted">{who}</span>}
                    </span>
                  ) : s.upcoming ? (
                    <Badge tone="accent">Loué à partir du {formatDate(s.upcoming.lease.startDate)}</Badge>
                  ) : (
                    <Badge tone="negative">{s.vacantSince ? `Vide depuis le ${formatDate(s.vacantSince)}` : "Jamais loué"}</Badge>
                  )}
                </Td>
                <Td align="right">
                  {s.current ? <Amount value={s.current.rent} /> : lot.targetRent != null ? <span className="text-fg-muted" title="Loyer espéré"><Amount value={lot.targetRent} /></span> : "—"}
                </Td>
                <Td className="w-20">
                  <RowActions
                    onEdit={() => setEditing(lot)}
                    onDelete={() => {
                      if (rentedIds.has(lot.id)) {
                        if (!lot.archived && confirm(`${lot.name} a des baux : l'archiver plutôt, en gardant son historique ?`)) archive.mutate({ ...lot, archived: true });
                      } else if (confirm(`Supprimer ${lot.name} ?`)) remove.mutate({ id: lot.id });
                    }}
                  />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      {archived.length > 0 && (
        <button className="mt-2 text-xs text-fg-muted underline hover:text-fg" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Masquer les lots archivés" : `Afficher les lots archivés (${archived.length})`}
        </button>
      )}
      <LotDialog open={editing !== null} property={property} lot={edited} lots={lots} rented={edited != null && rentedIds.has(edited.id)} onClose={() => setEditing(null)} />
    </Card>
  );
}
