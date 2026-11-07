import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./ui";

export function Stat({ label, children, sub, className, tone }: { label: string; children: ReactNode; sub?: ReactNode; className?: string; tone?: "warning" | "negative" }) {
  return (
    <Card className={cn("flex flex-col gap-1.5 p-4", tone === "warning" && "border-warning/40", tone === "negative" && "border-negative/40", className)}>
      <span className="text-xs text-fg-muted">{label}</span>
      <span className="text-xl font-semibold tracking-tight">{children}</span>
      {sub && <span className="text-xs text-fg-faint">{sub}</span>}
    </Card>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>;
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
        tone === "warning" && "border-warning/40 bg-warning/10 text-fg",
        tone === "ok" && "border-positive/30 bg-positive/10 text-fg",
        tone === "info" && "border-line bg-surface-2 text-fg-muted",
      )}
    >
      {children}
    </div>
  );
}
