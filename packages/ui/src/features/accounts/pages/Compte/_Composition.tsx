import { Link } from "react-router";
import type { AccountState } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { Card, CardTitle } from "@/shared/components/ui";
import { accountClasses } from "@/features/accounts/lib/holdingClass";

/** Répartition du compte par classe (ETF, actions et fonds séparés), avec un lien vers la page de chaque classe. */
export function Composition({ s }: { s: AccountState }) {
  const rows = accountClasses(s);
  const total = rows.reduce((t, r) => t + r.value, 0);
  // Un compte d'une seule classe (un livret, un PEA tout en ETF) n'a rien à répartir.
  if (rows.length < 2 || total <= 0) return null;
  return (
    <Card className="mb-5">
      <CardTitle>Répartition par classe d'actifs</CardTitle>
      <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Répartition par classe d'actifs">
        {rows.map((r) => (
          <div key={r.key} style={{ width: `${(r.value / total) * 100}%`, background: r.color }} />
        ))}
      </div>
      <ul className="grid gap-x-8 gap-y-1.5 text-sm @xl:grid-cols-2 @4xl:grid-cols-3">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ background: r.color }} aria-hidden />
              {r.page ? (
                <Link to={r.page} className="hover:text-accent hover:underline">
                  {r.label}
                </Link>
              ) : (
                r.label
              )}
            </span>
            <span className="text-fg-muted">
              <Amount value={r.value} compact /> · <Pct value={r.value / total} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
