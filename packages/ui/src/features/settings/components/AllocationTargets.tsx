import { Plus, Trash2 } from "lucide-react";
import { formatPct, targetRows, targetsTotal, type Bucket, type PlanParams, type TargetData, type TargetLine, type TargetRow } from "@hamac/core";
import { Checkbox, PercentInput, TextInput } from "@/shared/components/form";
import { Table, Td, Th, Tr } from "@/shared/components/table";
import { Button } from "@/shared/components/ui";
import { BUCKET_COLORS, CUSTOM_CLASS_COLORS } from "@/shared/lib/colors";
import { cn } from "@/shared/lib/cn";

/** Ma répartition cible : une ligne par classe détenue, chacune dans ou hors de l'allocation. */
export function AllocationTargets({ params, data, onChange, labelErrors, returnHints }: { params: PlanParams; data: TargetData; onChange: (p: PlanParams) => void; labelErrors: Map<string, string>; returnHints?: Partial<Record<string, string>> }) {
  const rows = targetRows(params, data);
  const total = targetsTotal(rows);
  const line = (key: string) => params.targets.find((l) => l.key === key)!;
  const patch = (key: string, change: Partial<TargetLine>) => onChange({ ...params, targets: params.targets.map((l) => (l.key === key ? { ...l, ...change } : l)) });
  const renameClass = (key: string, change: { label?: string; color?: string }) => onChange({ ...params, customClasses: params.customClasses.map((c) => (c.id === key ? { ...c, ...change } : c)) });
  const add = () => {
    const id = crypto.randomUUID();
    onChange({ ...params, customClasses: [...params.customClasses, { id, label: "", color: CUSTOM_CLASS_COLORS[params.customClasses.length % CUSTOM_CLASS_COLORS.length]! }], targets: [...params.targets, { key: id, inAllocation: true, target: 0, expectedReturn: null }] });
  };
  const remove = (key: string) => onChange({ ...params, customClasses: params.customClasses.filter((c) => c.id !== key), targets: params.targets.filter((l) => l.key !== key) });
  const setReturn = (r: TargetRow, v: number | null) => {
    if (r.returnField) onChange({ ...params, returns: { ...params.returns, [r.returnField]: v ?? 0 } });
    else patch(r.key, { expectedReturn: v });
  };
  const remaining = 1 - total;
  const balanced = Math.abs(remaining) < 0.0005;

  return (
    <div className="space-y-3">
      <Table>
        <thead>
          <tr>
            <Th>Classe</Th>
            <Th>Allocation</Th>
            <Th align="right">Cible</Th>
            <Th align="right">Rendement attendu</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.key}>
              <Td className="align-top">
                <div className="flex items-center gap-2.5">
                  {r.custom ? (
                    <input type="color" aria-label={`Couleur de ${r.label || "la classe"}`} value={r.color ?? "#888888"} onChange={(e) => renameClass(r.key, { color: e.target.value })} className="size-7 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0.5" />
                  ) : (
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: BUCKET_COLORS[r.key as Bucket] }} />
                  )}
                  {r.custom ? <TextInput aria-label="Nom de la classe" value={r.label} onChange={(e) => renameClass(r.key, { label: e.target.value })} placeholder="Métaux précieux" className="h-8 w-48" /> : <span>{r.label}</span>}
                </div>
                {labelErrors.get(r.key) && <p className="mt-1 text-xs text-negative">{labelErrors.get(r.key)}</p>}
                {r.included > 0 && <p className="mt-1 text-xs text-fg-faint">{r.included} élément{r.included > 1 ? "s" : ""} inclus individuellement</p>}
              </Td>
              <Td className="align-top">
                <Checkbox checked={r.inAllocation} onChange={(v) => patch(r.key, { inAllocation: v })} label="Inclus" />
              </Td>
              <Td align="right" className="align-top">
                <div className={cn("ml-auto w-28", !r.active && "opacity-40")}>
                  <PercentInput aria-label={`Cible de ${r.label || "la classe"}`} disabled={!r.active} value={r.target} onChange={(v) => patch(r.key, { target: v ?? 0 })} />
                </div>
              </Td>
              <Td align="right" className="align-top">
                <div className="ml-auto w-28">
                  <PercentInput aria-label={`Rendement attendu de ${r.label || "la classe"}`} value={r.returnField ? params.returns[r.returnField] : line(r.key).expectedReturn} onChange={(v) => setReturn(r, v)} placeholder="Facultatif" />
                </div>
                {returnHints?.[r.key] && <p className="mt-1 text-right text-xs text-fg-faint">{returnHints[r.key]}</p>}
              </Td>
              <Td className="w-12 align-top">
                {r.custom && (
                  <Button variant="ghost" className="h-8 w-8 p-0" aria-label={`Supprimer ${r.label || "la classe"}`} onClick={() => remove(r.key)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn("text-sm", balanced ? "text-fg-muted" : "text-warning")}>
          Total : <b className={balanced ? "text-fg" : undefined}>{formatPct(total)}</b>
          {!balanced && (remaining > 0 ? ` · reste ${formatPct(remaining)} à répartir` : ` · ${formatPct(-remaining)} en trop`)}
        </p>
        <Button onClick={add}>
          <Plus size={14} /> Ajouter une classe
        </Button>
      </div>
    </div>
  );
}
