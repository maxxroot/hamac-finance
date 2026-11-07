import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SettingKey } from "@hamac/api";
import { call } from "./transport";

export function useSystemInfo() {
  return useQuery({ queryKey: ["system.info"], queryFn: () => call("system.info") });
}

export function useSetting<T>(key: SettingKey, fallback: T) {
  const q = useQuery({ queryKey: ["settings", key], queryFn: () => call("settings.get", { key }) });
  return { ...q, value: (q.data ?? fallback) as T };
}

export function useSetSetting(key: SettingKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: unknown) => call("settings.set", { key, value }),
    onMutate: (value) => qc.setQueryData(["settings", key], value),
    onSettled: () => qc.invalidateQueries({ queryKey: ["settings", key] }),
  });
}
