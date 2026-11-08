import { Plus } from "lucide-react";
import { useState } from "react";
import { CROWD_REPAYMENT_LABELS, CROWD_STATUS_LABELS, crowdSummary, formatPct, type CrowdProject, type CrowdProjectState, type CrowdStatus } from "@hamac/core";
import { AddAccountButton } from "@/components/AccountButtons";
import { Amount } from "@/components/Amount";
import { RowActions } from "@/components/RowActions";
import { Stat, StatGrid } from "@/components/Stat";
import { EmptyEnvelope } from "@/components/TransactionButton";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { CrowdProjectDialog } from "@/dialogs/CrowdProjectDialog";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

const TONES: Record<CrowdStatus, "neutral" | "accent" | "positive" | "negative"> = { en_cours: "positive", retard: "accent", defaut: "negative", rembourse: "neutral" };
const ORDER: Record<CrowdStatus, number> = { defaut: 0, retard: 1, en_cours: 2, rembourse: 3 };

/** Plateformes de crowdlending : chaque prêt est suivi projet par projet. */
export function Crowdlending() {
  const pf = usePortfolio();
  const del = useMutate("crowdProjects.delete", { success: "Projet supprimé" });
  const [editing, setEditing] = useState<CrowdProject | "new" | null>(null);
  if (!pf) return null;
  const accounts = pf.state.accounts.filter((a) => a.account.kind === "crowdlending" && !a.account.archived);
  const platforms = accounts.map((a) => a.account);
  const states: Array<CrowdProjectState & { platform: string }> = accounts
    .flatMap((a) => a.crowdProjects.map((c) => ({ ...c, platform: a.account.name })))
    .sort((x, y) => ORDER[x.status] - ORDER[y.status] || (x.nextDate ?? "9").localeCompare(y.nextDate ?? "9"));
  const summary = crowdSummary(states);
  const cash = accounts.reduce((s, a) => s + a.cash, 0);
  const interests = accounts.reduce((s, a) => s + a.interests, 0);

  return (
    <>
      <PageHeader
        title="Crowdlending"
        description="Vos prêts, projet par projet. Déposez l'argent sur la plateforme avec un versement au Journal, et notez-y les intérêts reçus."
        actions={
          <div className="flex gap-2">
            <AddAccountButton kind="crowdlending" label="Ajouter une plateforme" variant="ghost" />
            {platforms.length > 0 && (
              <Button variant="primary" onClick={() => setEditing("new")}>
                <Plus size={16} /> Nouveau projet
              </Button>
            )}
          </div>
        }
      />

      {platforms.length === 0 ? (
        <EmptyEnvelope kind="crowdlending" label="Ajouter une plateforme">
          Ajoutez d'abord votre plateforme (Bricks, par exemple), puis vos projets.
        </EmptyEnvelope>
      ) : (
        <>
          <StatGrid>
            <Stat label="Capital en cours" sub={summary.averageRate != null ? `taux moyen ${formatPct(summary.averageRate)}` : undefined}>
              <span className="text-2xl">
                <Amount value={summary.active} compact />
              </span>
            </Stat>
            <Stat label="À réinvestir" sub="espèces sur les plateformes" tone={cash < -0.01 ? "negative" : undefined}>
              <Amount value={cash} compact />
            </Stat>
            <Stat label="Intérêts reçus" sub="notés au Journal">
              <Amount value={interests} compact />
            </Stat>
            <Stat label="En retard ou en défaut" sub="capital concerné" tone={summary.atRisk > 0 ? "warning" : undefined}>
              <Amount value={summary.atRisk} compact />
            </Stat>
          </StatGrid>

          <Card className="overflow-hidden p-0">
            <Table className="rounded-none border-0">
              <thead>
                <tr>
                  <Th className="pl-5">Projet</Th>
                  <Th align="right">Investi</Th>
                  <Th align="right">Taux</Th>
                  <Th align="right">Capital restant</Th>
                  <Th>Prochaine échéance</Th>
                  <Th>Fin</Th>
                  <Th>Statut</Th>
                  <Th className="pr-5" />
                </tr>
              </thead>
              <tbody>
                {states.length === 0 && <EmptyRow cols={8}>Aucun projet pour l'instant.</EmptyRow>}
                {states.map((c) => (
                  <Tr key={c.project.id} className="group">
                    <Td className="pl-5 font-medium">
                      {c.project.name}
                      <div className="text-xs font-normal text-fg-faint">
                        {c.platform} · {CROWD_REPAYMENT_LABELS[c.project.repayment]}
                      </div>
                    </Td>
                    <Td align="right"><Amount value={c.project.amount} /></Td>
                    <Td align="right">{formatPct(c.project.rate)}</Td>
                    <Td align="right">
                      <Amount value={c.outstanding} />
                      {c.status === "defaut" && (
                        <div className="text-xs text-fg-faint">
                          compté <Amount value={c.value} />
                        </div>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-fg-muted">{formatDate(c.nextDate)}</Td>
                    <Td className="whitespace-nowrap text-fg-muted">{formatDate(c.endDate)}</Td>
                    <Td>{c.overdue ? <Badge tone="accent">Échéance dépassée</Badge> : <Badge tone={TONES[c.status]}>{CROWD_STATUS_LABELS[c.status]}</Badge>}</Td>
                    <Td className="w-20 pr-5"><RowActions onEdit={() => setEditing(c.project)} onDelete={() => confirm(`Supprimer « ${c.project.name} » ?`) && del.mutate({ id: c.project.id })} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      <CrowdProjectDialog open={editing !== null} project={editing === "new" ? null : editing} platforms={platforms} onClose={() => setEditing(null)} />
    </>
  );
}
