import { useQuery } from "@tanstack/react-query";
import type { AssetKind } from "@hamac/core";
import { cn } from "@/shared/lib/cn";
import { EXPOSURE_KEY, lookupMessage, lookupPending } from "@/features/entry/lib/exposure";
import { call } from "@/shared/lib/transport";

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
/** La réponse arrive en tâche de fond : nouvelle lecture toutes les 3 secondes, au plus une minute. */
const POLL_MS = 3_000;
const POLL_MAX = 20;

/**
 * Ce que Hamac sait de la composition d'un ETF dès qu'on le choisit : déjà connue, reprise d'un équivalent,
 * ETF synthétique ou émetteur non géré. Demander l'état lance aussi le téléchargement, avant même l'enregistrement.
 */
export function CompositionNotice({ kind, isin }: Readonly<{ kind: AssetKind; isin: string | null | undefined }>) {
  const code = isin?.trim().toUpperCase() ?? "";
  const enabled = kind === "etf" && ISIN_RE.test(code);
  const q = useQuery({
    queryKey: [EXPOSURE_KEY, "lookup", code],
    queryFn: () => call("exposure.lookup", { isin: code }),
    enabled,
    refetchInterval: (query) => (query.state.data && lookupPending(query.state.data) && query.state.dataUpdateCount < POLL_MAX ? POLL_MS : false),
  });
  if (!enabled || !q.data) return null;
  const m = lookupMessage(q.data);
  return (
    <p className={cn("rounded-lg px-3 py-2 text-xs", m.tone === "warning" ? "bg-warning/10 text-warning" : m.tone === "ok" ? "bg-surface-2 text-fg-muted" : "bg-surface-2 text-fg-faint")} role="status">
      {m.text}
    </p>
  );
}
