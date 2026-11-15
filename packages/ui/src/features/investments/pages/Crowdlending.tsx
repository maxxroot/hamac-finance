import { AccountLink } from "@/shared/components/AccountLink";
import { Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { CROWD_REPAYMENT_LABELS, CROWD_STATUS_LABELS, accountIrr, crowdCountsLabel, crowdInitialEndDate, crowdSummary, crowdTaxOf, formatPct, type Account, type CrowdProject, type CrowdProjectState, type CrowdStatus } from "@hamac/core";
import { AccountEvolution } from "@/shared/components/AccountEvolution";
import { AddAccountButton, EmptyAccount } from "@/features/entry";
import { Amount } from "@/shared/components/Amount";
import { RowActions } from "@/shared/components/RowActions";
import { Stat, StatGrid } from "@/shared/components/Stat";
import { DetailRow, EmptyRow, ExpandButton, Table, Td, Th, Tr, useExpandedRow } from "@/shared/components/table";
import { Badge, Button, Card, PageHeader } from "@/shared/components/ui";
import { BricksImportDialog } from "@/features/investments/dialogs/BricksImportDialog";
import { CrowdProjectDialog } from "@/features/investments/dialogs/CrowdProjectDialog";
import { DeclareInterestDialog } from "@/features/investments/dialogs/DeclareInterestDialog";
import { capitalize, formatDate, formatMonth } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useMutate } from "@/shared/lib/workspace";
import { DispenseStatus } from "../components/DispenseStatus";

const TONES: Record<CrowdStatus, "neutral" | "accent" | "positive" | "negative"> = { en_cours: "positive", retard: "accent", defaut: "negative", rembourse: "neutral" };
const ORDER: Record<CrowdStatus, number> = { defaut: 0, retard: 1, en_cours: 2, rembourse: 3 };

/** Plateformes de crowdlending : chaque prêt est suivi projet par projet. */
export function Crowdlending() {
  const pf = usePortfolio();
  const del = useMutate("crowdProjects.delete", { success: "Projet supprimé" });
  const [editing, setEditing] = useState<CrowdProject | "new" | null>(null);
  const { isOpen, rowProps } = useExpandedRow();
  const [declaring, setDeclaring] = useState(false);
  const [importing, setImporting] = useState(false);
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
        description="Vos prêts, projet par projet. Les intérêts se déclarent une fois par mois pour toute la plateforme, paiements partiels compris."
        actions={
          <div className="flex gap-2">
            <AddAccountButton kind="crowdlending" label="Ajouter un compte" variant="ghost" />
            {platforms.length > 0 && <Button onClick={() => setImporting(true)}>Importer un fichier Bricks</Button>}
            {platforms.length > 0 && <Button onClick={() => setDeclaring(true)}>Déclarer les intérêts du mois</Button>}
            {platforms.length > 0 && (
              <Button variant="primary" onClick={() => setEditing("new")}>
                <Plus size={16} /> Nouveau projet
              </Button>
            )}
          </div>
        }
      />

      {platforms.length === 0 ? (
        <EmptyAccount kind="crowdlending" label="Ajouter un compte">
          Créez votre plateforme (Bricks, par exemple) dans Paramètres › Établissements, ajoutez-lui un compte de crowdlending, puis vos projets.
        </EmptyAccount>
      ) : (
        <>
          {states.length > 0 && <p className="-mt-6 mb-6 text-xs text-fg-muted">{crowdCountsLabel(states)}</p>}

          <StatGrid>
            <Stat label="Capital en cours" sub={summary.averageRate != null ? `taux moyen ${formatPct(summary.averageRate)}` : undefined}>
              <span className="text-2xl">
                <Amount value={summary.active} compact />
              </span>
            </Stat>
            <Stat label="À réinvestir" sub="espèces sur les plateformes" tone={cash < -0.01 ? "negative" : undefined}>
              <Amount value={cash} compact />
            </Stat>
            <Stat label="Intérêts reçus" sub="déclarés">
              <Amount value={interests} compact />
            </Stat>
            <Stat label="En retard ou en défaut" sub="capital concerné" tone={summary.atRisk > 0 ? "warning" : undefined}>
              <Amount value={summary.atRisk} compact />
            </Stat>
          </StatGrid>
          <DispenseStatus accounts={platforms} institutions={pf.data.institutions ?? []} params={pf.data.params} today={pf.today} />

          <Card className="mb-5 overflow-hidden p-0">
            <Table className="rounded-none border-0">
              <thead>
                <tr>
                  <Th className="pl-5">Plateforme</Th>
                  <Th align="right">Capital en cours</Th>
                  <Th align="right">Taux moyen prévu</Th>
                  <Th align="right">Intérêts reçus</Th>
                  <Th align="right" className="pr-5">Rendement réel annualisé</Th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const s = crowdSummary(a.crowdProjects);
                  const { irr, reason } = accountIrr(pf.data, pf.state, a.account.id);
                  return (
                    <Fragment key={a.account.id}>
                    <Tr {...rowProps(a.account.id)}>
                      <Td className="pl-5 font-medium">
                        <ExpandButton open={isOpen(a.account.id)} label={a.account.name} />
                        <AccountLink account={a.account} />
                      </Td>
                      <Td align="right"><Amount value={s.active} /></Td>
                      <Td align="right">{s.averageRate != null ? formatPct(s.averageRate) : "—"}</Td>
                      <Td align="right"><Amount value={a.interests} /></Td>
                      <Td align="right" className="pr-5" title={irr == null ? (reason ?? undefined) : "Dépôts, retraits, intérêts et pertes compris, argent non investi inclus"}>{irr != null ? formatPct(irr) : "—"}</Td>
                    </Tr>
                    {isOpen(a.account.id) && (
                      <DetailRow cols={5}>
                        <AccountEvolution accountIds={[a.account.id]} />
                      </DetailRow>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </Table>
          </Card>

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
                        {c.platform}
                        {c.project.termMonths != null ? ` · ${CROWD_REPAYMENT_LABELS[c.project.repayment]}` : c.project.comment ? ` · ${c.project.comment}` : ""}
                      </div>
                    </Td>
                    <Td align="right"><Amount value={c.project.amount} /></Td>
                    <Td align="right">{c.project.rate != null ? formatPct(c.project.rate) : "—"}</Td>
                    <Td align="right">
                      <Amount value={c.outstanding} />
                      {c.status === "defaut" && (
                        <div className="text-xs text-fg-faint">
                          compté <Amount value={c.value} />
                        </div>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-fg-muted">{formatDate(c.nextDate)}</Td>
                    <Td className="whitespace-nowrap text-fg-muted">
                      {c.project.extendedTo ? capitalize(formatMonth(c.project.extendedTo.slice(0, 7))) : formatDate(c.endDate)}
                      {c.project.extendedTo && <div className="text-xs text-warning">Prolongée{crowdInitialEndDate(c.project) ? ` (prévue le ${formatDate(crowdInitialEndDate(c.project))})` : ""}</div>}
                    </Td>
                    <Td>{c.overdue ? <Badge tone="accent">Échéance dépassée</Badge> : <Badge tone={TONES[c.status]}>{CROWD_STATUS_LABELS[c.status]}</Badge>}</Td>
                    <Td className="w-20 pr-5"><RowActions onEdit={() => setEditing(c.project)} onDelete={() => confirm(`Supprimer « ${c.project.name} » ?`) && del.mutate({ id: c.project.id })} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      {importing && <BricksImportDialog platforms={platforms} onClose={() => setImporting(false)} />}
      {declaring && <DeclareInterestDialog platforms={platforms} taxOf={(id, year) => crowdTaxFor(pf.data, platforms, id, year)} journal={pf.data.transactions} onClose={() => setDeclaring(false)} />}
      <CrowdProjectDialog open={editing !== null} project={editing === "new" ? null : editing} platforms={platforms} onClose={() => setEditing(null)} />
    </>
  );
}

/** Retenues d'une plateforme pour une année : la dispense de l'acompte se règle année par année. */
function crowdTaxFor(data: Parameters<typeof crowdTaxOf>[0], platforms: readonly Account[], accountId: string, year: number) {
  const account = platforms.find((a) => a.id === accountId);
  return account ? crowdTaxOf(data, account, year) : null;
}
