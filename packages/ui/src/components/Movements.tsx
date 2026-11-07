import { Plus } from "lucide-react";
import { Link } from "react-router";
import { TX_LABELS, type TxType } from "@hamac/core";
import { Amount } from "./Amount";
import { EmptyRow, Table, Td, Th, Tr } from "./table";
import { Badge, Card } from "./ui";
import { formatDate, formatQty } from "@/lib/numbers";
import { useWorkspaceIndex } from "@/lib/workspace";

const OUT: TxType[] = ["retrait", "achat", "frais"];

/** Mouvements (repris du journal) d'un ensemble de comptes, du plus récent au plus ancien. */
export function Movements({ accountIds, title = "Mouvements", limit = 30 }: { accountIds: string[]; title?: string; limit?: number }) {
  const idx = useWorkspaceIndex();
  if (!idx) return null;
  const ids = new Set(accountIds);
  const rows = idx.ws.transactions.filter((t) => ids.has(t.accountId) || (t.counterAccountId && ids.has(t.counterAccountId)));
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-sm font-medium text-fg-muted">{title}</h2>
        <Link to={`/journal?nouveau=1${accountIds.length === 1 ? `&compte=${accountIds[0]}` : ""}`} className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
          <Plus size={14} /> Ajouter une opération
        </Link>
      </div>
      <Table className="rounded-none border-x-0 border-b-0">
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Compte</Th>
            <Th>Opération</Th>
            <Th>Titre</Th>
            <Th align="right">Montant</Th>
            <Th align="right">Quantité</Th>
            <Th>Commentaire</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow cols={7}>Aucun mouvement saisi dans le journal.</EmptyRow>}
          {rows.slice(0, limit).map((t) => {
            const incoming = t.type === "transfert" ? ids.has(t.counterAccountId ?? "") && !ids.has(t.accountId) : !OUT.includes(t.type);
            return (
              <Tr key={t.id}>
                <Td className="num text-fg-muted">{formatDate(t.date)}</Td>
                <Td>
                  {idx.accountById.get(t.accountId)?.name}
                  {t.counterAccountId && <span className="text-fg-muted"> → {idx.accountById.get(t.counterAccountId)?.name}</span>}
                </Td>
                <Td>
                  <Badge>{TX_LABELS[t.type]}</Badge>
                </Td>
                <Td className="max-w-56 truncate">{t.assetId ? idx.assetById.get(t.assetId)?.name : ""}</Td>
                <Td align="right">
                  <Amount value={incoming ? t.amount : -t.amount} signed={t.type !== "achat"} />
                </Td>
                <Td align="right" className="text-fg-muted">
                  {formatQty(t.quantity)}
                </Td>
                <Td className="max-w-64 truncate text-fg-muted">{t.comment}</Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      {rows.length > limit && (
        <div className="px-5 py-3 text-xs text-fg-faint">
          {rows.length - limit} mouvement(s) plus ancien(s) dans le{" "}
          <Link to="/journal" className="text-accent hover:underline">
            journal
          </Link>
          .
        </div>
      )}
    </Card>
  );
}
