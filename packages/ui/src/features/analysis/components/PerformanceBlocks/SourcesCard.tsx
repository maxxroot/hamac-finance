import { useState } from "react";
import { type ClassBreakdown, type GainSources } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { Card, CardTitle } from "@/shared/components/ui";
import { BUCKET_COLORS } from "@/shared/lib/colors";
import { cn } from "@/shared/lib/cn";
import { Segmented } from "./_controls";

export type SourceLine = { key: string; label: string; value: number; rate?: number | null; color?: string };

/** Barres sur une seule échelle : l'axe se place selon la part des montants négatifs. */
export function GainBars({ lines }: { lines: readonly SourceLine[] }) {
  const maxPos = Math.max(0, ...lines.map((l) => l.value));
  const maxNeg = Math.max(0, ...lines.map((l) => -l.value));
  const range = maxPos + maxNeg || 1;
  const origin = (maxNeg / range) * 100;
  return (
    <ul className="space-y-3">
      {lines.map((l) => {
        const width = (Math.abs(l.value) / range) * 100;
        return (
          <li key={l.key} className="text-sm">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-fg-muted">
                {l.color && <span className="size-2.5 shrink-0 rounded-sm" style={{ background: l.color }} aria-hidden />}
                <span className="truncate">{l.label}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-3">
                <Amount value={l.value} signed compact />
                {l.rate !== undefined && <span className="w-14 text-right text-xs">{l.rate == null ? <span className="text-fg-faint">—</span> : <Pct value={l.rate} signed />}</span>}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-surface-3" aria-hidden>
              <div className={cn("absolute top-0 h-2", l.value >= 0 ? "rounded-r bg-positive" : "rounded-l bg-negative")} style={{ left: `${l.value >= 0 ? origin : origin - width}%`, width: `${width}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type SourcesView = "classe" | "nature";

export const SOURCES_OPTIONS = [
  ["classe", "Par classe"],
  ["nature", "Par nature"],
] as const;

/**
 * D'où vient le gain de la période. Par classe : obligations, actions, crowdlending…, avec le rendement de chacune
 * hors versements. Par nature : plus-values, dividendes, intérêts, frais. Les deux redonnent le gain de la période.
 */
export function SourcesCard({ sources: s, byClass }: { sources: GainSources; byClass: ClassBreakdown }) {
  const [view, setView] = useState<SourcesView>("classe");
  const byNature: SourceLine[] = [
    { key: "unrealized", label: "Plus-values pas encore encaissées", value: s.unrealized },
    { key: "realized", label: "Plus-values encaissées", value: s.realized },
    { key: "dividends", label: "Dividendes", value: s.dividends },
    { key: "interests", label: "Intérêts", value: s.interests },
    { key: "billed", label: "Frais facturés à part", value: -s.billedFees },
    { key: "taxes", label: "Impôts prélevés", value: -s.taxes },
    { key: "other", label: "Corrections et autres", value: s.other },
  ];
  const classLines: SourceLine[] = [
    ...byClass.rows.map((r) => ({ key: r.bucket, label: r.label, value: r.gain, rate: r.rate, color: BUCKET_COLORS[r.bucket] })),
    { key: "charges", label: "Frais facturés à part et impôts", value: byClass.charges },
  ];
  const lines = (view === "classe" ? classLines : byNature).filter((l) => Math.abs(l.value) >= 0.005 || (view === "classe" && l.key !== "charges"));
  return (
    <Card>
      <CardTitle hint={<Segmented value={view} onChange={setView} options={SOURCES_OPTIONS} label="Répartir le gain" />}>D'où vient le gain</CardTitle>
      {view === "classe" && byClass.rows.length > 0 && (
        <p className="-mt-2 mb-3 flex justify-end gap-3 text-xs text-fg-faint">
          <span>gain</span>
          <span className="w-14 text-right">rendement</span>
        </p>
      )}
      {lines.length === 0 ? <p className="py-16 text-center text-sm text-fg-muted">Rien sur cette période.</p> : <GainBars lines={lines} />}
      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3 text-sm font-medium">
        <span>Gain de la période</span>
        <Amount value={s.total} signed compact />
      </div>
      {view === "classe" ? (
        <p className="mt-2 text-xs text-fg-faint">Rendement de chaque classe sur la période, sans l'effet de l'argent ajouté. Les espèces d'un compte comptent dans sa classe, comme dans la répartition.</p>
      ) : (
        s.embeddedFees > 0.005 && (
          <p className="mt-2 text-xs text-fg-faint">
            Les frais compris dans les achats et les ventes (<Amount value={s.embeddedFees} compact />) pèsent déjà sur les plus-values.
          </p>
        )
      )}
    </Card>
  );
}
