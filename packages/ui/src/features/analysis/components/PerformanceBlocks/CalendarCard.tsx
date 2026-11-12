import { type CSSProperties } from "react";
import { type CalendarYear, type MonthStats } from "@hamac/core";
import { Pct } from "@/shared/components/Stat";
import { Table, Td, Th } from "@/shared/components/table";
import { Card, CardTitle } from "@/shared/components/ui";
import { capitalize, formatMonth } from "@/shared/lib/numbers";
import { heatShare, pctText } from "@/features/analysis/lib/performance";

export const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export function heatStyle(rate: number): CSSProperties | undefined {
  if (Math.abs(rate) < 0.0005) return undefined;
  return { backgroundColor: `color-mix(in srgb, var(--color-${rate > 0 ? "positive" : "negative"}) ${heatShare(rate)}%, transparent)` };
}

export const monthLabel = (m: string) => capitalize(formatMonth(m));

export function CalendarCard({ calendar, stats }: { calendar: readonly CalendarYear[]; stats: MonthStats | null }) {
  return (
    <Card>
      <CardTitle hint="toujours sur tout l'historique">Calendrier des mois</CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Année</Th>
            {MONTH_LABELS.map((m) => (
              <Th key={m} align="center" className="px-1">{m}</Th>
            ))}
            <Th align="right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {[...calendar].reverse().map((y) => (
            <tr key={y.year}>
              <Td className="font-medium">{y.year}</Td>
              {y.months.map((r, i) => (
                <td key={i} className="num border border-surface px-1 py-1.5 text-center text-xs" style={r == null ? undefined : heatStyle(r)} title={r == null ? undefined : `${MONTH_LABELS[i]} ${y.year} : ${pctText(r)}`}>
                  {r == null ? <span className="text-fg-faint">·</span> : (r * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: "exceptZero" })}
                </td>
              ))}
              <Td align="right"><Pct value={y.rate} signed /></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {stats && (
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-muted">
          <span>Meilleur mois : <b className="text-fg">{monthLabel(stats.best.month)}</b> ({pctText(stats.best.rate)})</span>
          <span>Pire mois : <b className="text-fg">{monthLabel(stats.worst.month)}</b> ({pctText(stats.worst.rate)})</span>
          <span><b className="text-fg">{stats.positive}</b> mois positifs sur {stats.counted}</span>
        </p>
      )}
    </Card>
  );
}
