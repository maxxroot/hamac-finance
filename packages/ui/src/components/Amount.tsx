import { formatEur } from "@hamac/core";
import { cn } from "@/lib/cn";

/** Montant formaté, masquable en mode discret, coloré si `signed`. */
export function Amount({
  value,
  signed = false,
  compact = false,
  className,
}: {
  value: number | null | undefined;
  signed?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) return <span className={cn("text-fg-faint", className)}>—</span>;
  const tone = signed ? (value > 0.004 ? "text-positive" : value < -0.004 ? "text-negative" : "") : "";
  const text = formatEur(value, { compact });
  return <span className={cn("amount num whitespace-nowrap", tone, className)}>{signed && value > 0.004 ? `+${text}` : text}</span>;
}
