import type { PropertyBalance } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { DetailLine as Line } from "@/shared/components/DetailLine";
import { Card, CardTitle } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/numbers";

/** Bilan depuis l'achat : ce qui est sorti de votre poche, ce qui est rentré, et ce que le bien vous a fait gagner. */
export function BalanceCard({ balance: b }: { balance: PropertyBalance | null }) {
  return (
    <Card>
      <CardTitle hint={b ? `du ${formatDate(b.since)} au ${formatDate(b.until)}` : undefined}>Bilan depuis l'achat</CardTitle>
      {b == null ? (
        <p className="text-sm text-fg-muted">Indiquez la date d'achat du bien pour faire son bilan.</p>
      ) : (
        <>
          <div className="mb-1 text-xs font-medium text-fg-muted">Sorti de votre poche</div>
          <Line label="Apport (ce que le crédit n'a pas financé)">{b.contribution == null ? "—" : <Amount value={b.contribution} />}</Line>
          <Line label="Échéances du crédit payées">
            <Amount value={b.loanPayments} />
          </Line>
          <Line label="Dépenses payées">
            <Amount value={b.expenses} />
          </Line>
          {b.taxes !== 0 && (
            <Line label="Impôts estimés sur les loyers">
              <Amount value={b.taxes} />
            </Line>
          )}
          <Line label="Total sorti" strong>
            {b.out == null ? "—" : <Amount value={b.out} />}
          </Line>
          <div className="mt-3 mb-1 text-xs font-medium text-fg-muted">Rentré</div>
          <Line label="Loyers et charges reçus">
            <Amount value={b.rents} />
          </Line>
          {b.otherIncome !== 0 && (
            <Line label="Autres recettes">
              <Amount value={b.otherIncome} />
            </Line>
          )}
          <Line label="Total rentré" strong>
            <Amount value={b.in} />
          </Line>
          <div className="mt-3 border-t border-line pt-2">
            <Line label="Effort net (sorti − rentré)" strong>
              {b.netEffort == null ? "—" : <Amount value={b.netEffort} />}
            </Line>
            {b.monthlyEffort != null && (
              <Line label={`Effort moyen, sur ${b.months} mois`}>
                <Amount value={b.monthlyEffort} /> par mois
              </Line>
            )}
            <Line label="Valeur nette aujourd'hui">
              <Amount value={b.netValue} />
            </Line>
            <Line label="Enrichissement (valeur nette − effort net)" strong>
              {b.enrichment == null ? "—" : <Amount value={b.enrichment} signed />}
            </Line>
          </div>
          <p className="mt-3 text-xs text-fg-faint">
            Pour votre part. Les améliorations comptent dans l'apport ; le capital remboursé est dans les échéances et se retrouve dans la valeur nette. Avant impôt sur une plus-value de revente.
            {b.contribution == null && " Indiquez le prix d'achat pour calculer l'apport."}
          </p>
        </>
      )}
    </Card>
  );
}
