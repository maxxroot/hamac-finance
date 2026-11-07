import { useEffect, useMemo, useState } from "react";
import {
  ACCOUNT_KIND_LABELS,
  ALLOWED_ASSETS,
  ALLOWED_TYPES,
  ASSET_KIND_LABELS,
  TX_HELP,
  TX_LABELS,
  TX_NEEDS_ASSET,
  TX_OPTIONAL_ASSET,
  suggestOrderFee,
  suggestTradeFee,
  tradeFeeFor,
  formatEur,
  roundCents,
  validateTransaction,
  type Account,
  type Transaction,
  type TxType,
} from "@hamac/core";
import { Button } from "@/components/ui";
import { Field, FormGrid, Modal, MoneyInput, NumberInput, Select, TextInput } from "@/components/form";
import { todayIso } from "@/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

interface Draft {
  id?: string;
  date: string;
  type: TxType;
  accountId: string;
  assetId: string | null;
  counterAccountId: string | null;
  amount: number | null;
  quantity: number | null;
  fee: number | null;
  /** Les frais ont été saisis à la main : on ne les recalcule plus. */
  feeManual: boolean;
  /** Obligations : prix en % du nominal (aide à la saisie, non stocké). */
  pricePct: number | null;
  comment: string;
}

export interface TxPreset {
  accountId?: string;
  type?: TxType;
  assetId?: string;
}

function blank(preset: TxPreset, fallbackAccount: string): Draft {
  return {
    date: todayIso(),
    type: preset.type ?? "versement",
    accountId: preset.accountId ?? fallbackAccount,
    assetId: preset.assetId ?? null,
    counterAccountId: null,
    amount: null,
    quantity: null,
    fee: null,
    feeManual: false,
    pricePct: null,
    comment: "",
  };
}

function fromTx(tx: Transaction): Draft {
  return { ...tx, feeManual: tx.fee != null, pricePct: null };
}

export function TransactionDialog({
  open,
  onClose,
  transaction,
  preset = {},
}: {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  preset?: TxPreset;
}) {
  const idx = useWorkspaceIndex();
  const save = useMutate("transactions.upsert");
  const [d, setD] = useState<Draft | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open || !idx) return;
    setShowErrors(false);
    setD(transaction ? fromTx(transaction) : blank(preset, idx.activeAccounts[0]?.id ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id]);

  const account: Account | undefined = d ? idx?.accountById.get(d.accountId) : undefined;
  const asset = d?.assetId ? idx?.assetById.get(d.assetId) : undefined;
  const isBond = asset?.kind === "obligation";
  const isTrade = d?.type === "achat" || d?.type === "vente";
  const params = idx?.ws.params;

  // Frais suggérés selon la grille des paramètres (Journal!G / OAT!I).
  const suggestedFee = useMemo(() => {
    if (!d || !params || !account || !isTrade || !idx) return null;
    if (isBond) {
      if (d.quantity == null || d.pricePct == null) return null;
      return suggestOrderFee(account, idx.institutionById, params, (d.quantity * d.pricePct) / 100);
    }
    if (d.amount == null) return null;
    return suggestTradeFee(account, idx.institutionById, params, d.type as "achat" | "vente", d.amount);
  }, [d, params, account, isTrade, isBond, idx]);
  const feeSource = account && params && idx ? tradeFeeFor(account, idx.institutionById, params).source.label : "";

  // Obligation : le montant découle du nominal, du prix et des frais.
  useEffect(() => {
    if (!d || !isBond || !isTrade || d.quantity == null || d.pricePct == null) return;
    const fee = d.feeManual ? (d.fee ?? 0) : (suggestedFee ?? 0);
    const gross = (d.quantity * d.pricePct) / 100;
    const amount = roundCents(d.type === "achat" ? gross + fee : gross - fee);
    if (amount !== d.amount || (!d.feeManual && fee !== d.fee)) setD({ ...d, amount, fee: d.feeManual ? d.fee : fee });
  }, [d, isBond, isTrade, suggestedFee]);

  // Autres titres : frais suggérés tant qu'ils n'ont pas été saisis à la main.
  useEffect(() => {
    if (!d || isBond || d.feeManual) return;
    const fee = isTrade ? suggestedFee : null;
    if (fee !== d.fee) setD({ ...d, fee });
  }, [d, isBond, isTrade, suggestedFee]);

  if (!idx || !d) return null;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => (x ? { ...x, [k]: v } : x));
  const allowedTypes = account ? ALLOWED_TYPES[account.kind] : [];
  const needsAsset = TX_NEEDS_ASSET.includes(d.type);
  const optionalAsset = TX_OPTIONAL_ASSET.includes(d.type);
  const assetChoices = account ? idx.activeAssets.filter((a) => ALLOWED_ASSETS[account.kind].includes(a.kind)) : [];
  const payload = {
    id: d.id,
    date: d.date,
    type: d.type,
    accountId: d.accountId,
    assetId: needsAsset || optionalAsset ? d.assetId : null,
    counterAccountId: d.type === "transfert" ? d.counterAccountId : null,
    amount: d.amount ?? 0,
    quantity: needsAsset ? d.quantity : null,
    fee: isTrade ? d.fee : null,
    comment: d.comment,
  };
  const errors = validateTransaction(payload, idx.accountById, idx.assetById);
  const err = (f: string) => (showErrors ? (errors.find((e) => e.field === f)?.message ?? null) : null);
  const unitPrice = isTrade && d.amount && d.quantity ? d.amount / d.quantity : null;

  const submit = (again: boolean) => {
    setShowErrors(true);
    if (errors.length) return;
    save.mutate(payload, {
      onSuccess: () => {
        if (again) {
          setShowErrors(false);
          setD({ ...blank({ accountId: d.accountId, type: d.type, assetId: d.assetId ?? undefined }, d.accountId), date: d.date });
        } else onClose();
      },
    });
  };

  const accountOption = (a: Account) => (
    <option key={a.id} value={a.id}>
      {a.name === ACCOUNT_KIND_LABELS[a.kind] ? a.name : `${a.name} · ${ACCOUNT_KIND_LABELS[a.kind]}`}
    </option>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={d.id ? "Modifier l'opération" : "Nouvelle opération"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          {!d.id && (
            <Button onClick={() => submit(true)} disabled={save.isPending}>
              Enregistrer et saisir une autre
            </Button>
          )}
          <Button variant="primary" onClick={() => submit(false)} disabled={save.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <FormGrid cols={3}>
          <Field label="Date" error={err("date")}>
            {(id) => <TextInput id={id} type="date" value={d.date} onChange={(e) => set("date", e.target.value)} />}
          </Field>
          <Field label="Compte" className="sm:col-span-2" error={err("accountId")}>
            {(id) => (
              <Select
                id={id}
                value={d.accountId}
                onChange={(e) => {
                  const acc = idx.accountById.get(e.target.value);
                  setD((x) => (x ? { ...x, accountId: e.target.value, type: acc && !ALLOWED_TYPES[acc.kind].includes(x.type) ? "versement" : x.type, assetId: null } : x));
                }}
              >
                {idx.activeAccounts.map(accountOption)}
              </Select>
            )}
          </Field>
        </FormGrid>

        <Field label="Opération" help={TX_HELP[d.type]} error={err("type")}>
          {(id) => (
            <Select id={id} value={d.type} onChange={(e) => setD((x) => (x ? { ...x, type: e.target.value as TxType, feeManual: false } : x))}>
              {allowedTypes.map((t) => (
                <option key={t} value={t}>
                  {TX_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {d.type === "transfert" && (
          <Field label="Vers le compte" error={err("counterAccountId")}>
            {(id) => (
              <Select id={id} value={d.counterAccountId ?? ""} onChange={(e) => set("counterAccountId", e.target.value || null)}>
                <option value="">Choisir…</option>
                {idx.activeAccounts.filter((a) => a.id !== d.accountId).map(accountOption)}
              </Select>
            )}
          </Field>
        )}

        {(needsAsset || optionalAsset) && (
          <Field label={needsAsset ? "Titre" : "Titre concerné (facultatif)"} error={err("assetId")} help={assetChoices.length === 0 ? "Aucun titre compatible : ajoutez-en un dans Paramètres › Titres." : undefined}>
            {(id) => (
              <Select id={id} value={d.assetId ?? ""} onChange={(e) => setD((x) => (x ? { ...x, assetId: e.target.value || null, feeManual: false } : x))}>
                <option value="">{needsAsset ? "Choisir…" : "Aucun"}</option>
                {assetChoices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {ASSET_KIND_LABELS[a.kind]}
                    {a.isin ? ` · ${a.isin}` : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {isBond && isTrade ? (
          <FormGrid cols={3}>
            <Field label="Nominal" error={err("quantity")} help="Valeur remboursée à l'échéance.">
              {(id) => <MoneyInput id={id} value={d.quantity} onChange={(v) => set("quantity", v)} />}
            </Field>
            <Field label="Prix (% du nominal)" help="Ex. 96,40 : acheté sous le pair.">
              {(id) => <NumberInput id={id} suffix="%" decimals={3} value={d.pricePct} onChange={(v) => set("pricePct", v)} />}
            </Field>
            <Field label="Frais" help={d.feeManual ? "Saisis à la main." : `Calculés : ${feeSource.toLowerCase()}.`}>
              {(id) => <MoneyInput id={id} value={d.fee} onChange={(v) => setD((x) => (x ? { ...x, fee: v, feeManual: v != null } : x))} />}
            </Field>
            <Field label={d.type === "achat" ? "Total débité" : "Total reçu"} className="sm:col-span-3" error={err("amount")}>
              {(id) => <MoneyInput id={id} value={d.amount} onChange={(v) => set("amount", v)} />}
            </Field>
          </FormGrid>
        ) : (
          <FormGrid cols={needsAsset ? 3 : 2}>
            <Field
              label={d.type === "achat" ? "Montant total débité" : d.type === "vente" ? "Montant net reçu" : "Montant"}
              error={err("amount")}
              help={d.type === "correction" ? "Négatif pour baisser la valeur calculée." : undefined}
            >
              {(id) => <MoneyInput id={id} value={d.amount} allowNegative={d.type === "correction"} onChange={(v) => set("amount", v)} />}
            </Field>
            {needsAsset && (
              <Field label="Quantité" error={err("quantity")}>
                {(id) => <NumberInput id={id} decimals={8} value={d.quantity} onChange={(v) => set("quantity", v)} />}
              </Field>
            )}
            {isTrade && (
              <Field label="dont frais" error={err("fee")} help={d.feeManual ? "Saisis à la main." : `Calculés : ${feeSource.toLowerCase()}.`}>
                {(id) => <MoneyInput id={id} value={d.fee} onChange={(v) => setD((x) => (x ? { ...x, fee: v, feeManual: v != null } : x))} />}
              </Field>
            )}
          </FormGrid>
        )}

        {unitPrice != null && (
          <p className="text-xs text-fg-muted">
            {isBond ? "Coût pour 1 € de nominal" : "Prix unitaire frais compris"} :{" "}
            <span className="num text-fg">{isBond ? `${(unitPrice * 100).toFixed(3).replace(".", ",")} %` : formatEur(unitPrice)}</span>
          </p>
        )}

        <Field label="Commentaire">{(id) => <TextInput id={id} value={d.comment} onChange={(e) => set("comment", e.target.value)} />}</Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
