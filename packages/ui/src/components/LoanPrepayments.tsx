import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { LOAN_PREPAYMENT_MODE_LABELS, LOAN_PREPAYMENT_MODES, type Loan, type LoanPrepaymentMode } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Field, FormGrid, Modal, MoneyInput, Select, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { formatDate, todayIso } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

function PrepaymentDialog({ open, loanId, onClose }: { open: boolean; loanId: string; onClose: () => void }) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [fee, setFee] = useState(0);
  const [mode, setMode] = useState<LoanPrepaymentMode>("duree");
  const save = useMutate("loanPrepayments.upsert", { success: "Remboursement enregistré" });
  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setAmount(null);
    setFee(0);
    setMode("duree");
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Remboursement anticipé"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !date || amount == null || amount <= 0} onClick={() => save.mutate({ loanId, date, amount: amount!, fee, mode }, { onSuccess: onClose })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Date">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Capital remboursé">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>
        <Field label="Indemnité (facultative)" help="Pénalité prévue au contrat.">{(id) => <MoneyInput id={id} value={fee} onChange={(v) => setFee(v ?? 0)} />}</Field>
        <Field label="Ensuite">
          {(id) => (
            <Select id={id} value={mode} onChange={(e) => setMode(e.target.value as LoanPrepaymentMode)}>
              {LOAN_PREPAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {LOAN_PREPAYMENT_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </FormGrid>
    </Modal>
  );
}

/** Remboursements anticipés d'un crédit, dans son détail. */
export function LoanPrepayments({ loan }: { loan: Loan }) {
  const [adding, setAdding] = useState(false);
  const del = useMutate("loanPrepayments.delete", { success: "Remboursement supprimé" });
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-fg-muted">Remboursements anticipés</span>
        <Button className="h-7 px-2 text-xs" variant="ghost" onClick={() => setAdding(true)}>
          <Plus size={13} /> Ajouter
        </Button>
      </div>
      {loan.prepayments.length === 0 && <p className="text-xs text-fg-faint">Aucun.</p>}
      {loan.prepayments.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3 py-1 text-sm">
          <span className="text-fg-muted">
            {formatDate(p.date)} · {LOAN_PREPAYMENT_MODE_LABELS[p.mode]}
          </span>
          <span className="inline-flex items-center gap-2">
            <Amount value={p.amount} />
            {p.fee > 0 && (
              <span className="text-xs text-fg-faint">
                indemnité <Amount value={p.fee} />
              </span>
            )}
            <button className="rounded p-1 text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label={`Supprimer le remboursement du ${formatDate(p.date)}`} onClick={() => del.mutate({ id: p.id })}>
              <Trash2 size={13} />
            </button>
          </span>
        </div>
      ))}
      <PrepaymentDialog open={adding} loanId={loan.id} onClose={() => setAdding(false)} />
    </div>
  );
}
