import { Field, MoneyInput, NumberInput, PercentInput } from "@/shared/components/form";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PlanParams, formatPct, targetRows, targetsTotal } from "@hamac/core";
import { Button } from "@/shared/components/ui";
import { cn } from "@/shared/lib/cn";
import { issueTabs, rebaseDraft } from "@/features/settings/lib/planDraft";
import { useMutate, useWorkspaceIndex } from "@/shared/lib/workspace";

/** Brouillon des paramètres du plan, partagé par les onglets Plan et Répartition, et sa barre d'enregistrement. */

export type Path = [keyof PlanParams, string];

/** Brouillon commun aux onglets Plan et Répartition : il survit au changement d'onglet. */
export function usePlanDraft() {
  const idx = useWorkspaceIndex();
  const save = useMutate("params.update", { success: "Paramètres enregistrés" });
  const [p, setP] = useState<PlanParams | null>(null);
  const server = idx?.ws.params ?? null;
  const base = useRef<PlanParams | null>(null);
  useEffect(() => {
    if (!server) return;
    const previous = base.current;
    base.current = server;
    setP((draft) => (draft && previous ? rebaseDraft(draft, previous, server) : server));
  }, [server]);

  const issues = useMemo(() => {
    if (!p) return new Map<string, string>();
    const r = PlanParams.safeParse(p);
    const found = new Map(r.success ? [] : r.error.issues.map((i) => [i.path.join("."), i.message]));
    if (idx) {
      const total = targetsTotal(targetRows(p, idx.ws));
      if (Math.abs(total - 1) >= 0.0005) found.set("targets.total", `La répartition doit faire 100 % (${formatPct(total)} actuellement).`);
    }
    return found;
  }, [p, idx]);

  const dirty = !!p && !!server && JSON.stringify(p) !== JSON.stringify(server);
  return { p, setP, idx, issues, dirty, saving: save.isPending, cancel: () => setP(server), submit: () => p && save.mutate(p, { onSuccess: (saved) => setP(saved as PlanParams) }) };
}

export type PlanDraft = ReturnType<typeof usePlanDraft>;

export function planFields(p: PlanParams, setP: PlanDraft["setP"], issues: PlanDraft["issues"]) {
  const set = (path: Path, value: unknown) => setP((x) => (x ? { ...x, [path[0]]: { ...(x[path[0]] as object), [path[1]]: value } } : x));
  const err = (path: Path) => issues.get(path.join(".")) ?? null;

  const pctField = (label: string, path: Path, help?: ReactNode) => (
    <Field label={label} help={help} error={err(path)}>
      {(id) => <PercentInput id={id} value={(p[path[0]] as Record<string, number>)[path[1]]} onChange={(v) => set(path, v ?? 0)} />}
    </Field>
  );
  const eurField = (label: string, path: Path, help?: ReactNode) => (
    <Field label={label} help={help} error={err(path)}>
      {(id) => <MoneyInput id={id} value={(p[path[0]] as Record<string, number>)[path[1]]} onChange={(v) => set(path, v ?? 0)} />}
    </Field>
  );
  const intField = (label: string, path: Path, help?: ReactNode) => (
    <Field label={label} help={help} error={err(path)}>
      {(id) => <NumberInput id={id} decimals={0} grouping={false} value={(p[path[0]] as Record<string, number>)[path[1]]} onChange={(v) => set(path, v == null ? 0 : Math.round(v))} />}
    </Field>
  );

  return { set, err, pctField, eurField, intField };
}

export function SaveBar({ draft }: { draft: PlanDraft }) {
  const { dirty, issues, saving, cancel, submit } = draft;
  return (
    <div
      className={cn(
        "fixed right-8 bottom-6 z-40 flex items-center gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3 shadow-float transition-all",
        dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <span className="text-sm text-fg-muted">{issues.size ? `${issues.size} point(s) à corriger (${issueTabs(issues.keys()).join(", ")})` : "Modifications non enregistrées"}</span>
      <Button variant="ghost" onClick={cancel}>
        Annuler
      </Button>
      <Button variant="primary" disabled={issues.size > 0 || saving} onClick={submit}>
        Enregistrer
      </Button>
    </div>
  );
}
