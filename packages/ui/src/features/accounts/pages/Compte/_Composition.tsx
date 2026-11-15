import { Link } from "react-router";
import { BUCKET_LABELS, BUCKETS, type AccountState } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { Card, CardTitle } from "@/shared/components/ui";
import { BUCKET_COLORS } from "@/shared/lib/colors";
import { BUCKET_PAGES } from "@/shared/nav";

/** Répartition du compte par classe d'actifs, avec un lien vers la page de chaque classe. */
export function Composition({ s }: { s: AccountState }) {
  const rows = BUCKETS.map((b) => ({ bucket: b, value: s.byBucket[b] ?? 0 })).filter((r) => r.value > 0.005);
  const total = rows.reduce((t, r) => t + r.value, 0);
  // Un compte d'une seule classe (un livret, un PEA tout en actions) n'a rien à répartir.
  if (rows.length < 2 || total <= 0) return null;
  return (
    <Card className="mb-5">
      <CardTitle>Répartition par classe d'actifs</CardTitle>
      <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Répartition par classe d'actifs">
        {rows.map((r) => (
          <div key={r.bucket} style={{ width: `${(r.value / total) * 100}%`, background: BUCKET_COLORS[r.bucket] }} />
        ))}
      </div>
      <ul className="grid gap-x-8 gap-y-1.5 text-sm @xl:grid-cols-2 @4xl:grid-cols-3">
        {rows.map((r) => {
          const page = BUCKET_PAGES[r.bucket];
          const label = BUCKET_LABELS[r.bucket];
          return (
            <li key={r.bucket} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ background: BUCKET_COLORS[r.bucket] }} aria-hidden />
                {page ? (
                  <Link to={page} className="hover:text-accent hover:underline">
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </span>
              <span className="text-fg-muted">
                <Amount value={r.value} compact /> · <Pct value={r.value / total} />
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
