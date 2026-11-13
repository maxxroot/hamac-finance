import { formatEur, roundCents } from "@hamac/core";
import { Button } from "@/shared/components/ui";
import { Field, FormGrid, MoneyInput } from "@/shared/components/form";

export interface TaxDetail {
  amount: number | null;
  gross: number | null;
  withheldIncomeTax: number | null;
  withheldSocial: number | null;
  withheldForeign: number | null;
}

/** Détail fiscal d'un dividende ou d'intérêts, repris dans le récapitulatif fiscal. */
export function TaxDetailFields({ draft, onChange, error, prefill }: { draft: TaxDetail; onChange: (patch: Partial<TaxDetail>) => void; error: string | null; prefill: { gross: number; incomeTax: number; social: number } | null }) {
  const gap = draft.gross != null && draft.amount != null ? roundCents(draft.gross - (draft.withheldIncomeTax ?? 0) - (draft.withheldSocial ?? 0) - (draft.withheldForeign ?? 0) - draft.amount) : 0;
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Détail fiscal (facultatif)</h3>
          <p className="text-xs text-fg-faint">Tel qu'indiqué sur le relevé. Le montant ci-dessus reste le net reçu.</p>
        </div>
        {prefill && (
          <Button type="button" variant="ghost" className="h-7 text-xs" onClick={() => onChange({ gross: prefill.gross, withheldIncomeTax: prefill.incomeTax, withheldSocial: prefill.social, withheldForeign: 0 })}>
            Calculer d'après les taux
          </Button>
        )}
      </div>
      <FormGrid>
        <Field label="Revenu brut" error={error}>
          {(id) => <MoneyInput id={id} value={draft.gross} onChange={(v) => onChange({ gross: v })} />}
        </Field>
        <Field label="Acompte d'impôt retenu">{(id) => <MoneyInput id={id} value={draft.withheldIncomeTax} onChange={(v) => onChange({ withheldIncomeTax: v })} />}</Field>
        <Field label="Prélèvements sociaux retenus">{(id) => <MoneyInput id={id} value={draft.withheldSocial} onChange={(v) => onChange({ withheldSocial: v })} />}</Field>
        <Field label="Retenue à l'étranger">{(id) => <MoneyInput id={id} value={draft.withheldForeign} onChange={(v) => onChange({ withheldForeign: v })} />}</Field>
      </FormGrid>
      {Math.abs(gap) >= 0.02 && <p className="mt-3 text-xs text-warning">Le brut moins les retenues diffère du montant reçu de {formatEur(gap)}.</p>}
    </div>
  );
}
