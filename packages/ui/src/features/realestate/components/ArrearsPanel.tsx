import { Trash2 } from "lucide-react";
import { Link } from "react-router";
import { NOTICE_LEVEL_LABELS, leaseArrears, noticeStep, rentLedgerOf, type Lease } from "@hamac/core";
import type { Workspace } from "@hamac/api";
import { Amount } from "@/shared/components/Amount";
import { DetailLine } from "@/shared/components/DetailLine";
import { Button } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/numbers";
import { useMutate } from "@/shared/lib/workspace";

/** Loyers en retard d'un bail : où en est la relance, le courrier à préparer et les envois déjà faits. */
export function ArrearsPanel({ lease, ws, today }: { lease: Lease; ws: Workspace; today: string }) {
  const add = useMutate("rentNotices.add", { success: "Envoi noté" });
  const remove = useMutate("rentNotices.delete", { success: "Envoi retiré" });
  const arrears = leaseArrears(lease, ws.leaseRents, rentLedgerOf(ws), today);
  if (!arrears) return null;
  const step = noticeStep(arrears, ws.rentNotices, lease.id, ws.params.alerts);
  const level = step?.level ?? "rappel";
  const caution = ws.leaseGuarantees.some((g) => g.leaseId === lease.id && g.kind === "caution");
  const caf = ws.rentPayments.some((p) => p.leaseId === lease.id && p.method === "caf");
  const n = arrears.months.length;
  return (
    <div className="mt-3 rounded-lg border border-negative/40 bg-negative/5 px-3 py-2.5" role="region" aria-label="Loyers en retard">
      <div className="text-sm font-medium">
        {n} loyer{n > 1 ? "s" : ""} non reçu{n > 1 ? "s" : ""} : <Amount value={arrears.total} />
      </div>
      <p className="mt-0.5 text-sm text-fg-muted">
        Depuis l'échéance du {formatDate(arrears.since)}, soit {arrears.daysLate} jours. {step ? (step.done ? `${NOTICE_LEVEL_LABELS[step.level]} déjà envoyé.` : `Étape conseillée : ${NOTICE_LEVEL_LABELS[step.level].toLowerCase()}.`) : "Trop tôt pour relancer."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link className="inline-flex h-8 items-center rounded-lg border border-line-strong px-3 text-sm hover:bg-surface-3" to={`/impression/relance/${lease.id}/${level}`} target="_blank" rel="noopener">
          Préparer : {NOTICE_LEVEL_LABELS[level].toLowerCase()}
        </Link>
        <Button className="h-8" disabled={add.isPending} onClick={() => add.mutate({ leaseId: lease.id, level, sentOn: today, amount: arrears.total })}>
          Noter l'envoi aujourd'hui
        </Button>
      </div>
      {step && step.sent.length > 0 && (
        <div className="mt-2">
          {step.sent.map((s) => (
            <DetailLine key={s.id} label={`${NOTICE_LEVEL_LABELS[s.level]} envoyé le ${formatDate(s.sentOn)}`}>
              <span className="inline-flex items-center gap-2">
                <Amount value={s.amount} />
                <button className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label={`Retirer l'envoi du ${formatDate(s.sentOn)}`} onClick={() => remove.mutate({ id: s.id })}>
                  <Trash2 size={13} />
                </button>
              </span>
            </DetailLine>
          ))}
        </div>
      )}
      {(caution || caf) && (
        <ul className="mt-2 list-disc pl-5 text-xs text-fg-muted">
          {caution && <li>Une personne s'est portée caution : tenez-la informée ; un commandement de payer doit lui être signifié dans les quinze jours (à vérifier).</li>}
          {caf && <li>L'aide au logement est versée par la CAF : signalez-lui l'impayé (délai à vérifier auprès de la CAF).</li>}
        </ul>
      )}
    </div>
  );
}
