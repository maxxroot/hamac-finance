import { formatEur, formatMoney } from "@hamac/core";
import { cn } from "@/shared/lib/cn";

/** Montant formaté, masquable en mode discret, coloré si `signed`. */
export function Amount({
  value,
  signed = false,
  compact = false,
  currency,
  className,
}: {
  value: number | null | undefined;
  signed?: boolean;
  compact?: boolean;
  /** Devise du montant (ISO 4217) ; l'euro par défaut. */
  currency?: string;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) return <span className={cn("text-fg-faint", className)}>—</span>;
  const tone = signed ? (value > 0.004 ? "text-positive" : value < -0.004 ? "text-negative" : "") : "";
  const text = currency && currency !== "EUR" ? formatMoney(value, currency, { compact }) : formatEur(value, { compact });
  return <span className={cn("amount num whitespace-nowrap", tone, className)}>{signed && value > 0.004 ? `+${text}` : text}</span>;
}
