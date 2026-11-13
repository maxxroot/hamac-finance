import { useState } from "react";
import { Field, MoneyInput, NumberInput, TextInput } from "@/shared/components/form";
import { Button, Card, CardTitle } from "@/shared/components/ui";
import { useMutate } from "@/shared/lib/workspace";

/** « Prévoir un achat » : une ligne prévue (libellé, année visée, nominal), rattachée au premier compte-titres. */
export function PlanForm({ accountId }: { accountId: string | null }) {
  const [label, setLabel] = useState("");
  const [targetYear, setTargetYear] = useState<number | null>(null);
  const [nominal, setNominal] = useState<number | null>(null);
  const addPlan = useMutate("bondPlans.upsert", { success: "Ligne prévue ajoutée" });
  return (
    <Card className="@3xl:col-span-2">
      <CardTitle>Prévoir un achat</CardTitle>
      <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <Field label="Libellé">{(id) => <TextInput id={id} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. À choisir : échéance vers 2034" />}</Field>
        <Field label="Échéance visée">{(id) => <NumberInput id={id} decimals={0} grouping={false} value={targetYear} onChange={setTargetYear} />}</Field>
        <Field label="Nominal">{(id) => <MoneyInput id={id} value={nominal} onChange={setNominal} />}</Field>
        <Button
          disabled={!label.trim() || !targetYear || !nominal}
          onClick={() =>
            targetYear &&
            nominal &&
            addPlan.mutate({ accountId, label, targetYear, nominal }, { onSuccess: () => (setLabel(""), setTargetYear(null), setNominal(null)) })
          }
        >
          Ajouter
        </Button>
      </div>
    </Card>
  );
}
