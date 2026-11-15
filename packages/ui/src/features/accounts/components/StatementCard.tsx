import { useMemo, useState } from "react";
import { reconcile, type AccountState } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Field, FormGrid, MoneyInput, TextInput } from "@/shared/components/form";
import { Button, Card, CardTitle } from "@/shared/components/ui";
import { formatDate, todayIso } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useMutate } from "@/shared/lib/workspace";

/** Contrôle d'un contrat avec le relevé de l'assureur : la valeur relevée, comparée au calcul à la date du relevé. */
export function StatementCard({ s }: { s: AccountState }) {
  const save = useMutate("statements.upsert", { success: "Relevé enregistré" });
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const pf = usePortfolio();
  // Écart calculé à la date du relevé, et non avec la valeur du jour.
  const row = useMemo(() => (pf ? reconcile(pf.data, pf.today).find((r) => r.account.id === s.account.id) : undefined), [pf, s.account.id]);
  const gap = row?.valueGap ?? null;
  return (
    <Card>
      <CardTitle>Contrôle avec le relevé</CardTitle>
      {s.lastStatement ? (
        <div className="mb-4 text-sm">
          Relevé du {formatDate(s.lastStatement.date)} : <Amount value={s.lastStatement.value} />
          <div className="mt-1">
            {gap != null && Math.abs(gap) >= 1 ? (
              <span className="text-warning">
                Écart de <Amount value={gap} signed /> à la date du relevé : saisir une « Correction » dans le journal.
              </span>
            ) : (
              <span className="text-positive">✓ Concorde avec le calcul</span>
            )}
          </div>
        </div>
      ) : (
        <p className="mb-4 text-sm text-fg-muted">Relevez la valeur sur le site de l'assureur pour vérifier le calcul.</p>
      )}
      <FormGrid>
        <Field label="Valeur relevée">{(id) => <MoneyInput id={id} value={value} onChange={setValue} />}</Field>
        <Field label="Le">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      </FormGrid>
      <Button className="mt-3 w-full" disabled={value == null} onClick={() => value != null && save.mutate({ accountId: s.account.id, date, value }, { onSuccess: () => setValue(null) })}>
        Enregistrer le relevé
      </Button>
    </Card>
  );
}
