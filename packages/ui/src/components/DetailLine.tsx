import type { ReactNode } from "react";

/** Une ligne « libellé … valeur » dans une carte de détail. */
export function DetailLine({ label, strong, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 text-sm ${strong ? "font-medium" : ""}`}>
      <span className={strong ? "" : "text-fg-muted"}>{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
