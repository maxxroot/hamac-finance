import { CalendarClock, CalendarX2, Download, FileUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { StatementImportDialog } from "@/dialogs/StatementImportDialog";
import { SortTh, useSortable } from "@/lib/sort";
import { downloadText, toCsv } from "@/lib/files";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { TX_LABELS, TX_TYPES, isScheduled, type Transaction, type TxType } from "@hamac/core";
import type { TxPreset } from "@/dialogs/TransactionDialog";
import { Amount } from "@/components/Amount";
import { Select, TextInput } from "@/components/form";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { TransactionDialog } from "@/dialogs/TransactionDialog";
import { Onboarding } from "@/pages/Onboarding";
import { formatDate, formatQty } from "@/lib/numbers";
import { useJournal } from "@/lib/journal";
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
    case "impots":
    case "transfert":
      return -1;
    case "correction":
      return 1;
  }
}

export function Journal() {
  const idx = useWorkspaceIndex();
  const del = useMutate("transactions.delete", { success: "Opération supprimée" });
  const skip = useMutate("skips.upsert", { success: "Mois déclaré manqué" });
  const navigate = useNavigate();
  const all = useJournal();
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
  // Lien depuis l'Historique : #/journal?du=2025-04-01&au=2026-11-11&filtre=<compte> affiche les opérations de la période.
  const [account, setAccount] = useState(search.has("nouveau") ? "" : (search.get("filtre") ?? ""));
  const du = search.get("du");
  const au = search.get("au");
  const clearPeriod = () => {
    const next = new URLSearchParams(search);
    next.delete("du");
    next.delete("au");
    next.delete("filtre");
    setSearch(next, { replace: true });
  };
  const [type, setType] = useState<TxType | "">("");
  const [year, setYear] = useState("");
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState("");

  const years = useMemo(() => [...new Set(all.map((t) => t.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a)), [all]);

  const rows = useMemo(() => {
    if (!idx) return [];
    const needle = q.trim().toLowerCase();
    return all.filter((t) => {
      if (account && t.accountId !== account && t.counterAccountId !== account) return false;
      if (type && t.type !== type) return false;
      if (year && !t.date.startsWith(year)) return false;
      if (du && t.date < du) return false;
      if (au && t.date > au) return false;
      if (needle) {
        const hay = [t.comment, idx.assetById.get(t.assetId ?? "")?.name, idx.accountById.get(t.accountId)?.name, TX_LABELS[t.type]].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [idx, all, account, type, year, q, du, au]);

  const { sorted, by } = useSortable(
    rows,
    {
      date: (t) => t.date,
      compte: (t) => idx?.accountById.get(t.accountId)?.name,
      type: (t) => TX_LABELS[t.type],
      titre: (t) => (t.assetId ? idx?.assetById.get(t.assetId)?.name : null),
      montant: (t) => direction(t) * t.amount,
      quantite: (t) => t.quantity,
      frais: (t) => t.fee,
      commentaire: (t) => t.comment || null,
    },
    { key: "date", dir: "desc" },
  );

  if (!idx) return null;
  if (idx.ws.accounts.length === 0) return <Onboarding />;

  return (
    <>
      <PageHeader
        title="Journal"
        description="Toutes les opérations, y compris les versements programmés déjà prélevés. C'est la seule saisie du quotidien : tout le reste se calcule."
        actions={
          <>
            <Button variant="ghost" onClick={() => setImporting(true)} title="Importer un relevé de banque ou de courtier (CSV, OFX, QIF)">
              <FileUp size={16} /> Importer
            </Button>
            <Button
              variant="ghost"
              title="Exporter les opérations affichées en CSV"
              onClick={() =>
                downloadText(
                  `hamac-journal-${new Date().toISOString().slice(0, 10)}.csv`,
                  toCsv([
                    ["Date", "Compte", "Opération", "Titre", "ISIN", "Montant", "Quantité", "Frais", "Vers le compte", "Commentaire"],
                    ...rows.map((t) => [
                      t.date,
                      idx.accountById.get(t.accountId)?.name,
                      TX_LABELS[t.type],
                      t.assetId ? idx.assetById.get(t.assetId)?.name : "",
                      t.assetId ? idx.assetById.get(t.assetId)?.isin : "",
                      t.amount,
                      t.quantity,
                      t.fee,
                      t.counterAccountId ? idx.accountById.get(t.counterAccountId)?.name : "",
                      t.comment,
                    ]),
                  ]),
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Download size={16} /> Exporter
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> Nouvelle opération
            </Button>
          </>
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
        {(du || au) && (
          <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-xs text-fg">
            {du && au ? `Du ${formatDate(du)} au ${formatDate(au)}` : du ? `Depuis le ${formatDate(du)}` : `Jusqu'au ${formatDate(au)}`}
            <button type="button" onClick={clearPeriod} className="text-fg-muted hover:text-fg" aria-label="Retirer le filtre de dates">
              ×
            </button>
          </span>
        )}
        <span className="ml-auto text-xs text-fg-faint">
          {rows.length} opération{rows.length > 1 ? "s" : ""}
        </span>
      </Card>

      <Table>
        <thead>
          <tr>
            <SortTh {...by("date")}>Date</SortTh>
            <SortTh {...by("compte")}>Compte</SortTh>
            <SortTh {...by("type")}>Opération</SortTh>
            <SortTh {...by("titre")}>Titre</SortTh>
            <SortTh {...by("montant")} align="right">
              Montant
            </SortTh>
            <SortTh {...by("quantite")} align="right">
              Quantité
            </SortTh>
            <SortTh {...by("frais")} align="right">
              dont frais
            </SortTh>
            <SortTh {...by("commentaire")}>Commentaire</SortTh>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <EmptyRow cols={9}>{all.length ? "Aucune opération ne correspond aux filtres." : "Aucune opération pour l'instant : commencez par vos apports initiaux."}</EmptyRow>
          )}
          {sorted.map((t) => {
            const acc = idx.accountById.get(t.accountId);
            const counter = t.counterAccountId ? idx.accountById.get(t.counterAccountId) : null;
            const asset = t.assetId ? idx.assetById.get(t.assetId) : null;
            const dir = direction(t);
            const planned = isScheduled(t);
            return (
              <Tr key={t.id} className="group cursor-pointer" onDoubleClick={() => (planned ? navigate("/versements") : setEditing(t))}>
                <Td className="num whitespace-nowrap text-fg-muted">{formatDate(t.date)}</Td>
                <Td className="whitespace-nowrap">
                  {acc?.name}
                  {counter && <span className="text-fg-muted"> → {counter.name}</span>}
                </Td>
                <Td className="whitespace-nowrap">
                  <span title={planned ? "Versement programmé : calculé depuis la page Versements" : undefined}>
                    <Badge tone={t.type === "achat" || t.type === "vente" ? "accent" : "neutral"}>
                      {planned && <CalendarClock size={12} className="mr-1" aria-label="programmé" />}
                      {TX_LABELS[t.type]}
                    </Badge>
                  </span>
                </Td>
                <Td className="max-w-48 truncate">{asset?.name ?? ""}</Td>
                <Td align="right">
                  <Amount value={dir * t.amount} signed={t.type !== "transfert" && t.type !== "achat"} />
                </Td>
                <Td align="right" className="text-fg-muted">
                  {formatQty(t.quantity)}
                </Td>
                <Td align="right" className="text-fg-muted">
                  {t.fee ? <Amount value={t.fee} /> : ""}
                </Td>
                <Td className="max-w-48 truncate text-fg-muted" title={t.comment || undefined}>{t.comment}</Td>
                <Td className="w-20">
                  {planned ? (
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        className="rounded p-1.5 text-fg-muted hover:bg-surface-3 hover:text-fg"
                        onClick={() => navigate("/versements")}
                        aria-label="Modifier dans Versements"
                        title="Modifier dans Versements"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="rounded p-1.5 text-fg-muted hover:bg-warning/15 hover:text-warning"
                        aria-label="Déclarer ce mois manqué"
                        title="Ce versement n'a pas eu lieu : le déclarer manqué"
                        onClick={() =>
                          confirm(`Déclarer manqué le versement de ${formatDate(t.date)} sur ${acc?.name ?? "ce compte"} ?`) &&
                          skip.mutate({ accountId: t.accountId, month: t.date.slice(0, 7), amount: t.amount, comment: "" })
                        }
                      >
                        <CalendarX2 size={14} />
                      </button>
                    </div>
                  ) : (
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
                  )}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>

      <StatementImportDialog open={importing} onClose={() => setImporting(false)} />
      <TransactionDialog open={creating || !!editing} transaction={editing} preset={preset} onClose={closeDialog} />
    </>
  );
}
