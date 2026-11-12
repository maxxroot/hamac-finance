import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { goalProgress, overAllocatedAccounts, type Goal, type GoalProgress } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { RowActions } from "@/shared/components/RowActions";
import { Notice, Pct } from "@/shared/components/Stat";
import { Badge, Button, Card, PageHeader } from "@/shared/components/ui";
import { GoalDialog } from "@/features/planning/dialogs/GoalDialog";
import { cn } from "@/shared/lib/cn";
import { formatDate } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useMutate } from "@/shared/lib/workspace";

export const GOAL_STATUS: Record<GoalProgress["status"], { label: string; tone: "positive" | "negative" | "accent" | "neutral" }> = {
  atteint: { label: "Atteint", tone: "positive" },
  en_avance: { label: "En avance", tone: "accent" },
  en_retard: { label: "En retard", tone: "negative" },
  echu: { label: "Date passée", tone: "neutral" },
};

/** Projets à financer : somme réunie, avancement et versement mensuel nécessaire. */
export function Projets() {
  const pf = usePortfolio();
  const del = useMutate("goals.delete", { success: "Projet supprimé" });
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const goals = pf?.idx.ws.goals ?? [];
  const progress = useMemo(() => (pf ? goals.map((g) => goalProgress(g, pf.state)) : []), [pf, goals]);
  if (!pf) return null;
  const open = progress.filter((p) => !p.goal.archived);
  const done = progress.filter((p) => p.goal.archived);
  const over = overAllocatedAccounts(goals, pf.state);
  const monthly = open.reduce((s, p) => s + p.monthlyNeeded, 0);

  return (
    <>
      <PageHeader
        title="Projets"
        description="Ce que vous préparez : un achat, des études, des travaux. Chaque projet a sa somme, sa date et les comptes où vous mettez l'argent de côté."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Nouveau projet
          </Button>
        }
      />
      {over.length > 0 && (
        <div className="mb-5">
          <Notice tone="warning">
            {over.map((o) => o.name).join(", ")} : plus d'argent affecté aux projets que le compte n'en contient. Revoyez les parts ou les montants réservés.
          </Notice>
        </div>
      )}
      {open.length > 0 && (
        <p className="mb-4 text-sm text-fg-muted">
          {open.length} projet{open.length > 1 ? "s" : ""} en cours · à mettre de côté chaque mois : <b className="text-fg">{<Amount value={monthly} />}</b>
        </p>
      )}
      {progress.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-fg-muted">Aucun projet. Ajoutez ce que vous voulez financer, avec sa somme et sa date.</p>
        </Card>
      ) : (
        <div className="grid gap-4 @3xl:grid-cols-2">
          {open.map((p) => (
            <GoalCard key={p.goal.id} p={p} onEdit={() => setEditing(p.goal)} onDelete={() => confirm(`Supprimer le projet « ${p.goal.name} » ?`) && del.mutate({ id: p.goal.id })} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-medium text-fg-muted">Terminés ou abandonnés</h2>
          <div className="grid gap-4 opacity-70 @3xl:grid-cols-2">
            {done.map((p) => (
              <GoalCard key={p.goal.id} p={p} onEdit={() => setEditing(p.goal)} onDelete={() => confirm(`Supprimer le projet « ${p.goal.name} » ?`) && del.mutate({ id: p.goal.id })} />
            ))}
          </div>
        </>
      )}
      <GoalDialog open={editing !== null} goal={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </>
  );
}

function GoalCard({ p, onEdit, onDelete }: Readonly<{ p: GoalProgress; onEdit: () => void; onDelete: () => void }>) {
  const status = GOAL_STATUS[p.status];
  return (
    <Card className="group flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{p.goal.name}</h2>
          <div className="text-xs text-fg-faint">
            pour le {formatDate(p.goal.targetDate)}
            {p.monthsLeft > 0 && ` · dans ${p.monthsLeft} mois`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!p.goal.archived && <Badge tone={status.tone}>{status.label}</Badge>}
          <div className="w-16">
            <RowActions onEdit={onEdit} onDelete={onDelete} />
          </div>
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-baseline justify-between text-sm">
          <span>
            <Amount value={p.saved} compact /> sur <Amount value={p.goal.target} compact />
          </span>
          <Pct value={p.progress} />
        </div>
        <div className="h-2 rounded-full bg-surface-3" role="img" aria-label={`${Math.round(p.progress * 100)} % réunis`}>
          <div className={cn("h-full rounded-full", p.status === "atteint" ? "bg-positive" : "bg-accent")} style={{ width: `${Math.round(p.progress * 100)}%` }} />
        </div>
      </div>
      {p.status !== "atteint" && !p.goal.archived && (
        <p className="text-sm">
          {p.monthsLeft > 0 ? (
            <>
              À mettre de côté : <b>{<Amount value={p.monthlyNeeded} />}</b> par mois
              <span className="text-xs text-fg-faint"> (rendement supposé <Pct value={p.goal.rate} digits={1} />)</span>
            </>
          ) : (
            <>
              Il manque <b>{<Amount value={p.remaining} />}</b> : la date est passée.
            </>
          )}
        </p>
      )}
      {p.contributions.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-fg-muted">
          {p.contributions.map((c) => (
            <li key={c.accountId} className="flex justify-between gap-2">
              <span>
                {c.name} <span className="text-fg-faint">· {c.label}</span>
              </span>
              <Amount value={c.amount} compact />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-fg-faint">Aucun compte affecté : modifiez le projet pour indiquer où est l'argent.</p>
      )}
      {p.warning && <p className="rounded-lg bg-warning/10 p-2 text-xs text-fg">{p.warning}</p>}
      {p.goal.comment && <p className="text-xs text-fg-faint">{p.goal.comment}</p>}
    </Card>
  );
}
