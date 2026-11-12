import { useMemo, useState } from "react";
import { MILESTONE_CATEGORIES, MILESTONE_CATEGORY_LABELS, type Milestone, type MilestoneCategory } from "@hamac/core";
import { Button } from "@/shared/components/ui";
import { cn } from "@/shared/lib/cn";
import { byYear } from "@/features/analysis/lib/historique";
import { formatDate } from "@/shared/lib/numbers";
import { dot } from "./_format";

export function MilestoneList({ items, total, showAll, onToggleAll, onPick }: { items: readonly Milestone[]; total: number; showAll: boolean; onToggleAll: () => void; onPick: (m: Milestone) => void }) {
  const [hidden, setHidden] = useState<ReadonlySet<MilestoneCategory>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const counts = useMemo(() => {
    const c = new Map<MilestoneCategory, number>();
    for (const m of items) c.set(m.category, (c.get(m.category) ?? 0) + 1);
    return c;
  }, [items]);
  const visible = items.filter((m) => !hidden.has(m.category));
  const LIMIT = 10;
  const cut = expanded ? visible : [...visible].sort((a, b) => b.date.localeCompare(a.date)).slice(0, LIMIT);
  const toggle = (c: MilestoneCategory) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {MILESTONE_CATEGORIES.filter((c) => counts.has(c)).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={!hidden.has(c)}
            onClick={() => toggle(c)}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors", hidden.has(c) ? "border-line text-fg-faint" : "border-line-strong bg-surface-2 text-fg")}
          >
            <span className={cn("size-2 rounded-full", hidden.has(c) && "opacity-40")} style={dot(c)} aria-hidden />
            {MILESTONE_CATEGORY_LABELS[c]}
            <span className="text-fg-faint num">{counts.get(c)}</span>
          </button>
        ))}
        <button type="button" onClick={onToggleAll} className="ml-auto text-xs text-accent hover:underline">
          {showAll ? "Seulement celles de la période" : `Voir toutes les étapes (${total})`}
        </button>
      </div>
      {visible.length === 0 && <p className="py-6 text-center text-sm text-fg-muted">Aucune grande étape sur cette période.</p>}
      <div className="space-y-5">
        {byYear(cut).map((g) => (
          <section key={g.year}>
            <h3 className="mb-2 text-xs font-semibold text-fg-muted num">{g.year}</h3>
            <ol className="space-y-1 border-l border-line pl-4">
              {g.items.map((m) => (
                <li key={m.id} className="relative">
                  <span className="absolute top-3 -left-[1.3rem] size-2 rounded-full ring-2 ring-surface" style={dot(m.category)} aria-hidden />
                  <button type="button" onClick={() => onPick(m)} className="group -mx-2 flex w-full flex-wrap items-baseline gap-x-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2" title="Voir ce qui a changé depuis cette étape">
                    <span className="w-20 shrink-0 text-xs text-fg-faint num">{formatDate(m.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="text-sm text-fg">{m.title}</span>
                      {m.detail && <span className="block text-xs text-fg-muted">{m.detail}</span>}
                    </span>
                    <span className="text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Voir depuis</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {visible.length > LIMIT && (
        <Button variant="ghost" className="mt-3" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Afficher moins" : `Afficher les ${visible.length - LIMIT} autres`}
        </Button>
      )}
    </div>
  );
}

// ——— Résumé de la période ———
