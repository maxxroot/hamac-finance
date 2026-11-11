import { useEffect, useMemo, useState } from "react";
import { computePortfolio, type Account } from "@hamac/core";
import { Field, FormGrid, Modal, MoneyInput, NumberInput, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { formatNumber, todayIso } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

/** Comptes qui détiennent des titres : on y relève aussi les espèces et les quantités. */
const WITH_SECURITIES = new Set<Account["kind"]>(["pea", "pea_pme", "cto", "assurance_vie", "per", "epargne_salariale", "crypto"]);

/** Saisie d'un relevé : valeur totale, espèces et quantités vues sur le site de l'établissement. */
export function StatementDialog({ account, open, onClose }: Readonly<{ account: Account | null; open: boolean; onClose: () => void }>) {
  const pf = usePortfolio();
  const save = useMutate("statements.upsert", { success: "Relevé enregistré" });
  const [date, setDate] = useState(todayIso());
  const [value, setValue] = useState<number | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number | null>>({});
  const [comment, setComment] = useState("");
  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setValue(null);
    setCash(null);
    setQuantities({});
    setComment("");
  }, [open, account]);

  // Titres détenus à la date du relevé, d'après le journal : leurs quantités servent d'indication.
  const held = useMemo(() => {
    if (!pf || !account || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    return computePortfolio(pf.data, date).accountById.get(account.id)?.positions ?? [];
  }, [pf, account, date]);
  if (!account) return null;
  const securities = WITH_SECURITIES.has(account.kind);
  const positions = Object.entries(quantities)
    .filter((e): e is [string, number] => e[1] != null)
    .map(([assetId, quantity]) => ({ assetId, quantity }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Relevé de « ${account.name} »`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={value == null || !date || save.isPending} onClick={() => value != null && save.mutate({ accountId: account.id, date, value, cash: securities ? cash : null, positions, comment }, { onSuccess: onClose })}>
            Enregistrer le relevé
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">Recopiez ce qu'affiche le site de l'établissement à une date : Hamac le compare à son calcul à la même date.</p>
        <FormGrid cols={securities ? 3 : 2}>
          <Field label="Date du relevé">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Valeur totale">{(id) => <MoneyInput id={id} value={value} onChange={setValue} autoFocus />}</Field>
          {securities && (
            <Field label="Espèces (facultatif)" help="Le solde disponible, hors titres.">
              {(id) => <MoneyInput id={id} value={cash} onChange={setCash} />}
            </Field>
          )}
        </FormGrid>
        {securities && held.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-fg-muted">Quantités relevées (facultatives) : laissez vide un titre que vous ne vérifiez pas</div>
            <div className="space-y-2">
              {held.map((p) => (
                <div key={p.asset.id} className="grid grid-cols-[1fr_10rem] items-end gap-3">
                  <div className="pb-2 text-sm">
                    {p.asset.name}
                    <span className="ml-2 text-xs text-fg-faint">calculé : {formatNumber(p.quantity, 6)}</span>
                  </div>
                  <Field label="">{(id) => <NumberInput id={id} decimals={6} value={quantities[p.asset.id] ?? null} onChange={(v) => setQuantities((q) => ({ ...q, [p.asset.id]: v }))} aria-label={`Quantité relevée de ${p.asset.name}`} />}</Field>
                </div>
              ))}
            </div>
          </div>
        )}
        <Field label="Commentaire">{(id) => <TextInput id={id} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ex. relevé annuel, capture du site" />}</Field>
      </div>
    </Modal>
  );
}
