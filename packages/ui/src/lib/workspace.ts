import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ProcInput, ProcName, Workspace } from "@hamac/api";
import type { Account, Asset } from "@hamac/core";
import { call } from "./transport";
import { useToast } from "./toast";

export const WORKSPACE_KEY = ["workspace"] as const;

export function useWorkspace() {
  return useQuery({ queryKey: WORKSPACE_KEY, queryFn: () => call("workspace.load") });
}

export interface WorkspaceIndex {
  ws: Workspace;
  accountById: Map<string, Account>;
  assetById: Map<string, Asset>;
  activeAccounts: Account[];
  activeAssets: Asset[];
}

/** Espace de travail + index pratiques. `null` tant que le chargement n'est pas fini. */
export function useWorkspaceIndex(): WorkspaceIndex | null {
  const { data } = useWorkspace();
  return useMemo(() => {
    if (!data) return null;
    return {
      ws: data,
      accountById: new Map(data.accounts.map((a) => [a.id, a])),
      assetById: new Map(data.assets.map((a) => [a.id, a])),
      activeAccounts: data.accounts.filter((a) => !a.archived),
      activeAssets: data.assets.filter((a) => !a.archived),
    };
  }, [data]);
}

/**
 * Mutation générique : appelle la procédure, recharge l'espace de travail,
 * affiche une notification (succès optionnel, erreur toujours).
 */
export function useMutate<N extends ProcName>(name: N, opts: { success?: string } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: ProcInput<N>) => (call as (n: N, i: ProcInput<N>) => Promise<unknown>)(name, input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: WORKSPACE_KEY });
      if (opts.success) toast("success", opts.success);
    },
    onError: (err: Error) => toast("error", err.message),
  });
}
