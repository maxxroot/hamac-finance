import { CalendarClock } from "lucide-react";
import { Link } from "react-router";
import { AddTransactionButton } from "./TransactionButton";
import { SortTh, useSortable } from "@/shared/lib/sort";
import { TX_LABELS, isScheduled, type AccountKind, type AssetKind, type TxType } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { EmptyRow, Table, Td, Tr } from "@/shared/components/table";
import { Badge, Card } from "@/shared/components/ui";
import { formatDate, formatQty } from "@/shared/lib/numbers";
import { supportsLabel, useJournal } from "@/features/entry/lib/journal";
import { useWorkspaceIndex } from "@/shared/lib/workspace";

const OUT: TxType[] = ["retrait", "achat", "frais", "impots"];

/** Mouvements (repris du journal) d'un ensemble de comptes, du plus récent au plus ancien. */
export function Movements({
  accountIds,
  title = "Mouvements",
  limit = 30,
  assetKinds,
  accountKinds,
  type,
  withCash = true,
}: {
  accountIds: string[];
  title?: string;
  limit?: number;
  /** Ne montrer que ces titres (les mouvements d'espèces, sans titre, restent affichés sauf `withCash` à false). */
  assetKinds?: AssetKind[];
  accountKinds?: AccountKind[];
  type?: TxType;
  /** Avec `assetKinds` : garder les mouvements d'espèces (versements, retraits…), qu'un compte partagé entre plusieurs classes ne rattache à aucune. */
  withCash?: boolean;
}) {
  const idx = useWorkspaceIndex();
  const all = useJournal();
  const ids = new Set(accountIds);
  const rows = idx
    ? all.filter((t) => {
        if (!(ids.has(t.accountId) || (t.counterAccountId && ids.has(t.counterAccountId)))) return false;
        if (!assetKinds) return true;
        if (!t.assetId) return withCash;
        // Un arbitrage concerne deux titres : il s'affiche si l'un des deux est du bon type.
        const kinds = [t.assetId, t.counterAssetId].flatMap((id) => (id ? (idx.assetById.get(id)?.kind ?? []) : []));
        return kinds.some((k) => assetKinds.includes(k));
      })
    : [];
  const incoming = (t: (typeof rows)[number]) => (t.type === "transfert" ? ids.has(t.counterAccountId ?? "") && !ids.has(t.accountId) : !OUT.includes(t.type));
  const { sorted, by } = useSortable(
    rows,
    {
      date: (t) => t.date,
      compte: (t) => idx?.accountById.get(t.accountId)?.name,
      type: (t) => TX_LABELS[t.type],
      titre: (t) => (t.assetId ? idx?.assetById.get(t.assetId)?.name : null),
      montant: (t) => (incoming(t) ? t.amount : -t.amount),
      quantite: (t) => t.quantity,
      commentaire: (t) => t.comment || null,
    },
    { key: "date", dir: "desc" },
  );
  if (!idx) return null;
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-sm font-medium text-fg-muted">{title}</h2>
        <AddTransactionButton accountId={accountIds[0]} type={type} assetKinds={assetKinds} accountKinds={accountKinds} label="Ajouter une opération" variant="ghost" className="h-8 text-accent" />
      </div>
      <Table className="rounded-none border-x-0 border-b-0">
        <thead>
          <tr>
            <SortTh {...by("date")}>Date</SortTh>
            <SortTh {...by("compte")}>Compte</SortTh>
            <SortTh {...by("type")}>Opération</SortTh>
            <SortTh {...by("titre")}>Titre</SortTh>
            <SortTh {...by("montant")} align="right">Montant</SortTh>
            <SortTh {...by("quantite")} align="right">Quantité</SortTh>
            <SortTh {...by("commentaire")}>Commentaire</SortTh>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow cols={7}>Aucun mouvement pour l'instant.</EmptyRow>}
          {sorted.slice(0, limit).map((t) => {
            return (
              <Tr key={t.id}>
                <Td className="num text-fg-muted">{formatDate(t.date)}</Td>
                <Td>
                  {idx.accountById.get(t.accountId)?.name}
                  {t.counterAccountId && <span className="text-fg-muted"> → {idx.accountById.get(t.counterAccountId)?.name}</span>}
                </Td>
                <Td className="whitespace-nowrap">
                  <span title={isScheduled(t) ? "Versement programmé : modifiable dans Versements" : undefined}>
                    <Badge>
                      {isScheduled(t) && <CalendarClock size={12} className="mr-1" aria-label="programmé" />}
                      {TX_LABELS[t.type]}
                    </Badge>
                  </span>
                </Td>
                <Td className="max-w-56 truncate">{supportsLabel(t, (id) => idx.assetById.get(id)?.name)}</Td>
                <Td align="right">
                  {t.type === "arbitrage" ? <Amount value={t.amount} /> : <Amount value={incoming(t) ? t.amount : -t.amount} signed={t.type !== "achat"} />}
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
