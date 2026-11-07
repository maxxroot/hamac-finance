import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatEur, retirementYear } from "@hamac/core";
import { TextInput } from "@/components/form";
import { Table, Td, Th, Tr } from "@/components/table";
import { Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";
import { Schedule } from "@hamac/core";

export function Regles() {
  const pf = usePortfolio();
  if (!pf) return null;
  const p = pf.data.params;
  const eur = (v: number) => formatEur(v, { compact: true });
  const schedule = new Schedule(pf.data.plans, pf.data.skips, p.profile.startMonth);
  const year = +pf.today.slice(0, 4);
  const ctoYear = pf.data.accounts.filter((a) => a.kind === "cto").reduce((s, a) => s + schedule.inYear(a.id, year + 1), 0);
  const sec = p.profile.securisationAge;

  const rules: Array<[string, string]> = [
    ["Chaque mois", "Virements automatiques le lendemain de la paie (programmés une fois dans Versements, à modifier seulement s'ils changent). Acheter des ETF avec les espèces du PEA quand le Tableau de bord le conseille, et noter l'achat dans le Journal."],
    ["Toujours", "Ne rien vendre quand la bourse baisse : une baisse n'est une perte que si l'on vend."],
    [
      "Une fois par an (janvier)",
      `Avec les espèces du compte-titres${ctoYear ? ` (environ ${eur(ctoYear)} par an d'après vos versements)` : ""}, acheter une obligation dont l'échéance tombe avant ${p.profile.retirementAge} ans (${retirementYear(p)}), et la garder jusqu'à l'échéance.`,
    ],
    [
      "Une fois par an",
      `Livrets : au-dessus de ${eur(p.livrets.ceiling)}, transférer l'excédent vers le fonds euros ; sous ${eur(p.livrets.floor)}, reconstituer avant tout le reste. Noter les intérêts de l'année (livrets et fonds euros) datés du 31/12, et le taux servi du fonds euros.`,
    ],
    [
      "Deux fois par an",
      `Comparer la valeur du fonds euros sur le site de l'assureur avec celle de Hamac, et saisir l'écart en correction si besoin. Rééquilibrer seulement si une classe d'actifs s'écarte de plus de ${Math.round(p.livrets.driftAlert * 100)} points, en orientant les versements plutôt qu'en vendant.`,
    ],
    ["À l'échéance d'une obligation", `Avant ${sec} ans : racheter une obligation plus lointaine. À partir de ${sec} ans : transférer le capital remboursé vers le fonds euros.`],
    [`Dès ${sec} ans`, "Versements actions redirigés vers le fonds euros. Chaque année, vendre une partie des ETF et transférer vers le fonds euros pour suivre la part cible (la projection en tient compte)."],
    ["Grosse dépense (voiture, travaux)", "Payée uniquement par les livrets. Saisir le retrait dans le Journal, et l'année prévue dans Projection."],
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader title="Règles et démarches" description="Les règles du plan, calculées depuis vos paramètres, et la liste des démarches à cocher." />
      <Card className="mb-6">
        <CardTitle hint="d'après Paramètres › Plan">Règles du plan</CardTitle>
        <Table>
          <thead>
            <tr>
              <Th className="w-56">Quand</Th>
              <Th>Quoi</Th>
            </tr>
          </thead>
          <tbody>
            {rules.map(([w, q]) => (
              <Tr key={w}>
                <Td className="align-top font-medium">{w}</Td>
                <Td className="text-fg-muted">{q}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Checklist />
    </div>
  );
}

function Checklist() {
  const pf = usePortfolio();
  const upsert = useMutate("checklist.upsert");
  const del = useMutate("checklist.delete");
  const seed = useMutate("checklist.seedDefaults", { success: "Liste type ajoutée" });
  const [label, setLabel] = useState("");
  const items = pf?.idx.ws.checklist ?? [];
  const done = items.filter((i) => i.done).length;
  return (
    <Card>
      <CardTitle hint={items.length ? `${done} / ${items.length} faites` : undefined}>Démarches à faire</CardTitle>
      {items.length === 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm">
          <span className="text-fg-muted">Aucune démarche. Partir d'une liste type (relevé de carrière, ouverture des comptes, clause bénéficiaire…) ?</span>
          <Button onClick={() => seed.mutate(undefined as never)}>Ajouter la liste type</Button>
        </div>
      )}
      <ul className="divide-y divide-line/60">
        {items.map((i) => (
          <li key={i.id} className="group flex items-start gap-3 py-2.5">
            <input type="checkbox" checked={i.done} onChange={(e) => upsert.mutate({ ...i, done: e.target.checked })} className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]" aria-label={i.label} />
            <div className={cn("min-w-0 flex-1 text-sm", i.done && "text-fg-faint line-through")}>
              {i.label}
              {i.note && <span className="ml-2 text-xs text-fg-faint no-underline">· {i.note}</span>}
              {i.done && i.doneAt && <span className="ml-2 text-xs no-underline">(fait le {formatDate(i.doneAt.slice(0, 10))})</span>}
            </div>
            <button className="text-fg-faint opacity-0 group-hover:opacity-100 hover:text-negative" onClick={() => del.mutate({ id: i.id })} aria-label="Supprimer">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim()) upsert.mutate({ label, sortOrder: items.length }, { onSuccess: () => setLabel("") });
        }}
      >
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ajouter une démarche…" />
        <Button type="submit" disabled={!label.trim()}>
          <Plus size={15} /> Ajouter
        </Button>
      </form>
    </Card>
  );
}
