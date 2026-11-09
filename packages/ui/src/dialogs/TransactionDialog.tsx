import { useEffect, useMemo, useState } from "react";
import {
  ACCOUNT_KIND_LABELS,
  ALLOWED_ASSETS,
  ALLOWED_TYPES,
  ASSET_KIND_LABELS,
  accruedFraction,
  bondTerms,
  type Asset,
  type BondTerms,
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
  type AccountKind,
  type AssetKind,
  type Transaction,
  type TxType,
} from "@hamac/core";
import { Button } from "@/components/ui";
import { Field, FormGrid, Modal, MoneyInput, NumberInput, Select, TextInput } from "@/components/form";
import { todayIso } from "@/lib/numbers";
import { syncTradeAmounts, type PriceBasis } from "@/lib/tradeAmounts";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";
import { NewAssetPanel, newAssetErrors, newAssetFor, toAssetInput, type NewAsset } from "./NewAssetPanel";

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
  /** Prix d'une unité hors frais, ou en % du nominal pour une obligation (aide à la saisie, non stocké). */
  unitPrice: number | null;
  /** Le prix unitaire ou le total a été saisi : l'autre se calcule. */
  priceBasis: PriceBasis;
  comment: string;
  /** Titre à créer avec l'opération (achat d'un titre pas encore connu). */
  newAsset: NewAsset | null;
}

export interface TxPreset {
  accountId?: string;
  type?: TxType;
  assetId?: string;
  /** Titres proposés (ex. seulement des obligations depuis la page Obligations). */
  assetKinds?: AssetKind[];
  /** Comptes proposés (ex. PEA et comptes-titres depuis Actions & ETF). */
  accountKinds?: AccountKind[];
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
    unitPrice: null,
    priceBasis: "total",
    comment: "",
    newAsset: null,
  };
}

function fromTx(tx: Transaction): Draft {
  return { ...tx, feeManual: tx.fee != null, unitPrice: null, priceBasis: "total", newAsset: null };
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
  const saveWithAsset = useMutate("transactions.createWithAsset", { success: "Titre créé et opération enregistrée" });
  const [d, setD] = useState<Draft | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open || !idx) return;
    setShowErrors(false);
    if (transaction) setD(fromTx(transaction));
    else {
      // titre « nouveau » : la saisie s'ouvre directement sur la création du titre.
      const draft = blank({ ...preset, assetId: preset.assetId === "nouveau" ? undefined : preset.assetId }, idx.activeAccounts[0]?.id ?? "");
      const acc = idx.accountById.get(draft.accountId);
      setD(preset.assetId === "nouveau" && acc ? { ...draft, newAsset: newAssetFor(acc.kind, preset.assetKinds) } : draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id]);

  const account: Account | undefined = d ? idx?.accountById.get(d.accountId) : undefined;
  const asset = d?.assetId ? idx?.assetById.get(d.assetId) : undefined;
  const isBond = asset?.kind === "obligation" || d?.newAsset?.kind === "obligation";
  // Caractéristiques de l'obligation (titre existant ou en cours de création), pour le coupon couru.
  const terms: BondTerms | null = asset
    ? bondTerms(asset)
    : d?.newAsset?.kind === "obligation" && d.newAsset.couponRate != null && d.newAsset.maturityDate
      ? { couponRate: d.newAsset.couponRate, maturityDate: d.newAsset.maturityDate, frequency: d.newAsset.couponFrequency, couponAnchor: d.newAsset.nextCouponDate || null }
      : null;
  const accrued = isBond && terms && d?.quantity ? roundCents(d.quantity * accruedFraction(terms, d.date)) : 0;
  const isTrade = d?.type === "achat" || d?.type === "vente";
  const params = idx?.ws.params;

  // Frais suggérés selon la grille des paramètres : sur le prix de l'ordre s'il est saisi, sinon extraits du total.
  const suggestedFee = useMemo(() => {
    if (!d || !params || !account || !isTrade || !idx) return null;
    if (d.priceBasis === "unit") {
      if (d.quantity == null || d.unitPrice == null) return null;
      return suggestOrderFee(account, idx.institutionById, params, (d.quantity * d.unitPrice) / (isBond ? 100 : 1) + (isBond ? accrued : 0));
    }
    if (d.amount == null) return null;
    return suggestTradeFee(account, idx.institutionById, params, d.type as "achat" | "vente", d.amount);
  }, [d, params, account, isTrade, isBond, idx, accrued]);
  const feeSource = account && params && idx ? tradeFeeFor(account, idx.institutionById, params).source.label : "";

  // Achat ou vente : frais suggérés tant qu'ils ne sont pas saisis à la main, et prix unitaire ↔ total.
  useEffect(() => {
    if (!d || !isTrade) return;
    const fee = d.feeManual ? d.fee : suggestedFee;
    const { amount, unitPrice } = syncTradeAmounts({ side: d.type as "achat" | "vente", basis: d.priceBasis, quantity: d.quantity, unitPrice: d.unitPrice, amount: d.amount, fee, accrued: isBond ? accrued : 0, per: isBond ? 100 : 1 });
    if (amount !== d.amount || unitPrice !== d.unitPrice || fee !== d.fee) setD({ ...d, amount, unitPrice, fee });
  }, [d, isBond, isTrade, suggestedFee, accrued]);

  // Les autres opérations n'ont pas de frais inclus.
  useEffect(() => {
    if (d && !isTrade && !d.feeManual && d.fee !== null) setD({ ...d, fee: null });
  }, [d, isTrade]);

  if (!idx || !d) return null;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => (x ? { ...x, [k]: v } : x));
  const setUnitPrice = (v: number | null) => setD((x) => (x ? { ...x, unitPrice: v, priceBasis: "unit" } : x));
  const setTotal = (v: number | null) => setD((x) => (x ? { ...x, amount: v, priceBasis: "total" } : x));
  const allowedTypes = account ? ALLOWED_TYPES[account.kind] : [];
  const needsAsset = TX_NEEDS_ASSET.includes(d.type);
  const optionalAsset = TX_OPTIONAL_ASSET.includes(d.type);
  const assetChoices = account ? idx.activeAssets.filter((a) => ALLOWED_ASSETS[account.kind].includes(a.kind) && (!preset.assetKinds || preset.assetKinds.includes(a.kind))) : [];
  const accountChoices = idx.activeAccounts.filter((a) => !preset.accountKinds || preset.accountKinds.includes(a.kind) || a.id === d.accountId);
  const NEW = "__nouveau__";
  const payload = {
    id: d.id,
    date: d.date,
    type: d.type,
    accountId: d.accountId,
    assetId: needsAsset && d.newAsset ? NEW : needsAsset || optionalAsset ? d.assetId : null,
    counterAccountId: d.type === "transfert" ? d.counterAccountId : null,
    amount: d.amount ?? 0,
    quantity: needsAsset ? d.quantity : null,
    fee: isTrade ? d.fee : null,
    comment: d.comment,
  };
  // Un titre en cours de création est validé comme s'il existait déjà.
  const assetMap: Map<string, Asset> =
    needsAsset && d.newAsset ? new Map([...idx.assetById, [NEW, { ...(toAssetInput(d.newAsset) as unknown as Asset), id: NEW, archived: false }]]) : idx.assetById;
  const errors = [
    ...validateTransaction(payload, idx.accountById, assetMap),
    ...(needsAsset && d.newAsset ? newAssetErrors(d.newAsset).map((message) => ({ field: "assetId" as const, message })) : []),
  ];
  const err = (f: string) => (showErrors ? (errors.find((e) => e.field === f)?.message ?? null) : null);
  const allInUnitCost = isTrade && d.amount && d.quantity ? d.amount / d.quantity : null;

  const submit = (again: boolean) => {
    setShowErrors(true);
    if (errors.length) return;
    if (needsAsset && d.newAsset) {
      saveWithAsset.mutate(
        { asset: toAssetInput(d.newAsset), transaction: { ...payload, assetId: null } },
        {
          onSuccess: (r) => {
            const created = (r as { asset: Asset }).asset;
            if (again) {
              setShowErrors(false);
              setD({ ...blank({ accountId: d.accountId, type: d.type, assetId: created.id }, d.accountId), date: d.date });
            } else onClose();
          },
        },
      );
      return;
    }
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
          <Button variant="primary" onClick={() => submit(false)} disabled={save.isPending || saveWithAsset.isPending}>
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
                {accountChoices.map(accountOption)}
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
          <Field
            label={needsAsset ? "Titre" : "Titre concerné (facultatif)"}
            error={d.newAsset ? null : err("assetId")}
            help={needsAsset && assetChoices.length === 0 && !d.newAsset ? "Aucun titre pour ce compte : choisissez « Nouveau titre »." : undefined}
          >
            {(id) => (
              <Select
                id={id}
                value={d.newAsset ? NEW : (d.assetId ?? "")}
                onChange={(e) =>
                  setD((x) =>
                    x
                      ? e.target.value === NEW
                        ? { ...x, assetId: null, newAsset: newAssetFor(account!.kind, preset.assetKinds), feeManual: false }
                        : { ...x, assetId: e.target.value || null, newAsset: null, feeManual: false }
                      : x,
                  )
                }
              >
                <option value="">{needsAsset ? "Choisir…" : "Aucun"}</option>
                {needsAsset && <option value={NEW}>{preset.assetKinds?.length === 1 && preset.assetKinds[0] === "obligation" ? "＋ Nouvelle obligation" : "＋ Nouveau titre"}</option>}
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

        {needsAsset && d.newAsset && account && (
          <NewAssetPanel
            account={account.kind}
            only={preset.assetKinds}
            value={d.newAsset}
            onChange={(n) => setD((x) => (x ? { ...x, newAsset: n } : x))}
            assets={idx.ws.assets}
            onUseExisting={(a) => setD((x) => (x ? { ...x, assetId: a.id, newAsset: null } : x))}
            showErrors={showErrors}
          />
        )}

        {isBond && isTrade ? (
          <FormGrid cols={3}>
            <Field label="Nominal" error={err("quantity")} help="Valeur remboursée à l'échéance.">
              {(id) => <MoneyInput id={id} value={d.quantity} onChange={(v) => set("quantity", v)} />}
            </Field>
            <Field label="Prix (% du nominal)" help={d.priceBasis === "total" && d.unitPrice != null ? "Calculé d'après le total." : "Ex. 96,40 : acheté sous le pair."}>
              {(id) => <NumberInput id={id} suffix="%" decimals={3} value={d.unitPrice} onChange={setUnitPrice} />}
            </Field>
            <Field label="Frais" help={d.feeManual ? "Saisis à la main." : `Calculés : ${feeSource.charAt(0).toLowerCase()}${feeSource.slice(1)}.`}>
              {(id) => <MoneyInput id={id} value={d.fee} onChange={(v) => setD((x) => (x ? { ...x, fee: v, feeManual: v != null } : x))} />}
            </Field>
            <Field label="Coupon couru" help="Intérêts courus depuis le dernier coupon, payés au vendeur.">
              {() => <div className="num flex h-9 items-center justify-end rounded-lg bg-surface-2 px-3 text-sm text-fg-muted">{formatEur(accrued)}</div>}
            </Field>
            <Field label={d.type === "achat" ? "Total débité" : "Total reçu"} className="sm:col-span-2" error={err("amount")} help="Nominal × prix + coupon couru ± frais.">
              {(id) => <MoneyInput id={id} value={d.amount} onChange={setTotal} />}
            </Field>
          </FormGrid>
        ) : isTrade ? (
          <FormGrid>
            <Field label="Quantité" error={err("quantity")}>
              {(id) => <NumberInput id={id} decimals={8} value={d.quantity} onChange={(v) => set("quantity", v)} />}
            </Field>
            <Field label="Prix par unité" help={d.priceBasis === "total" && d.unitPrice != null ? "Calculé d'après le montant total, hors frais." : "Hors frais. Remplissez ce champ ou le montant total."}>
              {(id) => <MoneyInput id={id} decimals={8} value={d.unitPrice} onChange={setUnitPrice} />}
            </Field>
            <Field label="dont frais" error={err("fee")} help={d.feeManual ? "Saisis à la main." : `Calculés : ${feeSource.charAt(0).toLowerCase()}${feeSource.slice(1)}.`}>
              {(id) => <MoneyInput id={id} value={d.fee} onChange={(v) => setD((x) => (x ? { ...x, fee: v, feeManual: v != null } : x))} />}
            </Field>
            <Field label={d.type === "achat" ? "Montant total débité" : "Montant net reçu"} error={err("amount")} help={d.priceBasis === "unit" ? (d.type === "achat" ? "Calculé : quantité × prix + frais." : "Calculé : quantité × prix − frais.") : "Remplissez ce champ ou le prix par unité."}>
              {(id) => <MoneyInput id={id} value={d.amount} onChange={setTotal} />}
            </Field>
          </FormGrid>
        ) : (
          <FormGrid cols={needsAsset ? 3 : 2}>
            <Field
              label="Montant"
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
          </FormGrid>
        )}

        {allInUnitCost != null && (isBond || (d.fee ?? 0) > 0) && (
          <p className="text-xs text-fg-muted">
            {isBond ? "Coût pour 1 € de nominal" : "Prix unitaire frais compris"} :{" "}
            <span className="num text-fg">{isBond ? `${(allInUnitCost * 100).toFixed(3).replace(".", ",")} %` : formatEur(allInUnitCost)}</span>
          </p>
        )}

        <Field label="Commentaire">{(id) => <TextInput id={id} value={d.comment} onChange={(e) => set("comment", e.target.value)} />}</Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
