import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { HamacCurve } from "./Brand";
import { Card } from "./ui";

/**
 * Chiffre clé. `hero` : le chiffre principal de la page, en serif, avec la signature du thème
 * (courbe du hamac le jour, guilloché la nuit). `detail` : explication affichée au survol ou au focus de la tuile.
 */
export function Stat({
  label,
  children,
  sub,
  className,
  tone,
  hero = false,
  detail,
}: {
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  className?: string;
  tone?: "warning" | "negative";
  hero?: boolean;
  detail?: ReactNode;
}) {
  const hasDetail = detail != null && detail !== false && detail !== "";
  return (
    <Card
      tabIndex={hasDetail ? 0 : undefined}
      className={cn("flex flex-col gap-1.5 p-4", hasDetail && "group relative outline-none focus-visible:ring-2 focus-visible:ring-accent/50", hero && "guilloche p-5", tone === "warning" && "border-warning/45", tone === "negative" && "border-negative/45", className)}
    >
      <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-fg-muted">
        {label}
        {hasDetail && <Info size={12} className="text-fg-faint" aria-hidden />}
      </span>
      <span className={cn("num", hero ? "font-display text-[2.6rem] leading-[1.05] font-medium tracking-[-0.015em]" : "text-xl font-semibold tracking-tight")}>{children}</span>
      {hero && <HamacCurve className="my-0.5" />}
      {sub && <span className="text-xs text-fg-faint">{sub}</span>}
      {hasDetail && (
        <div role="tooltip" className="invisible absolute top-full left-0 z-30 mt-2 w-80 max-w-[90vw] rounded-lg border border-line bg-surface-2 p-3 text-xs text-fg-muted opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100">
          {detail}
        </div>
      )}
    </Card>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-6 grid grid-cols-2 gap-4 @3xl:grid-cols-4">{children}</div>;
}

export function Pct({ value, signed = false, digits = 1 }: { value: number | null | undefined; signed?: boolean; digits?: number }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-fg-faint">—</span>;
  const text = `${(value * 100).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
  const tone = signed ? (value > 0.0005 ? "text-positive" : value < -0.0005 ? "text-negative" : "") : "";
  return <span className={cn("num whitespace-nowrap", tone)}>{signed && value > 0.0005 ? `+${text}` : text}</span>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "ok"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "warning" && "border-warning/40 bg-warning/8 text-fg",
        tone === "ok" && "border-positive/30 bg-positive/8 text-fg",
        tone === "info" && "border-line bg-surface-2 text-fg-muted",
      )}
    >
      {children}
    </div>
  );
}
