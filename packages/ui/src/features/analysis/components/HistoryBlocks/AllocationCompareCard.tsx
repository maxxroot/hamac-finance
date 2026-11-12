import { BUCKET_LABELS, BUCKETS, type BucketChange } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { Card, CardTitle } from "@/shared/components/ui";
import { BUCKET_COLORS } from "@/shared/lib/colors";

export function AllocationCompareCard({ rows, startLabel, endLabel }: { rows: readonly BucketChange[]; startLabel: string; endLabel: string }) {
  const ordered = BUCKETS.flatMap((b) => rows.filter((r) => r.bucket === b));
  return (
    <Card>
      <CardTitle
        hint={
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-fg-faint/45" aria-hidden />{startLabel}</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-fg" aria-hidden />{endLabel}</span>
          </span>
        }
      >
        Répartition par classe
      </CardTitle>
      <ul className="space-y-3.5">
        {ordered.map((r) => (
          <li key={r.bucket} className="text-sm">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-fg-muted">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: BUCKET_COLORS[r.bucket] }} aria-hidden />
                {BUCKET_LABELS[r.bucket]}
              </span>
              <span className="text-xs text-fg-faint num">
                <Pct value={r.startShare} digits={0} /> → <span className="font-medium text-fg"><Pct value={r.endShare} digits={0} /></span>
                <span className="ml-2"><Amount value={r.end} compact /></span>
              </span>
            </div>
            <div className="space-y-0.5" aria-hidden>
              <div className="h-1.5 rounded-full opacity-35" style={{ width: `${r.startShare * 100}%`, backgroundColor: BUCKET_COLORS[r.bucket] }} />
              <div className="h-2 rounded-full" style={{ width: `${r.endShare * 100}%`, backgroundColor: BUCKET_COLORS[r.bucket] }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ——— Titres ———
