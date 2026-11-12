import { Link } from "react-router";
import { Amount } from "@/shared/components/Amount";
import { Select } from "@/shared/components/form";
import { Card, CardTitle } from "@/shared/components/ui";
import { cn } from "@/shared/lib/cn";
import { barSpan, type Waterfall } from "@/features/analysis/lib/historique";

export const MONEY_HEADING = "Argent apporté ou retiré";

export const GAIN_HEADING = "Gain des placements";

export function CascadeCard({ w, scope, scopes, onScope, journalHref, operations }: { w: Waterfall; scope: string; scopes: ReadonlyArray<{ key: string; label: string }>; onScope: (k: string) => void; journalHref: string; operations: number }) {
  let previous: string | null = null;
  return (
    <Card className="flex flex-col xl:self-start">
      <CardTitle
        hint={
          <Select aria-label="Périmètre de la cascade" className="h-8 w-56 text-xs" value={scope} onChange={(e) => onScope(e.target.value)}>
            {scopes.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        }
      >
        Ce qui s'est passé
      </CardTitle>
      <ul className="space-y-2.5">
        {w.rows.map((r) => {
          const heading = r.kind !== "total" && r.kind !== previous ? r.kind : null;
          previous = r.kind;
          const { left, width } = barSpan(r, w);
          const tone = r.kind === "total" ? "bg-fg-faint/45" : r.kind === "money" ? "bg-precaution" : r.value >= 0 ? "bg-positive" : "bg-negative";
          return (
            <li key={r.key} className="text-sm">
              {heading && (
                <div className="mt-4 mb-2 flex items-baseline justify-between border-t border-line pt-3 text-xs font-semibold text-fg-muted">
                  <span>{heading === "money" ? MONEY_HEADING : GAIN_HEADING}</span>
                  <Amount value={heading === "money" ? w.money : w.gain} signed compact />
                </div>
              )}
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className={r.kind === "total" ? "font-medium text-fg" : "text-fg-muted"}>{r.label}</span>
                {r.kind === "total" ? <Amount value={r.value} compact className="font-medium" /> : <Amount value={r.value} signed compact />}
              </div>
              <div className="relative h-2 rounded-full bg-surface-3" aria-hidden>
                <div className={cn("absolute top-0 h-2 rounded-full", tone)} style={{ left: `${left}%`, width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="pt-4 text-xs text-fg-faint">
        {w.zoomed && <p className="mb-1">Échelle resserrée : les barres de départ et d'arrivée ne partent pas de zéro, pour que les écarts restent visibles.</p>}
        <Link to={journalHref} className="text-accent hover:underline">
          Voir {operations > 1 ? `les ${operations} opérations` : operations === 1 ? "l'opération" : "le journal"} de la période
        </Link>
      </div>
    </Card>
  );
}

// ——— Par compte ———
