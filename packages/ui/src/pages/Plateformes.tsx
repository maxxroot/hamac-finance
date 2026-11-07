import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { COMPARISON_CRITERIA, type Comparison } from "@hamac/core";
import { TextInput } from "@/components/form";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

const TITLES = { assurance_vie: "Assurances-vie", courtier: "Courtiers (PEA et compte-titres)" } as const;
const HINTS = {
  assurance_vie: "Critères classés par importance, de gauche à droite.",
  courtier: "Visé : PEA et compte-titres chez le même courtier, frais d'ordre faibles sur de petits montants, pas de droits de garde.",
} as const;

export function Plateformes() {
  return (
    <>
      <PageHeader title="Choix des plateformes" description="Comparer les offres avec les chiffres des sites et des comparatifs annuels. Cliquez sur une case pour la remplir." />
      <Grid kind="assurance_vie" />
      <Grid kind="courtier" />
    </>
  );
}

function Grid({ kind }: { kind: "assurance_vie" | "courtier" }) {
  const idx = useWorkspaceIndex();
  const add = useMutate("comparisons.upsert");
  const criteria = COMPARISON_CRITERIA[kind];
  const rows = idx?.ws.comparisons.filter((c) => c.kind === kind) ?? [];
  const best = Math.max(...rows.map((r) => r.score ?? -1));
  return (
    <Card className="mb-6 p-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div>
          <h2 className="font-medium">{TITLES[kind]}</h2>
          <p className="text-xs text-fg-faint">{HINTS[kind]}</p>
        </div>
        <Button onClick={() => add.mutate({ kind, name: kind === "courtier" ? "Nouveau courtier" : "Nouveau contrat" })}>
          <Plus size={15} /> Ajouter
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-2">
              <th className="sticky left-0 z-10 min-w-48 border-b border-line bg-surface-2 px-3 py-2 text-left text-xs font-medium text-fg-muted">{kind === "courtier" ? "Courtier" : "Contrat"}</th>
              {criteria.map((c) => (
                <th key={c.key} className="min-w-40 border-b border-line px-3 py-2 text-left align-bottom text-xs font-medium text-fg-muted">
                  {c.label}
                  {c.target && <div className="mt-0.5 font-normal text-accent">visé : {c.target}</div>}
                </th>
              ))}
              <th className="min-w-24 border-b border-line px-3 py-2 text-left text-xs font-medium text-fg-muted">Note /10</th>
              <th className="min-w-56 border-b border-line px-3 py-2 text-left text-xs font-medium text-fg-muted">Commentaire</th>
              <th className="border-b border-line" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.id} row={r} criteria={criteria} best={r.score != null && r.score === best} />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="px-5 py-6 text-sm text-fg-muted">Aucune offre comparée pour l'instant : « Ajouter » crée une ligne à remplir.</p>}
    </Card>
  );
}

function Row({ row, criteria, best }: { row: Comparison; criteria: Array<{ key: string }>; best: boolean }) {
  const save = useMutate("comparisons.upsert");
  const del = useMutate("comparisons.delete");
  const [d, setD] = useState(row);
  useEffect(() => setD(row), [row]);
  const commit = (next: Comparison) => {
    if (JSON.stringify(next) !== JSON.stringify(row)) save.mutate(next);
  };
  const cell = "border-b border-line/60 px-1.5 py-1";
  const input = "h-8 border-transparent bg-transparent hover:border-line-strong";
  return (
    <tr className="group">
      <td className={cn(cell, "sticky left-0 z-10 bg-surface")}>
        <div className="flex items-center gap-1">
          <TextInput className={cn(input, "font-medium")} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} onBlur={() => d.name.trim() && commit(d)} />
          {best && <Badge tone="positive">meilleure note</Badge>}
        </div>
      </td>
      {criteria.map((c) => (
        <td key={c.key} className={cell}>
          <TextInput className={input} value={d.values[c.key] ?? ""} onChange={(e) => setD({ ...d, values: { ...d.values, [c.key]: e.target.value } })} onBlur={() => commit(d)} />
        </td>
      ))}
      <td className={cell}>
        <TextInput
          className={cn(input, "num text-right")}
          inputMode="decimal"
          value={d.score ?? ""}
          onChange={(e) => {
            const v = e.target.value.replace(",", ".");
            setD({ ...d, score: v === "" ? null : Math.max(0, Math.min(10, Number(v) || 0)) });
          }}
          onBlur={() => commit(d)}
        />
      </td>
      <td className={cell}>
        <TextInput className={input} value={d.comment} onChange={(e) => setD({ ...d, comment: e.target.value })} onBlur={() => commit(d)} />
      </td>
      <td className={cn(cell, "w-8")}>
        <button className="p-1 text-fg-faint opacity-0 group-hover:opacity-100 hover:text-negative" onClick={() => confirm(`Supprimer « ${row.name} » ?`) && del.mutate({ id: row.id })} aria-label="Supprimer">
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
