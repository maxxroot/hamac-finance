import { currencyName } from "@hamac/core";
import { Field, FormGrid, NumberInput } from "@/shared/components/form";
import { formatDate } from "@/shared/lib/numbers";
import { eurFromFx, fxFromEur, type EcbRate, type FxDraft } from "@/features/entry/lib/fxEntry";

const linkButton = "cursor-pointer font-medium text-accent underline-offset-2 hover:underline";

/**
 * Opération sur un titre en devise : taux de change (BCE du jour pré-rempli, modifiable) et total dans la devise.
 * Le total se tape au choix en euros (champ habituel) ou ici dans la devise : l'autre se calcule au taux indiqué.
 */
export function FxFields({
  currency,
  d,
  amount,
  rate,
  ecb,
  label,
  patch,
  err,
}: {
  currency: string;
  d: FxDraft;
  /** Total en euros du formulaire. */
  amount: number | null;
  /** Taux retenu : la saisie, sinon la BCE. */
  rate: number | null;
  ecb: EcbRate | null;
  /** Libellé du total (« Total débité », « Montant reçu »…). */
  label: string;
  patch: (p: Partial<FxDraft> & { amount?: number | null; priceBasis?: "total" }) => void;
  err: (f: string) => string | null;
}) {
  const rateHelp = d.fxManual ? (
    <>
      Saisi d'après l'avis d'opéré.{" "}
      {ecb && (
        <button type="button" className={linkButton} onClick={() => patch({ fxManual: false, fxRate: null })}>
          Reprendre le taux BCE
        </button>
      )}
    </>
  ) : ecb ? (
    `Taux de référence BCE du ${formatDate(ecb.date)}. Remplacez-le par celui de votre établissement s'il diffère.`
  ) : (
    "Taux BCE pas encore disponible : saisissez celui de l'avis d'opéré."
  );
  const shown = d.fxBasis === "fx" ? d.amountFx : amount != null && rate ? fxFromEur(amount, rate) : null;
  return (
    <FormGrid cols={2}>
      <Field label={`Taux de change (${currency} pour 1 €)`} error={err("fxRate")} help={rateHelp}>
        {(id) => (
          <NumberInput
            id={id}
            decimals={6}
            value={rate}
            onChange={(v) => {
              const next = v && v > 0 ? v : null;
              // Total tapé en devise : les euros suivent le nouveau taux.
              patch({ fxRate: next, fxManual: next != null, ...(d.fxBasis === "fx" && d.amountFx != null && next ? { amount: eurFromFx(d.amountFx, next) } : {}) });
            }}
          />
        )}
      </Field>
      <Field label={`${label} en ${currency}`} help={`${currencyName(currency)} : tapez ce montant ou celui en euros, l'autre se calcule.`}>
        {(id) => (
          <NumberInput
            id={id}
            suffix={currency}
            value={shown}
            onChange={(v) => patch({ amountFx: v, fxBasis: "fx", ...(v != null && rate ? { amount: eurFromFx(v, rate), priceBasis: "total" as const } : {}) })}
          />
        )}
      </Field>
    </FormGrid>
  );
}
