import { useEffect, useMemo, useState } from "react";
import {
  ACCOUNT_KIND_LABELS,
  ALLOWED_ASSETS,
  ALLOWED_TYPES,
  ASSET_KIND_LABELS,
  accruedFraction,
  bondTerms,
  currencyOf,
  EURO_FUND_TYPES,
  FxBook,
  holdsEuroFunds,
  isForeign,
  type Asset,
  type BondTerms,
  TX_HELP,
  TX_LABELS,
  TX_NEEDS_ASSET,
  TX_OPTIONAL_ASSET,
  suggestOrderFee,
  suggestTradeFee,
  tradeFeeFor,
  institutionWithholding,
  formatEur,
  formatMoney,
  grossFromNet,
  roundCents,
  validateTransaction,
  type Account,
  type Transaction,
  type TxType,
} from "@hamac/core";
import { Button } from "@/shared/components/ui";
import { Field, FormGrid, Modal, MoneyInput, NumberInput, Select, TextInput } from "@/shared/components/form";
import { syncTradeAmounts } from "@/features/entry/lib/tradeAmounts";
import { useMutate, useWorkspaceIndex } from "@/shared/lib/workspace";
import { NewAssetPanel, newAssetErrors, newAssetFor, toAssetInput } from "./NewAssetPanel";
import { AvailableBalanceHint, useAvailableBalance } from "./AvailableBalanceHint";
import { TaxDetailFields } from "./TaxDetailFields";
import { ArbitrageFields, arbitrageChoices } from "./ArbitrageFields";
import { BondTradeFields } from "./BondTradeFields";
import { DepositElsewhere, depositFor } from "./DepositElsewhere";
import { blank, fromTx, type Draft, type TxPreset } from "./transactionDraft";

export type { TxPreset };
import { FxFields } from "./FxFields";
import { rateInUse, rateToStore } from "@/features/entry/lib/fxEntry";
import { useEcbRate } from "@/features/entry/lib/useEcbRate";

/** Préréglage : la saisie s'ouvre sur la création d'un fonds euros. */
export const NEW_FUND_PRESET = "nouveau-fonds-euros";

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
  const saveWithDeposit = useMutate("transactions.createWithdrawalAndDeposit", { success: "Retrait et versement enregistrés" });
  const [d, setD] = useState<Draft | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open || !idx) return;
    setShowErrors(false);
    if (transaction) setD(fromTx(transaction));
    else {
      // titre « nouveau » : la saisie s'ouvre directement sur la création du titre ; de même pour un nouveau fonds euros.
      const fresh = preset.assetId === "nouveau" || preset.assetId === NEW_FUND_PRESET;
      const draft = blank({ ...preset, assetId: fresh ? undefined : preset.assetId }, idx.activeAccounts[0]?.id ?? "");
      const acc = idx.accountById.get(draft.accountId);
      if (preset.assetId === NEW_FUND_PRESET) setD({ ...draft, newFund: "" });
      else setD(preset.assetId === "nouveau" && acc ? { ...draft, newAsset: newAssetFor(acc.kind, preset.assetKinds) } : draft);
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
  // Titre en devise : taux du jour (saisi, sinon BCE) ; quantité et prix unitaire sont dans la devise, les montants en euros.
  const currency = currencyOf(asset ?? d?.newAsset);
  const foreign = isForeign(currency);
  const fxBook = useMemo(() => new FxBook(idx?.ws.fxRates), [idx?.ws.fxRates]);
  const ecb = useEcbRate(fxBook, currency, d?.date ?? null);
  const fxRate = foreign && d ? rateInUse(d, ecb) : null;
  const rate = fxRate ?? 1;
  // Coupon couru (en euros) : la saisie l'emporte sur le calcul, fait dans la devise du titre.
  const accrued = !isBond ? 0 : d?.accrued != null ? d.accrued : terms && d?.quantity ? roundCents((d.quantity * accruedFraction(terms, d.date)) / rate) : 0;
  const isTrade = d?.type === "achat" || d?.type === "vente";
  const params = idx?.ws.params;

  // Frais suggérés selon la grille des paramètres : sur le prix de l'ordre s'il est saisi, sinon extraits du total.
  const suggestedFee = useMemo(() => {
    if (!d || !params || !account || !isTrade || !idx) return null;
    if (d.priceBasis === "unit") {
      if (d.quantity == null || d.unitPrice == null) return null;
      return suggestOrderFee(account, idx.institutionById, params, (d.quantity * d.unitPrice) / (isBond ? 100 : 1) / rate + (isBond ? accrued : 0));
    }
    if (d.amount == null) return null;
    return suggestTradeFee(account, idx.institutionById, params, d.type as "achat" | "vente", d.amount);
  }, [d, params, account, isTrade, isBond, idx, accrued, rate]);
  const available = useAvailableBalance({ active: d?.type === "retrait" && d.newFund == null, accountId: d?.accountId ?? "", date: d?.date ?? "", supportId: d?.assetId ?? null, txId: d?.id });
  const feeSource = account && params && idx ?tradeFeeFor(account, idx.institutionById, params).source.label : "";

  // Achat ou vente : frais suggérés tant qu'ils ne sont pas saisis à la main, et prix unitaire ↔ total.
  useEffect(() => {
    if (!d || !isTrade) return;
    const fee = d.feeManual ? d.fee : suggestedFee;
    const { amount, unitPrice } = syncTradeAmounts({ side: d.type as "achat" | "vente", basis: d.priceBasis, quantity: d.quantity, unitPrice: d.unitPrice, amount: d.amount, fee, accrued: isBond ? accrued : 0, per: isBond ? 100 : 1, rate });
    if (amount !== d.amount || unitPrice !== d.unitPrice || fee !== d.fee) setD({ ...d, amount, unitPrice, fee });
  }, [d, isBond, isTrade, suggestedFee, accrued, rate]);

  // Les autres opérations n'ont pas de frais inclus.
  useEffect(() => {
    if (d && !isTrade && !d.feeManual && d.fee !== null) setD({ ...d, fee: null });
  }, [d, isTrade]);

  if (!idx || !d) return null;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => (x ? { ...x, [k]: v } : x));
  // Un montant tapé en euros (ou un prix) reprend la main sur le total tapé en devise.
  const patch = (p: Partial<Draft>) => setD((x) => (x ? { ...x, ...p, ...("amount" in p || "unitPrice" in p ? { fxBasis: "eur" as const } : {}) } : x));
  const setUnitPrice = (v: number | null) => patch({ unitPrice: v, priceBasis: "unit" });
  const setTotal = (v: number | null) => patch({ amount: v, priceBasis: "total" });
  const allowedTypes = account ? ALLOWED_TYPES[account.kind] : [];
  const needsAsset = TX_NEEDS_ASSET.includes(d.type);
  const optionalAsset = TX_OPTIONAL_ASSET.includes(d.type);
  const assetChoices = account ? idx.activeAssets.filter((a) => a.kind !== "fonds_euros" && ALLOWED_ASSETS[account.kind].includes(a.kind) && (!preset.assetKinds || preset.assetKinds.includes(a.kind))) : [];
  // Contrat d'assurance-vie ou de PER : le fonds euros d'où part ou où arrive l'argent.
  const euroFunds = idx.activeAssets.filter((a) => a.kind === "fonds_euros");
  const supportField = !!account && holdsEuroFunds(account) && EURO_FUND_TYPES.includes(d.type);
  const counterAccount = d.type === "transfert" && d.counterAccountId ? idx.accountById.get(d.counterAccountId) : undefined;
  const counterSupportField = !!counterAccount && holdsEuroFunds(counterAccount) && euroFunds.length > 0;
  const fundLabel = (acc: Account | undefined) => {
    const fallback = acc?.defaultAssetId ? idx.assetById.get(acc.defaultAssetId) : undefined;
    return fallback ? `Support par défaut : ${fallback.name}` : "Espèces du contrat (aucun fonds euros par défaut)";
  };
  const accountChoices = idx.activeAccounts.filter((a) => !preset.accountKinds || preset.accountKinds.includes(a.kind) || a.id === d.accountId);
  const NEW = "__nouveau__";
  const taxDetail = (d.type === "dividende" || d.type === "interets") && (account?.kind === "cto" || account?.kind === "crowdlending");
  const isArbitrage = d.type === "arbitrage";
  const fromFund = d.assetId ? idx.assetById.get(d.assetId)?.kind === "fonds_euros" : false;
  const toFund = d.counterAssetId ? idx.assetById.get(d.counterAssetId)?.kind === "fonds_euros" : false;
  const payload = {
    id: d.id,
    date: d.date,
    type: d.type,
    accountId: d.accountId,
    assetId: (needsAsset && d.newAsset) || (supportField && d.newFund != null) ? NEW : needsAsset || optionalAsset || supportField || isArbitrage ? d.assetId : null,
    counterAccountId: d.type === "transfert" ? d.counterAccountId : null,
    counterAssetId: counterSupportField || isArbitrage ? d.counterAssetId : null,
    amount: d.amount ?? 0,
    quantity: needsAsset || (isArbitrage && !fromFund) ? d.quantity : null,
    counterQuantity: isArbitrage && !toFund ? d.counterQuantity : null,
    fee: isTrade || isArbitrage ? d.fee : null,
    accrued: isBond && isTrade ? d.accrued : null,
    comment: d.comment,
    gross: taxDetail ? d.gross : null,
    withheldIncomeTax: taxDetail ? d.withheldIncomeTax : null,
    withheldSocial: taxDetail ? d.withheldSocial : null,
    withheldForeign: taxDetail ? d.withheldForeign : null,
    fxRate: foreign && (needsAsset || optionalAsset) ? rateToStore(d, d.amount, fxRate) : null,
  };
  // Un titre en cours de création est validé comme s'il existait déjà.
  const creatingFund = supportField && d.newFund != null;
  const newFundInput = { kind: "fonds_euros" as const, name: (d.newFund ?? "").trim(), priceSource: "modele" as const };
  const assetMap: Map<string, Asset> =
    needsAsset && d.newAsset
      ? new Map([...idx.assetById, [NEW, { ...(toAssetInput(d.newAsset) as unknown as Asset), id: NEW, archived: false }]])
      : creatingFund
        ? new Map([...idx.assetById, [NEW, { ...(newFundInput as unknown as Asset), id: NEW, archived: false }]])
        : idx.assetById;
  const errors = [
    ...validateTransaction(payload, idx.accountById, assetMap),
    ...(needsAsset && d.newAsset ? newAssetErrors(d.newAsset).map((message) => ({ field: "assetId" as const, message })) : []),
    ...(creatingFund && !newFundInput.name ? [{ field: "assetId" as const, message: "Nommez le fonds euros (ex. « Euro Nouvelle Génération »)." }] : []),
  ];
  const err = (f: string) => (showErrors ? (errors.find((e) => e.field === f)?.message ?? null) : null);
  const depositOffered = d.type === "retrait" && !d.id && !creatingFund;
  const deposit = depositOffered && d.deposit ? depositFor(payload, d.deposit) : null;
  const depositErrors = deposit ? validateTransaction(deposit, idx.accountById, idx.assetById) : [];
  const depositErr = (f: string) => (showErrors ? (depositErrors.find((e) => e.field === f)?.message ?? null) : null);
  const allInUnitCost = isTrade && d.amount && d.quantity ? d.amount / d.quantity : null;
  const withdrawHint = available && <AvailableBalanceHint available={available} date={d.date} amount={d.amount} onWithdrawAll={(v) => set("amount", v)} />;
  const amountHelp = d.type === "correction" ? "Négatif pour baisser la valeur calculée." : withdrawHint || undefined;

  const submit = (again: boolean) => {
    setShowErrors(true);
    if (errors.length || depositErrors.length) return;
    if ((needsAsset && d.newAsset) || creatingFund) {
      saveWithAsset.mutate(
        { asset: creatingFund ? newFundInput : toAssetInput(d.newAsset!), transaction: { ...payload, assetId: null } },
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
    const onSuccess = () => {
      if (again) {
        setShowErrors(false);
        setD({ ...blank({ accountId: d.accountId, type: d.type, assetId: d.assetId ?? undefined }, d.accountId), date: d.date });
      } else onClose();
    };
    if (deposit) saveWithDeposit.mutate({ withdrawal: payload, deposit }, { onSuccess });
    else save.mutate(payload, { onSuccess });
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
          <Button variant="primary" onClick={() => submit(false)} disabled={save.isPending || saveWithAsset.isPending || saveWithDeposit.isPending}>
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
                  setD((x) => (x ? { ...x, accountId: e.target.value, type: acc && !ALLOWED_TYPES[acc.kind].includes(x.type) ? "versement" : x.type, assetId: null, newFund: null } : x));
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
              <Select id={id} value={d.counterAccountId ?? ""} onChange={(e) => setD((x) => (x ? { ...x, counterAccountId: e.target.value || null, counterAssetId: null } : x))}>
                <option value="">Choisir…</option>
                {idx.activeAccounts.filter((a) => a.id !== d.accountId).map(accountOption)}
              </Select>
            )}
          </Field>
        )}

        {counterSupportField && (
          <Field label="Sur le support" error={err("counterAssetId")}>
            {(id) => (
              <Select id={id} value={d.counterAssetId ?? ""} onChange={(e) => set("counterAssetId", e.target.value || null)}>
                <option value="">{fundLabel(counterAccount)}</option>
                {euroFunds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {supportField && (
          <Field
            label={d.type === "transfert" ? "Depuis le support" : "Support"}
            error={err("assetId")}
            help={d.type === "interets" ? "Intérêts d'un fonds euros. Pour le coupon d'une obligation du contrat, laissez le support par défaut et choisissez l'obligation ci-dessous." : undefined}
          >
            {(id) => (
              <Select
                id={id}
                value={d.newFund != null ? NEW : d.assetId && euroFunds.some((f) => f.id === d.assetId) ? d.assetId : ""}
                onChange={(e) =>
                  setD((x) =>
                    x ? (e.target.value === NEW ? { ...x, assetId: null, newFund: "" } : { ...x, assetId: e.target.value || null, newFund: null }) : x,
                  )
                }
              >
                <option value="">{fundLabel(account)}</option>
                {euroFunds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
                {!d.id && <option value={NEW}>＋ Nouveau fonds euros</option>}
              </Select>
            )}
          </Field>
        )}

        {creatingFund && (
          <Field label="Nom du fonds euros" help="Tel qu'il figure sur le relevé de l'assureur. Il pourra servir à d'autres contrats du même assureur.">
            {(id) => <TextInput id={id} value={d.newFund ?? ""} onChange={(e) => set("newFund", e.target.value)} autoFocus />}
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
          <BondTradeFields d={d} patch={patch} err={err} feeSource={feeSource} accrued={accrued} currency={currency} rate={rate} />
        ) : isTrade ? (
          <FormGrid>
            <Field label="Quantité" error={err("quantity")}>
              {(id) => <NumberInput id={id} decimals={8} value={d.quantity} onChange={(v) => set("quantity", v)} />}
            </Field>
            <Field label="Prix par unité" help={d.priceBasis === "total" && d.unitPrice != null ? "Calculé d'après le montant total, hors frais." : "Hors frais. Remplissez ce champ ou le montant total."}>
              {(id) => <NumberInput id={id} suffix={foreign ? currency : "€"} decimals={8} value={d.unitPrice} onChange={setUnitPrice} />}
            </Field>
            <Field label="dont frais" error={err("fee")} help={d.feeManual ? "Saisis à la main." : `Calculés : ${feeSource.charAt(0).toLowerCase()}${feeSource.slice(1)}.`}>
              {(id) => <MoneyInput id={id} value={d.fee} onChange={(v) => patch({ fee: v, feeManual: v != null })} />}
            </Field>
            <Field label={d.type === "achat" ? "Montant total débité" : "Montant net reçu"} error={err("amount")} help={d.priceBasis === "unit" ? (d.type === "achat" ? "Calculé : quantité × prix + frais." : "Calculé : quantité × prix − frais.") : "Remplissez ce champ ou le prix par unité."}>
              {(id) => <MoneyInput id={id} value={d.amount} onChange={setTotal} />}
            </Field>
          </FormGrid>
        ) : isArbitrage ? (
          <ArbitrageFields d={d} patch={(p) => setD((x) => (x ? { ...x, ...p } : x))} err={err} account={account} choices={arbitrageChoices(account, idx.activeAssets)} fromFund={fromFund} toFund={toFund} />
        ) : (
          <FormGrid cols={needsAsset ? 3 : 2}>
            <Field
              label="Montant"
              error={err("amount")}
              help={amountHelp}
            >
              {(id) => <MoneyInput id={id} value={d.amount} allowNegative={d.type === "correction"} onChange={(v) => patch({ amount: v })} />}
            </Field>
            {needsAsset && (
              <Field label="Quantité" error={err("quantity")}>
                {(id) => <NumberInput id={id} decimals={8} value={d.quantity} onChange={(v) => set("quantity", v)} />}
              </Field>
            )}
          </FormGrid>
        )}

        {foreign && (isTrade || (optionalAsset && d.assetId)) && (
          <FxFields
            currency={currency}
            d={d}
            amount={d.amount}
            rate={fxRate}
            ecb={ecb}
            label={d.type === "achat" ? "Total débité" : d.type === "vente" ? "Total reçu" : "Montant reçu"}
            patch={(p) => setD((x) => (x ? { ...x, ...p } : x))}
            err={err}
          />
        )}

        {taxDetail && (
          <TaxDetailFields
            draft={d}
            onChange={(patch) => setD((x) => (x ? { ...x, ...patch } : x))}
            error={err("gross")}
            prefill={account && d.amount ? grossFromNet(d.amount, institutionWithholding(account.institutionId ? idx.institutionById.get(account.institutionId) : null, +d.date.slice(0, 4), idx.ws.params, d.type === "dividende" ? "dividende" : "interets")) : null}
          />
        )}

        {allInUnitCost != null && (isBond || (d.fee ?? 0) > 0) && (
          <p className="text-xs text-fg-muted">
            {isBond ? `Coût pour 1 ${foreign ? currency : "€"} de nominal` : "Prix unitaire frais compris"} :{" "}
            <span className="num text-fg">{isBond ? `${(allInUnitCost * rate * 100).toFixed(3).replace(".", ",")} %` : foreign ? formatMoney(allInUnitCost * rate, currency) : formatEur(allInUnitCost)}</span>
          </p>
        )}

        {depositOffered && (
          <DepositElsewhere value={d.deposit} onChange={(v) => set("deposit", v)} fromAccountId={d.accountId} accounts={idx.activeAccounts} assets={idx.activeAssets} option={accountOption} err={depositErr} />
        )}

        <Field label="Commentaire" help={deposit ? "Repris sur le retrait et sur le versement." : undefined}>{(id) => <TextInput id={id} value={d.comment} onChange={(e) => set("comment", e.target.value)} />}</Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
