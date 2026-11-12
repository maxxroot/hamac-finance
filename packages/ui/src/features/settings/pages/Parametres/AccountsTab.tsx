import { Plus } from "lucide-react";
import { useState } from "react";
import { RowActions } from "@/shared/components/RowActions";
import { ACCOUNT_KIND_LABELS, formatPct, type Account } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { EmptyRow, Table, Td, Th, Tr } from "@/shared/components/table";
import { Badge, Button } from "@/shared/components/ui";
import { AccountDialog } from "@/features/entry";
import { cn } from "@/shared/lib/cn";
import { formatDate } from "@/shared/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/shared/lib/workspace";
import { SortTh, useSortable } from "@/shared/lib/sort";

export function AccountsTab() {
  const idx = useWorkspaceIndex();
  const del = useMutate("accounts.delete", { success: "Compte supprimé" });
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const { sorted, by } = useSortable(idx?.ws.accounts ?? [], {
    nom: (a) => a.name,
    type: (a) => ACCOUNT_KIND_LABELS[a.kind],
    etab: (a) => (a.institutionId && idx?.institutionById.get(a.institutionId)?.name) || null,
    ouverture: (a) => a.openedOn,
    taux: (a) => a.rate,
    plafond: (a) => a.depositCeiling,
    role: (a) => a.role || null,
  });
  if (!idx) return null;
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Nouveau compte
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            <SortTh {...by("nom")}>Nom</SortTh>
            <SortTh {...by("type")}>Type</SortTh>
            <SortTh {...by("etab")}>Établissement</SortTh>
            <SortTh {...by("ouverture")}>Ouvert le</SortTh>
            <SortTh {...by("taux")} align="right">Taux</SortTh>
            <SortTh {...by("plafond")} align="right">Plafond</SortTh>
            <SortTh {...by("role")}>Rôle</SortTh>
            <Th />
          </tr>
        </thead>
        <tbody>
          {idx.ws.accounts.length === 0 && <EmptyRow cols={8}>Aucun compte.</EmptyRow>}
          {sorted.map((a) => (
            <Tr key={a.id} className={cn("group", a.archived && "opacity-50")}>
              <Td className="font-medium">
                {a.name} {a.archived && <Badge>archivé</Badge>}
              </Td>
              <Td>{ACCOUNT_KIND_LABELS[a.kind]}</Td>
              <Td className="text-fg-muted">{(a.institutionId && idx.institutionById.get(a.institutionId)?.name) || "—"}</Td>
              <Td className="text-fg-muted">{a.openedOn ? formatDate(a.openedOn) : "—"}</Td>
              <Td align="right">{a.rate != null ? formatPct(a.rate) : "—"}</Td>
              <Td align="right">{a.depositCeiling != null ? <Amount value={a.depositCeiling} compact /> : "—"}</Td>
              <Td className="max-w-64 truncate text-fg-muted">{a.role}</Td>
              <Td className="w-20">
                <RowActions onEdit={() => setEditing(a)} onDelete={() => confirm(`Supprimer « ${a.name} » ?`) && del.mutate({ id: a.id })} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <AccountDialog open={creating || !!editing} account={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </>
  );
}

// ——— Actifs ———
