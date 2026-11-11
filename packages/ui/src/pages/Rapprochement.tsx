import { Trash2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { ACCOUNT_KIND_LABELS, reconcile, staleAccounts, type Account, type ReconciliationRow } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { DetailRow, EmptyRow, ExpandButton, Table, Td, Th, Tr, stopRowClick, useExpandedRow } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { StatementDialog } from "@/dialogs/StatementDialog";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

/** Tous les comptes face à leur dernier relevé : écarts, correction proposée, comptes à rapprocher. */
export function Rapprochement() {
  const pf = usePortfolio();
  const [editing, setEditing] = useState<Account | null>(null);
  const { isOpen, rowProps } = useExpandedRow();
  const rows = useMemo(() => (pf ? reconcile(pf.data, pf.today) : []), [pf]);
  if (!pf) return null;
  const months = pf.data.params.alerts.reconcileMonths;
  const stale = new Set(staleAccounts(rows, pf.data, pf.state, months).map((r) => r.account.id));
  const shown = rows.filter((r) => !r.account.archived || r.statement);
  const gaps = rows.filter((r) => r.status === "ecart" && !r.account.archived).length;

  return (
    <>
      <PageHeader
        title="Rapprochement"
        description="Comparez chaque compte à ce qu'affiche le site de l'établissement. Hamac recalcule le compte à la date du relevé : un écart signale une opération oubliée ou mal saisie."
      />
      <Card className="mb-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <span>
          <b>{rows.filter((r) => r.status === "concorde").length}</b> compte(s) d'accord avec leur relevé
        </span>
        <span className={cn(gaps > 0 && "font-medium text-negative")}>
          <b>{gaps}</b> avec un écart
        </span>
        <span className="text-fg-muted">
          <b>{stale.size}</b> à rapprocher {months > 0 ? `(plus de ${months} mois sans relevé)` : "(rappel désactivé dans Paramètres › Plan)"}
        </span>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <Table className="rounded-none border-0">
            <thead>
              <tr>
                <Th>Compte</Th>
                <Th>Dernier relevé</Th>
                <Th align="right">Relevé</Th>
                <Th align="right">Calculé à cette date</Th>
                <Th align="right">Écart</Th>
                <Th>État</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && <EmptyRow cols={7}>Aucun compte.</EmptyRow>}
              {shown.map((r) => (
                <Fragment key={r.account.id}>
                  <Tr {...rowProps(r.account.id)} className={cn("cursor-pointer", r.account.archived && "opacity-50")}>
                    <Td className="font-medium">
                      <ExpandButton open={isOpen(r.account.id)} label={r.account.name} />
                      {r.account.name}
                      <div className="ml-[21px] text-xs font-normal text-fg-faint">{ACCOUNT_KIND_LABELS[r.account.kind]}</div>
                    </Td>
                    <Td>
                      {r.statement ? (
                        <>
                          {formatDate(r.statement.date)}
                          <div className="text-xs text-fg-faint">{r.monthsSince === 0 ? "ce mois-ci" : `il y a ${r.monthsSince} mois`}</div>
                        </>
                      ) : (
                        <span className="text-fg-faint">Jamais</span>
                      )}
                    </Td>
                    <Td align="right">{r.statement ? <Amount value={r.statement.value} /> : "—"}</Td>
                    <Td align="right">{r.computedValue != null ? <Amount value={r.computedValue} /> : "—"}</Td>
                    <Td align="right" className={cn(r.status === "ecart" && "font-semibold text-negative")}>
                      {r.valueGap != null ? <Amount value={r.valueGap} signed /> : "—"}
                    </Td>
                    <Td>
                      <StatusBadge row={r} stale={stale.has(r.account.id)} />
                    </Td>
                    <Td align="right" onClick={stopRowClick}>
                      <Button className="h-8" onClick={() => setEditing(r.account)}>
                        Saisir un relevé
                      </Button>
                    </Td>
                  </Tr>
                  {isOpen(r.account.id) && (
                    <DetailRow cols={7}>
                      <Detail row={r} />
                    </DetailRow>
                  )}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-fg-faint">
        Sur un compte qui détient des titres, la valeur dépend aussi des cours retenus : un petit écart peut venir d'un cours d'une autre heure. Les espèces et les quantités, elles, doivent concorder exactement.
      </p>

      <StatementDialog account={editing} open={editing !== null} onClose={() => setEditing(null)} />
    </>
  );
}

function StatusBadge({ row: r, stale }: Readonly<{ row: ReconciliationRow; stale: boolean }>) {
  if (r.status === "ecart") return <Badge tone="negative">Écart</Badge>;
  if (r.status === "concorde") return stale ? <Badge>À refaire</Badge> : <Badge tone="positive">D'accord</Badge>;
  return stale ? <Badge tone="accent">À rapprocher</Badge> : <span className="text-xs text-fg-faint">—</span>;
}

/** Détail d'un compte : écarts sur les espèces et les titres, correction proposée, relevés passés. */
function Detail({ row: r }: Readonly<{ row: ReconciliationRow }>) {
  const pf = usePortfolio()!;
  const correct = useMutate("transactions.upsert", { success: "Correction ajoutée au journal" });
  const remove = useMutate("statements.delete", { success: "Relevé supprimé" });
  const past = pf.idx.ws.statements.filter((s) => s.accountId === r.account.id).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="grid gap-5 @3xl:grid-cols-2">
      <section className="space-y-3 text-sm">
        <CardTitle>Dernier relevé</CardTitle>
        {!r.statement && <p className="text-fg-muted">Aucun relevé : saisissez la valeur affichée par l'établissement.</p>}
        {r.statement && r.cashGap != null && (
          <p>
            Espèces : relevé <Amount value={r.statement.cash ?? 0} />, calculé <Amount value={r.computedCash ?? 0} />
            {Math.abs(r.cashGap) >= 1 ? (
              <span className="ml-1 font-medium text-negative">
                (écart <Amount value={r.cashGap} signed />)
              </span>
            ) : (
              <span className="ml-1 text-positive">✓</span>
            )}
          </p>
        )}
        {r.quantityGaps.length > 0 && (
          <div>
            <div className="mb-1 font-medium">Quantités qui diffèrent</div>
            <ul className="space-y-0.5">
              {r.quantityGaps.map((q) => (
                <li key={q.assetId}>
                  {q.name} : relevé {formatNumber(q.statement, 6)}, calculé {formatNumber(q.computed, 6)} <span className="text-negative">({q.gap > 0 ? "+" : ""}{formatNumber(q.gap, 6)})</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-fg-faint">Un achat, une vente ou un transfert de titres manque probablement au journal à cette date.</p>
          </div>
        )}
        {r.statement && r.status === "concorde" && <p className="text-positive">✓ Le calcul concorde avec le relevé.</p>}
        {r.correction && (
          <div className="rounded-lg border border-line bg-surface p-3">
            <p className="mb-2">
              {r.correction.reason} : une correction de <Amount value={r.correction.amount} signed /> au {formatDate(r.correction.date)} remettrait le calcul d'accord. À n'utiliser qu'une fois l'opération manquante cherchée en vain.
            </p>
            <Button
              disabled={correct.isPending}
              onClick={() =>
                confirm(`Ajouter au journal une correction de ${r.correction!.amount.toLocaleString("fr-FR")} € le ${formatDate(r.correction!.date)} ?`) &&
                correct.mutate({ date: r.correction!.date, type: "correction", accountId: r.account.id, amount: r.correction!.amount, comment: `Rapprochement avec le relevé du ${formatDate(r.correction!.date)}` })
              }
            >
              Ajouter la correction au journal
            </Button>
          </div>
        )}
        {r.statement && r.hasPositions && r.cashGap == null && r.status === "ecart" && r.quantityGaps.length === 0 && (
          <p className="text-xs text-fg-faint">Relevez aussi les espèces : Hamac pourra alors dire si l'écart vient de l'argent du compte ou des cours.</p>
        )}
      </section>
      <section>
        <CardTitle>Relevés enregistrés</CardTitle>
        {past.length === 0 ? (
          <p className="text-sm text-fg-muted">Aucun.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {past.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                {formatDate(s.date)} : <Amount value={s.value} />
                {s.cash != null && (
                  <span className="text-xs text-fg-faint">
                    dont espèces <Amount value={s.cash} />
                  </span>
                )}
                {s.positions.length > 0 && <span className="text-xs text-fg-faint">· {s.positions.length} titre(s)</span>}
                {s.comment && <span className="text-xs text-fg-faint">· {s.comment}</span>}
                <button type="button" className="rounded p-1 text-fg-faint hover:text-negative" aria-label={`Supprimer le relevé du ${formatDate(s.date)}`} onClick={() => confirm("Supprimer ce relevé ?") && remove.mutate({ id: s.id })}>
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
