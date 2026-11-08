import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/cn";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

function ago(iso: string, now: number): string {
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

/** État de l'actualisation des cours + bouton pour la relancer. */
export function PriceStatus() {
  const idx = useWorkspaceIndex();
  const refresh = useMutate("prices.refresh");
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const status = idx?.ws.priceStatus;
  const errors = status?.errors ?? [];
  return (
    <div className="relative">
      <button
        onClick={() => (errors.length && !refresh.isPending ? setOpen((v) => !v) : refresh.mutate(undefined as never))}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
        title="Actualiser les cours"
      >
        {errors.length > 0 ? <AlertTriangle size={15} className="text-warning" /> : <RefreshCw size={15} className={cn(refresh.isPending && "animate-spin")} />}
        {refresh.isPending ? "Actualisation…" : status ? `Cours ${ago(status.at, now)}` : "Actualiser les cours"}
      </button>
      {open && errors.length > 0 && (
        <div className="absolute top-full right-0 z-40 mt-2 w-[420px] rounded-xl border border-line-strong bg-surface-2 p-4 text-sm shadow-2xl">
          <div className="mb-2 font-medium">Cours non actualisés</div>
          <ul className="mb-3 space-y-1.5 text-xs text-fg-muted">
            {errors.map((e) => (
              <li key={e.assetId}>
                <span className="text-fg">{e.name}</span> : {e.message}
              </li>
            ))}
          </ul>
          <div className="flex gap-4">
            <button
              className="text-accent hover:underline"
              onClick={() => {
                setOpen(false);
                refresh.mutate(undefined as never);
              }}
            >
              Réessayer
            </button>
            <Link to="/parametres?onglet=Cours" className="text-accent hover:underline" onClick={() => setOpen(false)}>
              Voir les sources
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
