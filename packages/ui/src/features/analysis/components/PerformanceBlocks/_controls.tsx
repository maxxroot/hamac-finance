import { formatEur } from "@hamac/core";
import { axisStyle, tooltipStyle } from "@/shared/components/Chart";
import { type ChartColors } from "@/shared/lib/colors";
import { cn } from "@/shared/lib/cn";
import { pctText } from "@/features/analysis/lib/performance";

/** Axes, infobulles et sélecteurs communs aux cartes de performance. */

export const tooltip = (c: ChartColors, valueFormatter: (v: unknown) => string) => ({ trigger: "axis", ...tooltipStyle(c), valueFormatter });

/** Graduations en % : une décimale seulement quand les variations sont faibles. */
export function percentAxis(c: ChartColors, values: readonly number[]) {
  const digits = Math.max(...values) - Math.min(...values) < 0.1 ? 1 : 0;
  return { type: "value", scale: true, ...axisStyle(c), axisLabel: { color: c.ink.faint, formatter: (v: number) => pctText(v, digits, false) } };
}

export const percentTooltip = (c: ChartColors) => tooltip(c, (v) => pctText(Number(v)));

export type CurveUnit = "pct" | "eur";

export const signedEur = (v: number) => `${v > 0.5 ? "+" : ""}${formatEur(v, { compact: true })}`;

export const eurAxisLabel = (v: number) => (Math.abs(v) >= 10_000 ? `${Math.round(v / 1000)} k€` : formatEur(v, { compact: true }));

/** Petit sélecteur à deux ou trois choix, dans l'en-tête d'une carte. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: ReadonlyArray<readonly [T, string]>; label: string }) {
  return (
    <span className="flex rounded-md bg-surface-2 p-0.5 text-xs" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)} className={cn("min-w-7 cursor-pointer rounded px-2 py-0.5", value === key ? "bg-surface-3 font-medium text-fg" : "text-fg-muted hover:text-fg")}>
          {text}
        </button>
      ))}
    </span>
  );
}

export const UNIT_OPTIONS = [
  ["pct", "%"],
  ["eur", "€"],
] as const;

export function UnitToggle({ value, onChange }: { value: CurveUnit; onChange: (u: CurveUnit) => void }) {
  return <Segmented value={value} onChange={onChange} options={UNIT_OPTIONS} label="Unité" />;
}
