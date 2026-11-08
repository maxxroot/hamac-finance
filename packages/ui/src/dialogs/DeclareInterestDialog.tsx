import { useState } from "react";
import { formatEur, type Account } from "@hamac/core";
import { Field, Modal, MoneyInput, Select, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { formatMonth, todayIso } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

/** Intérêts reçus sur un mois pour toute une plateforme, paiements partiels compris : une opération au Journal. */
export function DeclareInterestDialog({ platforms, withheld, journal, onClose }: { platforms: readonly Account[]; withheld: ReadonlyMap<string, boolean>; journal: ReadonlyArray<{ accountId: string; type: string; date: string; amount: number }>; onClose: () => void }) {
  const [accountId, setAccountId] = useState(platforms[0]?.id ?? "");
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [amount, setAmount] = useState<number | null>(null);
  const save = useMutate("transactions.upsert", { success: "Intérêts enregistrés" });
  const already = journal.filter((t) => t.accountId === accountId && t.type === "interets" && t.date.startsWith(`${month}-`)).reduce((s, t) => s + t.amount, 0);
  const [y, m] = month.split("-").map(Number);
  const lastDay = month ? `${month}-${String(new Date(Date.UTC(y!, m!, 0)).getUTCDate()).padStart(2, "0")}` : "";
  return (
    <Modal
      open
      onClose={onClose}
      title="Déclarer les intérêts du mois"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !accountId || !month || !amount || amount <= 0} onClick={() => save.mutate({ date: lastDay, type: "interets", accountId, amount: amount!, comment: `Intérêts de ${formatMonth(month)}` }, { onSuccess: onClose })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Plateforme">
          {(id) => (
            <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {platforms.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Mois">{(id) => <TextInput id={id} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>
        <Field label="Intérêts reçus" help={withheld.get(accountId) ? "Montant net, tel que crédité : la plateforme prélève les impôts." : "Montant brut : les impôts seront à payer."}>
          {(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}
        </Field>
        {already > 0 && <p className="text-sm text-warning">Déjà {formatEur(already)} déclarés pour ce mois sur cette plateforme.</p>}
      </div>
    </Modal>
  );
}
