import { type Month } from "@hamac/core";
import { Select } from "@/shared/components/form";
import { cn } from "@/shared/lib/cn";
import { SHORTCUTS, type Range, type ShortcutKey } from "@/features/analysis/lib/historique";
import { formatMonth } from "@/shared/lib/numbers";

export function RangeControls({ months, range, active, onChange, onShortcut }: { months: readonly Month[]; range: Range; active: ShortcutKey | null; onChange: (r: Range) => void; onShortcut: (k: ShortcutKey) => void }) {
  const last = months.at(-1)!;
  const desc = [...months].reverse();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        Du
        <Select className="w-48" value={range.from ?? ""} onChange={(e) => onChange({ ...range, from: e.target.value || null })}>
          <option value="">Le tout début</option>
          {desc
            .filter((m) => m < range.to)
            .map((m) => (
              <option key={m} value={m}>
                Fin {formatMonth(m)}
              </option>
            ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-muted">
        Au
        <Select className="w-48" value={range.to} onChange={(e) => onChange({ from: range.from != null && range.from >= e.target.value ? null : range.from, to: e.target.value })}>
          {desc
            .filter((m) => range.from == null || m > range.from)
            .map((m) => (
              <option key={m} value={m}>
                {m === last ? "Aujourd'hui" : `Fin ${formatMonth(m)}`}
              </option>
            ))}
        </Select>
      </label>
      <span className="flex rounded-md bg-surface-2 p-0.5 text-xs" role="group" aria-label="Périodes toutes faites">
        {SHORTCUTS.map((s) => (
          <button key={s.key} type="button" aria-pressed={active === s.key} onClick={() => onShortcut(s.key)} className={cn("rounded px-2.5 py-1", active === s.key ? "bg-surface-3 font-medium text-fg" : "text-fg-muted hover:text-fg")}>
            {s.label}
          </button>
        ))}
      </span>
    </div>
  );
}
