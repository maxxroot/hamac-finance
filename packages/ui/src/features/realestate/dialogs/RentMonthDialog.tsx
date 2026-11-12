import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod, type RentMonth } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { DetailLine } from "@/shared/components/DetailLine";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, Select, TextInput } from "@/shared/components/form";
import { RentStatusBadge } from "@/features/realestate/components/RentStatusBadge";
import { Button } from "@/shared/components/ui";
import { capitalize, formatDate, formatMonth, todayIso } from "@/shared/lib/numbers";
import { useMutate } from "@/shared/lib/workspace";

/** Un mois de loyer : ce qui est dû, les sommes reçues, en ajouter une, ou remettre le mois. */
export function RentMonthDialog({ month, title, onClose }: { month: RentMonth | null; title?: string; onClose: () => void }) {
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("virement");
  const [comment, setComment] = useState("");
  const [waiverComment, setWaiverComment] = useState("");
  const add = useMutate("rentPayments.upsert", { success: "Paiement enregistré" });
  const remove = useMutate("rentPayments.delete", { success: "Paiement supprimé" });
  const waive = useMutate("rentWaivers.set", { success: "Mois remis" });
  const unwaive = useMutate("rentWaivers.delete", { success: "Mois de nouveau dû" });
  useEffect(() => {
    if (!month) return;
    const today = todayIso();
    setDate(month.dueDate < today ? month.dueDate : today);
    setAmount(month.outstanding > 0 ? month.outstanding : null);
    setMethod(month.payments.at(-1)?.method ?? "virement");
    setComment("");
    setWaiverComment(month.waiver?.comment ?? "");
  }, [month]);
  if (!month) return null;
  const label = capitalize(formatMonth(month.month));
  return (
    <Modal open={month != null} onClose={onClose} title={`Loyer de ${formatMonth(month.month)}`} footer={<Button variant="ghost" onClick={onClose}>Fermer</Button>}>
      <div className="space-y-4">
        <div>
          {title && <div className="mb-1 text-sm font-medium">{title}</div>}
          <DetailLine label="État"><RentStatusBadge status={month.status} /></DetailLine>
          <DetailLine label={`Échéance (${formatDate(month.dueDate)})`}><Amount value={month.expectedRent + month.expectedCharges} /></DetailLine>
          <DetailLine label="Dont charges"><Amount value={month.expectedCharges} /></DetailLine>
          {month.waiver ? <DetailLine label="Remis : rien n'est dû">{month.waiver.comment || "—"}</DetailLine> : <DetailLine label="Reste dû" strong><Amount value={month.outstanding} /></DetailLine>}
        </div>

        <section aria-label="Sommes reçues">
          <div className="mb-1 text-xs font-medium text-fg-muted">Sommes reçues</div>
          {month.payments.length === 0 && <p className="text-sm text-fg-muted">Rien n'a encore été pointé pour {label.toLowerCase()}.</p>}
          {month.payments.map((p) => (
            <DetailLine key={p.id} label={`${formatDate(p.date)} · ${PAYMENT_METHOD_LABELS[p.method]}${p.comment ? ` · ${p.comment}` : ""}`}>
              <span className="inline-flex items-center gap-2">
                <Amount value={p.amount} />
                <button className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label={`Supprimer le paiement du ${formatDate(p.date)}`} onClick={() => remove.mutate({ id: p.id })}>
                  <Trash2 size={13} />
                </button>
              </span>
            </DetailLine>
          ))}
        </section>

        {!month.waiver && (
          <section aria-label="Ajouter un paiement" className="rounded-lg border border-line p-3">
            <FormGrid>
              <Field label="Reçu le">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
              <Field label="Montant reçu">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>
              <Field label="Moyen">
                {(id) => (
                  <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Commentaire (facultatif)">{(id) => <TextInput id={id} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
            </FormGrid>
            <Button className="mt-3" variant="primary" disabled={add.isPending || !date || amount == null || amount <= 0} onClick={() => add.mutate({ leaseId: month.leaseId, month: month.month, date, amount: amount!, method, comment })}>
              Enregistrer le paiement
            </Button>
          </section>
        )}

        <section aria-label="Remise du mois">
          <Checkbox
            checked={month.waiver != null}
            onChange={(v) => (v ? waive.mutate({ leaseId: month.leaseId, month: month.month, comment: waiverComment }) : month.waiver && unwaive.mutate({ id: month.waiver.id }))}
            label="Mois remis au locataire : rien n'est dû (mois offert, franchise après travaux)"
          />
          {month.waiver && (
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1"><Field label="Motif de la remise">{(id) => <TextInput id={id} value={waiverComment} onChange={(e) => setWaiverComment(e.target.value)} />}</Field></div>
              <Button disabled={waive.isPending} onClick={() => waive.mutate({ leaseId: month.leaseId, month: month.month, comment: waiverComment })}>
                Enregistrer
              </Button>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
