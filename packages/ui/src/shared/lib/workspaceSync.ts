import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Workspace } from "@hamac/api";
import { call } from "./transport";
import { WORKSPACE_KEY } from "./workspace";

/**
 * Recharge l'espace de travail quand les données ont changé ailleurs (assistant MCP, autre onglet) :
 * la version des données est relue quand l'onglet redevient visible, puis à intervalle régulier tant qu'il l'est.
 * Les écritures faites dans cet onglet rechargent déjà l'espace de travail (`useMutate`).
 */

export const SYNC_INTERVAL_MS = 20_000;

/** Recharger seulement si une version est connue, qu'elle a changé et que rien n'est déjà en cours. */
export function shouldReload(known: string | undefined, current: string, busy: boolean): boolean {
  return !busy && !!known && known !== current;
}

export function useWorkspaceSync(intervalMs = SYNC_INTERVAL_MS): void {
  const qc = useQueryClient();
  useEffect(() => {
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const { revision } = await call("workspace.revision");
        const known = qc.getQueryData<Workspace>(WORKSPACE_KEY)?.revision;
        const busy = qc.isFetching({ queryKey: WORKSPACE_KEY }) > 0 || qc.isMutating() > 0;
        if (shouldReload(known, revision, busy)) await qc.invalidateQueries({ queryKey: WORKSPACE_KEY });
      } catch {
        // Serveur injoignable ou session expirée : les autres appels le signalent déjà.
      } finally {
        checking = false;
      }
    };
    const onVisible = () => void check();
    const timer = window.setInterval(onVisible, intervalMs);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [qc, intervalMs]);
}
