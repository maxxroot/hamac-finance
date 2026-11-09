import { useEffect, useState } from "react";
import { RENT_EXCEPTION_KINDS, RENT_EXCEPTION_LABELS, type RentExceptionKind, type RentMonth } from "@hamac/core";
import { Field, FormGrid, Modal, MoneyInput, Select } from "@/components/form";
import { Button } from "@/components/ui";
import { formatMonth } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

/** Signale un écart sur un mois de loyer, ou revient au loyer prévu. */
export function RentExceptionDialog({ month, onClose }: { month: RentMonth | null; onClose: () => void }) {
  const [kind, setKind] = useState<RentExceptionKind>("impaye");
  const [amount, setAmount] = useState<number | null>(null);
  const save = useMutate("rentExceptions.set", { success: "Écart enregistré" });
  const remove = useMutate("rentExceptions.delete", { success: "Loyer rétabli" });
  useEffect(() => {
    if (!month) return;
    setKind(month.exception?.kind ?? "impaye");
    setAmount(month.exception?.amount ?? null);
  }, [month]);
  const invalid = kind === "montant" && amount == null;
  return (
    <Modal
      open={month !== null}
      onClose={onClose}
      title={month ? `Loyer de ${formatMonth(month.month)}` : "Loyer"}
      footer={
        <>
          {month?.exception && (
            <Button variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate({ id: month.exception!.id }, { onSuccess: onClose })}>
              Loyer reçu normalement
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || invalid} onClick={() => month && save.mutate({ leaseId: month.leaseId, month: month.month, kind, amount: kind === "montant" ? amount : null }, { onSuccess: onClose })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Que s'est-il passé ?">
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as RentExceptionKind)}>
              {RENT_EXCEPTION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {RENT_EXCEPTION_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {kind === "montant" && <Field label="Loyer reçu hors charges">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>}
      </FormGrid>
    </Modal>
  );
}
