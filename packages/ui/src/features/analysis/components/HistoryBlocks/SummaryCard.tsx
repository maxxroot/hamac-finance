import { Amount } from "@/shared/components/Amount";
import { Card } from "@/shared/components/ui";
import { durationLabel, type PeriodSummary } from "@/features/analysis/lib/historique";

/** La période en une phrase : de combien le patrimoine a grandi, et d'où ça vient. */
export function SummaryCard({ s, fromStart }: { s: PeriodSummary; fromStart: boolean }) {
  const delta = s.endValue - s.startValue;
  return (
    <Card className="mb-5">
      <p className="font-display text-xl leading-snug text-fg">
        {fromStart ? (
          <>
            Depuis le début, votre patrimoine financier a atteint <Amount value={s.endValue} compact />.
          </>
        ) : (
          <>
            En {durationLabel(s.months)}, votre patrimoine financier est passé de <Amount value={s.startValue} compact /> à <Amount value={s.endValue} compact /> (<Amount value={delta} signed compact />).
          </>
        )}
      </p>
      {s.moneyShare != null ? (
        <div className="mt-4">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <div className="bg-precaution" style={{ width: `${s.moneyShare * 100}%` }} />
            <div className="bg-positive" style={{ width: `${(1 - s.moneyShare) * 100}%` }} />
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-precaution" aria-hidden />
              <span>
                {Math.round(s.moneyShare * 100)} % vient de votre épargne (<Amount value={s.money} compact />)
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-positive" aria-hidden />
              <span>
                {100 - Math.round(s.moneyShare * 100)} % des placements (<Amount value={s.gain} compact />)
              </span>
            </span>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-fg-muted">
          {s.money >= 0 ? <>Vous avez apporté <Amount value={s.money} compact /></> : <>Vous avez retiré <Amount value={-s.money} compact /> de plus que vous n'avez versé</>}
          {" ; "}
          {s.gain >= 0 ? <>les placements ont rapporté <Amount value={s.gain} compact /></> : <>les placements ont fait perdre <Amount value={-s.gain} compact /></>}.
        </p>
      )}
      {s.months > 0 && s.money > 0 && (
        <p className="mt-2 text-sm text-fg-muted">
          <Amount value={s.perMonth} compact className="font-medium text-fg" /> épargnés par mois en moyenne.
        </p>
      )}
    </Card>
  );
}

// ——— Mois par mois ———
