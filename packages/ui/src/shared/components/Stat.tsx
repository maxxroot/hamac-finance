import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { HamacCurve } from "./Brand";
import { Card } from "./ui";

/**
 * Chiffre clé. `hero` : le chiffre principal de la page, en serif, avec la signature du thème
 * (courbe du hamac le jour, guilloché la nuit).
 */
export function Stat({ label, children, sub, className, tone, hero = false }: { label: string; children: ReactNode; sub?: ReactNode; className?: string; tone?: "warning" | "negative"; hero?: boolean }) {
  return (
    <Card className={cn("flex flex-col gap-1.5 p-4", hero && "guilloche p-5", tone === "warning" && "border-warning/45", tone === "negative" && "border-negative/45", className)}>
      <span className="text-[0.8125rem] font-medium text-fg-muted">{label}</span>
      <span className={cn("num", hero ? "font-display text-[2.6rem] leading-[1.05] font-medium tracking-[-0.015em]" : "text-xl font-semibold tracking-tight")}>{children}</span>
      {hero && <HamacCurve className="my-0.5" />}
      {sub && <span className="text-xs text-fg-faint">{sub}</span>}
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
