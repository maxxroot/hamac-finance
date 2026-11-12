import { useMemo } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { yearEndChecklist, type YearEndKey } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Checkbox } from "@/shared/components/form";
import { Badge } from "@/shared/components/ui";
import { cn } from "@/shared/lib/cn";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useSetSetting, useSetting } from "@/shared/lib/queries";

/** Gestes fiscaux à faire avant le 31 décembre, repliés en une ligne en bas de la page Impôts ; une case par geste, gardée année par année. */
export function YearEndCard() {
  const pf = usePortfolio();
  const items = useMemo(() => (pf ? yearEndChecklist(pf.data, pf.state) : []), [pf]);
  const done = useSetting<Record<string, YearEndKey[]>>("taxes.yearEnd", {});
  const setDone = useSetSetting("taxes.yearEnd");
  if (!pf) return null;
  const year = pf.today.slice(0, 4);
  const checked = new Set(done.value[year] ?? []);
  const toggle = (key: YearEndKey, on: boolean) => {
    const next = new Set(checked);
    if (on) next.add(key);
    else next.delete(key);
    setDone.mutate({ ...done.value, [year]: [...next] });
  };
  const open = items.filter((i) => !checked.has(i.key));
  const total = open.reduce((s, i) => s + (i.saving ?? 0), 0);

  return (
    <details className="group mb-6 rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 [&::-webkit-details-marker]:hidden">
        <ChevronRight size={16} className="shrink-0 text-accent transition-transform group-open:rotate-90" aria-hidden />
        <span className="font-medium">Liste de fin d'année {year}</span>
        <span className="text-sm text-fg-muted">
          {open.length} geste{open.length > 1 ? "s" : ""} à faire avant le 31 décembre
          {total > 0 && (
            <>
              {" "}
              · jusqu'à <Amount value={total} compact /> d'impôt en moins ou évité
            </>
          )}
        </span>
      </summary>
      <div className="px-4 pb-4">
      <p className="mb-4 text-sm text-fg-muted">Ce qui ne se fait que jusqu'au 31 décembre, chiffré avec vos données et les taux de Paramètres › Plan. Cochez ce qui est fait : la liste repart à zéro chaque année.</p>
      <ul className="space-y-4">
        {items.map((item) => {
          const isDone = checked.has(item.key);
          return (
            <li key={item.key} className={cn("rounded-xl border border-line p-3", isDone && "opacity-60")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Checkbox checked={isDone} onChange={(v) => toggle(item.key, v)} label={<span className="font-medium">{item.title}</span>} />
                {item.saving != null && item.saving > 0 && (
                  <Badge tone="positive">
                    ≈ <Amount value={item.saving} compact /> d'impôt
                  </Badge>
                )}
              </div>
              <p className="mt-1.5 text-sm text-fg-muted">{item.detail}</p>
              {item.lines.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-sm">
                  {item.lines.map((l) => (
                    <li key={l.label} className="flex flex-wrap justify-between gap-2">
                      <span>{l.label}</span>
                      <span>
                        {l.amount != null && <Amount value={l.amount} />}
                        {l.hint && <span className="ml-2 text-xs text-fg-faint">{l.hint}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to={item.link} className="mt-2 inline-block text-xs underline hover:text-accent">
                Voir le détail
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-fg-faint">Estimations sans valeur officielle, à adapter à votre situation.</p>
      </div>
    </details>
  );
}
