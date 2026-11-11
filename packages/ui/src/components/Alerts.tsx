import { AlertTriangle, ArrowRight, CheckCircle2, Info, OctagonX } from "lucide-react";
import { Link } from "react-router";
import type { Alert, AlertLevel } from "@hamac/core";
import { cn } from "@/lib/cn";

/** Statuts réservés : icône + libellé + couleur, jamais la couleur seule. */
const LEVEL: Record<AlertLevel, { icon: typeof Info; label: string; className: string }> = {
  critique: { icon: OctagonX, label: "Critique", className: "text-negative" },
  attention: { icon: AlertTriangle, label: "À faire", className: "text-warning" },
  info: { icon: Info, label: "Info", className: "text-fg-muted" },
  ok: { icon: CheckCircle2, label: "OK", className: "text-positive" },
};

export function AlertList({ alerts, compact = false }: { alerts: Alert[]; compact?: boolean }) {
  if (!alerts.length) return <p className="text-sm text-fg-muted">Aucune alerte.</p>;
  return (
    <ul className="divide-y divide-line/60">
      {alerts.map((a) => {
        const L = LEVEL[a.level];
        const Icon = L.icon;
        const body = (
          <div className="flex items-start gap-3 py-2.5">
            <Icon size={17} className={cn("mt-0.5 shrink-0", L.className)} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-sm">
                <span className={cn("mr-2 text-xs font-semibold", L.className)}>{L.label}</span>
                {a.title}
              </div>
              {a.detail && !compact && <div className="mt-0.5 text-xs text-fg-faint">{a.detail}</div>}
            </div>
            {a.link && <ArrowRight size={14} className="mt-1 shrink-0 text-fg-faint" aria-hidden />}
          </div>
        );
        return <li key={a.id}>{a.link ? <Link to={a.link} className="-mx-2 block rounded-lg px-2 hover:bg-surface-2">{body}</Link> : body}</li>;
      })}
    </ul>
  );
}
