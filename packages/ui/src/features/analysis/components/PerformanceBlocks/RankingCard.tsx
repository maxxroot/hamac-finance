import { type AssetPerformance } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { Card, CardTitle } from "@/shared/components/ui";
import { rankingView } from "@/features/analysis/lib/performance";

export function RankList({ title, rows, nameOf }: { title?: string; rows: readonly AssetPerformance[]; nameOf: (id: string) => string }) {
  return (
    <div className="min-w-0">
      {title && <h3 className="mb-2 text-xs font-medium text-fg-faint">{title}</h3>}
      <ul className="divide-y divide-line/60 text-sm">
        {rows.map((r) => (
          <li key={r.assetId} className="flex items-baseline justify-between gap-3 py-2">
            <span className="min-w-0 truncate" title={nameOf(r.assetId)}>{nameOf(r.assetId)}</span>
            <span className="flex shrink-0 items-baseline gap-3">
              <Amount value={r.gain} signed compact />
              <span className="w-16 text-right text-xs"><Pct value={r.rate} signed /></span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RankingCard({ rows, nameOf }: { rows: readonly AssetPerformance[]; nameOf: (id: string) => string }) {
  const { best, worst } = rankingView(rows);
  return (
    <Card>
      <CardTitle hint="dividendes compris">Classement des titres</CardTitle>
      {rows.length === 0 && <p className="py-16 text-center text-sm text-fg-muted">Aucun titre sur cette période.</p>}
      <div className="space-y-5">
        {best.length > 0 && <RankList title={worst.length ? "Les meilleurs" : undefined} rows={best} nameOf={nameOf} />}
        {worst.length > 0 && <RankList title="Les moins bons" rows={worst} nameOf={nameOf} />}
      </div>
    </Card>
  );
}
