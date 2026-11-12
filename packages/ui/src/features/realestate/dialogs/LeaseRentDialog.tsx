import { useEffect, useState } from "react";
import type { LeaseState } from "@hamac/core";
import { Field, FormGrid, Modal, MoneyInput, TextInput } from "@/shared/components/form";
import { Button } from "@/shared/components/ui";
import { todayIso } from "@/shared/lib/numbers";
import { useMutate } from "@/shared/lib/workspace";

/** Nouveau loyer à partir d'un mois, sans réécrire les mois passés. */
export function LeaseRentDialog({ state, frozen, onClose }: { state: LeaseState | null; frozen: boolean; onClose: () => void }) {
  const [fromMonth, setFromMonth] = useState("");
  const [rent, setRent] = useState(0);
  const [charges, setCharges] = useState(0);
  const save = useMutate("leaseRents.upsert", { success: "Nouveau loyer enregistré" });
  useEffect(() => {
    if (!state) return;
    setFromMonth(todayIso().slice(0, 7));
    setRent(state.rent);
    setCharges(state.charges);
  }, [state]);
  return (
    <Modal
      open={state !== null}
      onClose={onClose}
      title="Nouveau loyer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !fromMonth || rent <= 0} onClick={() => state && save.mutate({ leaseId: state.lease.id, fromMonth, rent, charges }, { onSuccess: onClose })}>
            Enregistrer
          </Button>
        </>
      }
    >
      {frozen && <p className="mb-3 text-sm text-warning">Avec une note DPE F ou G, le loyer ne peut pas être augmenté.</p>}
      <FormGrid cols={3}>
        <Field label="À partir de">{(id) => <TextInput id={id} type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} />}</Field>
        <Field label="Loyer hors charges">{(id) => <MoneyInput id={id} value={rent} onChange={(v) => setRent(v ?? 0)} />}</Field>
        <Field label="Charges">{(id) => <MoneyInput id={id} value={charges} onChange={(v) => setCharges(v ?? 0)} />}</Field>
      </FormGrid>
    </Modal>
  );
}
