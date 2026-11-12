import { Pencil, Plus, Trash2 } from "lucide-react";
import { FormGrid } from "@/shared/components/form";
import { useState } from "react";
import { AllocationTargets } from "@/features/settings/components/AllocationTargets";
import { PlanParams, etfTarget, formatPct, ruleName, targetLabel, type Account, type AllocationRule } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Table, Td, Th, Tr } from "@/shared/components/table";
import { Badge, Button } from "@/shared/components/ui";
import { AllocationDialog } from "@/features/settings/dialogs/AllocationDialog";
import { usePortfolio } from "@/shared/lib/portfolio";
import { Section } from "./Section";
import { PlanDraft, planFields } from "./usePlanDraft";

export function RepartitionTab({ draft }: { draft: PlanDraft }) {
  const { p, setP, idx, issues } = draft;
  const pf = usePortfolio();
  if (!p || !idx) return null;
  const { err, pctField } = planFields(p, setP, issues);
  const age = new Date().getFullYear() - p.profile.birthYear;
  const retraite = p.profile.goal === "retraite";
  // Taux moyen des livrets, pondéré par leur solde : repère pour l'hypothèse de rendement.
  const livrets = pf?.state.accounts.filter((a) => a.account.kind === "livret" && a.value > 0) ?? [];
  const livretTotal = livrets.reduce((t, a) => t + a.value, 0);
  const livretRate = livretTotal > 0 ? livrets.reduce((t, a) => t + a.value * (a.account.rate ?? 0), 0) / livretTotal : null;

  return (
    <div className="space-y-5">
      <Section title="Ma répartition cible" hint="Une ligne par classe que vous détenez. Chaque compte ou titre suit sa classe, sauf choix contraire sur sa fiche. Les classes sans rendement renseigné n'entrent pas dans la projection.">
        <AllocationTargets
          params={p}
          data={idx.ws}
          onChange={setP}
          labelErrors={new Map(p.customClasses.map((c, i) => [c.id, issues.get(`customClasses.${i}.label`) ?? ""]))}
          returnHints={livretRate != null ? { precaution: `Moyenne actuelle : ${(livretRate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %` } : undefined}
        />
        {err(["targets", "total"]) && <p className="mt-2 text-sm text-negative">{err(["targets", "total"])}</p>}
        <div className="mt-4">
          <FormGrid cols={3}>
            {retraite && pctField("Part actions à l'âge de départ", ["allocation", "etfAtRetirement"], "Baisse progressive à partir de l'âge de sécurisation, au profit du fonds euros.")}
            {pctField("Seuil d'alerte de rééquilibrage", ["livrets", "driftAlert"], "Alerte si la part d'une classe d'actifs s'écarte de plus de ce pourcentage de sa cible (ex. 5 % : alerte à 61 % pour une cible de 55 %).")}
          </FormGrid>
        </div>
        {retraite && <p className="mt-2 text-sm text-fg-muted">Actions cette année : <b className="text-fg">{formatPct(etfTarget(p, age))}</b>.</p>}
        {p.removedTargets.length > 0 && (
          <div className="mt-4 rounded-lg border border-warning/40 p-3 text-sm text-fg-muted">
            <p>Ces anciennes cibles posées sur des comptes ont été retirées : {p.removedTargets.map((r) => `${r.label} (${formatPct(r.share)})`).join(", ")}. Reportez-les ci-dessus si besoin.</p>
            <Button variant="ghost" className="mt-2 h-7 text-xs" onClick={() => setP((x) => (x ? { ...x, removedTargets: [] } : x))}>
              Compris
            </Button>
          </div>
        )}
      </Section>

      <CustomAllocations params={p} accounts={idx.ws.accounts} onChange={(customAllocations) => setP((x) => (x ? { ...x, customAllocations } : x))} issues={issues} />
    </div>
  );
}

/** Allocations personnalisées : lignes ajoutées à la demande (part des versements). */
export function CustomAllocations({
  params,
  accounts,
  onChange,
  issues,
}: {
  params: PlanParams;
  accounts: Account[];
  onChange: (rules: AllocationRule[]) => void;
  issues: Map<string, string>;
}) {
  const rules = params.customAllocations;
  const [editing, setEditing] = useState<AllocationRule | null>(null);
  const [creating, setCreating] = useState(false);
  const name = (r: AllocationRule) => ruleName(r, accounts);
  const totalOf = (pick: (r: AllocationRule) => boolean) => rules.filter(pick).reduce((t, r) => t + r.share, 0);
  const errors = [...issues].filter(([k]) => k.startsWith("customAllocations.")).map(([, m]) => m);
  const save = (r: AllocationRule) => onChange(rules.some((x) => x.id === r.id) ? rules.map((x) => (x.id === r.id ? r : x)) : [...rules, r]);
  const remove = (r: AllocationRule) => onChange(rules.filter((x) => x.id !== r.id).map((x) => (x.overflowTo === r.id ? { ...x, overflowTo: null } : x)));

  return (
    <Section
      title="Allocations personnalisées"
      hint="En plus de l'allocation ci-dessus : une part des versements pour un compte ou un type de compte, éventuellement jusqu'à une limite."
      actions={
        <Button onClick={() => setCreating(true)} className="shrink-0">
          <Plus size={16} /> Ajouter une allocation
        </Button>
      }
    >
      {rules.length === 0 ? (
        <p className="text-sm text-fg-muted">Aucune pour l'instant. Exemple : 20 % des versements sur les livrets jusqu'à 10 000 € versés, puis vers l'assurance-vie.</p>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Ligne</Th>
                <Th>Sert de</Th>
                <Th align="right">Part</Th>
                <Th>Limite</Th>
                <Th>Ensuite</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const dest = r.overflowTo ? rules.find((x) => x.id === r.overflowTo) : null;
                return (
                  <Tr key={r.id} className="group cursor-pointer" onDoubleClick={() => setEditing(r)}>
                    <Td>
                      <div>{name(r)}</div>
                      {r.label.trim() && <div className="text-xs text-fg-faint">{targetLabel(r.target, accounts)}</div>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Badge>Versements</Badge>
                    </Td>
                    <Td align="right">{formatPct(r.share)}</Td>
                    <Td className="whitespace-nowrap text-fg-muted">
                      {r.limit ? (
                        <>
                          jusqu'à <Amount value={r.limit.amount} compact className="text-fg" /> {r.limit.basis === "verse" ? "versés" : "de valeur"}
                        </>
                      ) : (
                        "sans fin"
                      )}
                    </Td>
                    <Td className="text-fg-muted">{r.limit ? (dest ? `vers « ${name(dest)} »` : "aux autres lignes") : ""}</Td>
                    <Td className="w-20">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                        <button className="rounded p-1.5 text-fg-muted hover:bg-surface-3 hover:text-fg" onClick={() => setEditing(r)} aria-label="Modifier">
                          <Pencil size={14} />
                        </button>
                        <button className="rounded p-1.5 text-fg-muted hover:bg-negative/15 hover:text-negative" onClick={() => remove(r)} aria-label="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-3 text-sm text-fg-muted">
            Parts des versements : <b className="text-fg">{formatPct(totalOf(() => true))}</b>. Le reste n'a pas de consigne.
          </p>
        </>
      )}
      {errors.length > 0 && <p className="mt-2 text-sm text-negative">{[...new Set(errors)].join(" ")}</p>}
      <AllocationDialog
        open={creating || !!editing}
        rule={editing}
        rules={rules}
        accounts={accounts}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={save}
      />
    </Section>
  );
}

// ——— Comptes ———
