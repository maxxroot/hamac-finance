import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { TX_LABELS, TX_TYPES, type Transaction, type TxType } from "@hamac/core";
import type { TxPreset } from "@/dialogs/TransactionDialog";
import { Amount } from "@/components/Amount";
import { Select, TextInput } from "@/components/form";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { TransactionDialog } from "@/dialogs/TransactionDialog";
import { Onboarding } from "@/pages/Onboarding";
import { formatDate, formatQty } from "@/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

/** Sens de l'opération pour le compte principal : + entrée, − sortie, 0 interne. */
function direction(t: Transaction): 1 | -1 | 0 {
  switch (t.type) {
    case "apport_initial":
    case "versement":
    case "interets":
    case "dividende":
    case "vente":
      return 1;
    case "retrait":
    case "achat":
    case "frais":
    case "transfert":
      return -1;
    case "correction":
      return 1;
  }
}

export function Journal() {
  const idx = useWorkspaceIndex();
  const del = useMutate("transactions.delete", { success: "Opération supprimée" });
  const [editing, setEditing] = useState<Transaction | null>(null);
  // Lien direct : #/journal?nouveau=1&compte=<id>&type=achat&titre=<id> ouvre la saisie pré-remplie.
  const [search, setSearch] = useSearchParams();
  const [creating, setCreating] = useState(search.has("nouveau"));
  const preset: TxPreset = {
    accountId: search.get("compte") ?? undefined,
    type: (search.get("type") as TxType | null) ?? undefined,
    assetId: search.get("titre") ?? undefined,
  };
  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
    if (search.has("nouveau")) setSearch({}, { replace: true });
  };
  const [account, setAccount] = useState("");
  const [type, setType] = useState<TxType | "">("");
  const [year, setYear] = useState("");
  const [q, setQ] = useState("");

  const years = useMemo(() => [...new Set(idx?.ws.transactions.map((t) => t.date.slice(0, 4)))].sort().reverse(), [idx]);

  const rows = useMemo(() => {
    if (!idx) return [];
    const needle = q.trim().toLowerCase();
    return idx.ws.transactions.filter((t) => {
      if (account && t.accountId !== account && t.counterAccountId !== account) return false;
      if (type && t.type !== type) return false;
      if (year && !t.date.startsWith(year)) return false;
      if (needle) {
        const hay = [t.comment, idx.assetById.get(t.assetId ?? "")?.name, idx.accountById.get(t.accountId)?.name, TX_LABELS[t.type]].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [idx, account, type, year, q]);

  if (!idx) return null;
  if (idx.ws.accounts.length === 0) return <Onboarding />;

  return (
    <>
      <PageHeader
        title="Journal"
        description="Toutes les opérations. C'est la seule saisie du quotidien : tout le reste se calcule."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nouvelle opération
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-faint" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (commentaire, titre…)" className="pl-9" />
        </div>
        <Select value={account} onChange={(e) => setAccount(e.target.value)} className="w-52">
          <option value="">Tous les comptes</option>
          {idx.ws.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value as TxType | "")} className="w-56">
          <option value="">Toutes les opérations</option>
          {TX_TYPES.map((t) => (
            <option key={t} value={t}>
              {TX_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-40">
          <option value="">Toutes années</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <span className="ml-auto text-xs text-fg-faint">
          {rows.length} opération{rows.length > 1 ? "s" : ""}
        </span>
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Compte</Th>
            <Th>Opération</Th>
            <Th>Titre</Th>
            <Th align="right">Montant</Th>
            <Th align="right">Quantité</Th>
            <Th align="right">dont frais</Th>
            <Th>Commentaire</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <EmptyRow cols={9}>{idx.ws.transactions.length ? "Aucune opération ne correspond aux filtres." : "Aucune opération pour l'instant : commencez par vos apports initiaux."}</EmptyRow>
          )}
          {rows.map((t) => {
            const acc = idx.accountById.get(t.accountId);
            const counter = t.counterAccountId ? idx.accountById.get(t.counterAccountId) : null;
            const asset = t.assetId ? idx.assetById.get(t.assetId) : null;
            const dir = direction(t);
            return (
              <Tr key={t.id} className="group cursor-pointer" onDoubleClick={() => setEditing(t)}>
                <Td className="num whitespace-nowrap text-fg-muted">{formatDate(t.date)}</Td>
                <Td className="whitespace-nowrap">
                  {acc?.name}
                  {counter && <span className="text-fg-muted"> → {counter.name}</span>}
                </Td>
                <Td>
                  <Badge tone={t.type === "achat" || t.type === "vente" ? "accent" : "neutral"}>{TX_LABELS[t.type]}</Badge>
                </Td>
                <Td className="max-w-56 truncate">{asset?.name ?? ""}</Td>
                <Td align="right">
                  <Amount value={dir * t.amount} signed={t.type !== "transfert" && t.type !== "achat"} />
                </Td>
                <Td align="right" className="text-fg-muted">
                  {formatQty(t.quantity)}
                </Td>
                <Td align="right" className="text-fg-muted">
                  {t.fee ? <Amount value={t.fee} /> : ""}
                </Td>
                <Td className="max-w-64 truncate text-fg-muted">{t.comment}</Td>
                <Td className="w-20">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <button className="rounded p-1.5 text-fg-muted hover:bg-surface-3 hover:text-fg" onClick={() => setEditing(t)} aria-label="Modifier">
                      <Pencil size={14} />
                    </button>
                    <button
                      className="rounded p-1.5 text-fg-muted hover:bg-negative/15 hover:text-negative"
                      aria-label="Supprimer"
                      onClick={() => confirm("Supprimer cette opération ?") && del.mutate({ id: t.id })}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>

      <TransactionDialog open={creating || !!editing} transaction={editing} preset={preset} onClose={closeDialog} />
    </>
  );
}
