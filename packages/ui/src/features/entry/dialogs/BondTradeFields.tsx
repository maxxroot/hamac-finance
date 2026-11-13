import type { TxType } from "@hamac/core";
import { Field, FormGrid, MoneyInput, NumberInput } from "@/shared/components/form";
import type { PriceBasis } from "@/features/entry/lib/tradeAmounts";

export interface BondTradeDraft {
  type: TxType;
  quantity: number | null;
  unitPrice: number | null;
  priceBasis: PriceBasis;
  amount: number | null;
  fee: number | null;
  feeManual: boolean;
  /** Coupon couru saisi à la main ; null = calculé d'après la date. */
  accrued: number | null;
}

const linkButton = "cursor-pointer font-medium text-accent underline-offset-2 hover:underline";

/** Achat ou vente d'une obligation : nominal, prix en % du nominal, frais, coupon couru (calculé ou saisi) et total. */
export function BondTradeFields({
  d,
  patch,
  err,
  feeSource,
  accrued,
}: {
  d: BondTradeDraft;
  patch: (p: Partial<BondTradeDraft>) => void;
  err: (f: string) => string | null;
  /** Origine des frais suggérés (« Grille de l'établissement… »). */
  feeSource: string;
  /** Coupon couru retenu : la saisie, sinon le calcul. */
  accrued: number;
}) {
  const accruedHelp =
    d.accrued != null ? (
      <>
        Saisi à la main.{" "}
        <button type="button" className={linkButton} onClick={() => patch({ accrued: null })}>
          Calculer
        </button>
      </>
    ) : (
      "Calculé d'après la date et le calendrier des coupons. Modifiable : reprenez le montant de l'avis d'opéré."
    );
  return (
    <FormGrid cols={3}>
      <Field label="Nominal" error={err("quantity")} help="Valeur remboursée à l'échéance.">
        {(id) => <MoneyInput id={id} value={d.quantity} onChange={(v) => patch({ quantity: v })} />}
      </Field>
      <Field label="Prix (% du nominal)" help={d.priceBasis === "total" && d.unitPrice != null ? "Calculé d'après le total." : "Ex. 96,40 : acheté sous le pair."}>
        {(id) => <NumberInput id={id} suffix="%" decimals={3} value={d.unitPrice} onChange={(v) => patch({ unitPrice: v, priceBasis: "unit" })} />}
      </Field>
      <Field label="Frais" help={d.feeManual ? "Saisis à la main." : `Calculés : ${feeSource.charAt(0).toLowerCase()}${feeSource.slice(1)}.`}>
        {(id) => <MoneyInput id={id} value={d.fee} onChange={(v) => patch({ fee: v, feeManual: v != null })} />}
      </Field>
      <Field label="Coupon couru" error={err("accrued")} help={accruedHelp}>
        {(id) => <MoneyInput id={id} value={accrued} onChange={(v) => patch({ accrued: v })} />}
      </Field>
      <Field label={d.type === "achat" ? "Total débité" : "Total reçu"} className="sm:col-span-2" error={err("amount")} help="Nominal × prix + coupon couru ± frais.">
        {(id) => <MoneyInput id={id} value={d.amount} onChange={(v) => patch({ amount: v, priceBasis: "total" })} />}
      </Field>
    </FormGrid>
  );
}
