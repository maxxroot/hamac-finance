import type { ReactNode } from "react";
import { ALLOWED_TYPES, holdsEuroFunds, type Account, type Asset } from "@hamac/core";
import { Checkbox, Field, FormGrid, Select } from "@/shared/components/form";

/** Versement sur un autre compte, enregistré avec le retrait. */
export interface Deposit {
  accountId: string;
  /** Fonds euros crédité dans un contrat ; null = son support par défaut. */
  assetId: string | null;
}

/** Le versement qui accompagne un retrait : même date, même montant, même commentaire. */
export function depositFor(withdrawal: { date: string; amount: number; comment: string }, deposit: Deposit) {
  return {
    date: withdrawal.date,
    type: "versement" as const,
    accountId: deposit.accountId,
    assetId: deposit.assetId,
    counterAccountId: null,
    counterAssetId: null,
    amount: withdrawal.amount,
    quantity: null,
    counterQuantity: null,
    fee: null,
    comment: withdrawal.comment,
    gross: null,
    withheldIncomeTax: null,
    withheldSocial: null,
    withheldForeign: null,
  };
}

/** Case « Verser aussi cette somme sur un autre compte » et choix du compte à créditer. */
export function DepositElsewhere({
  value,
  onChange,
  fromAccountId,
  accounts,
  assets,
  option,
  err,
}: {
  value: Deposit | null;
  onChange: (v: Deposit | null) => void;
  fromAccountId: string;
  accounts: readonly Account[];
  assets: readonly Asset[];
  option: (a: Account) => ReactNode;
  err: (field: string) => string | null;
}) {
  const choices = accounts.filter((a) => a.id !== fromAccountId && ALLOWED_TYPES[a.kind].includes("versement"));
  const target = value ? accounts.find((a) => a.id === value.accountId) : undefined;
  const funds = assets.filter((a) => a.kind === "fonds_euros");
  const fallback = target?.defaultAssetId ? funds.find((f) => f.id === target.defaultAssetId) : undefined;
  return (
    <div className="space-y-3">
      <Checkbox checked={value != null} onChange={(on) => onChange(on ? { accountId: "", assetId: null } : null)} label="Verser aussi cette somme sur un autre compte" />
      {value && (
        <div className="rounded-xl border border-line bg-surface-2/40 p-4">
          <FormGrid>
            <Field label="Compte à créditer" error={err("accountId")} help="Un versement du même montant, à la même date, avec le même commentaire.">
              {(id) => (
                <Select id={id} value={value.accountId} onChange={(e) => onChange({ accountId: e.target.value, assetId: null })}>
                  <option value="">Choisir…</option>
                  {choices.map(option)}
                </Select>
              )}
            </Field>
            {target && holdsEuroFunds(target) && funds.length > 0 && (
              <Field label="Sur le support" error={err("assetId")}>
                {(id) => (
                  <Select id={id} value={value.assetId ?? ""} onChange={(e) => onChange({ ...value, assetId: e.target.value || null })}>
                    <option value="">{fallback ? `Support par défaut : ${fallback.name}` : "Espèces du contrat (aucun fonds euros par défaut)"}</option>
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          </FormGrid>
        </div>
      )}
    </div>
  );
}
