import { Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { LOAN_KIND_LABELS, type Loan } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { LoanPrepayments } from "@/components/LoanPrepayments";
import { LoanYearsChart } from "@/components/LoanYearsChart";
import { RowActions } from "@/components/RowActions";
import { Pct, Stat, StatGrid } from "@/components/Stat";
import { DetailRow, EmptyRow, ExpandButton, stopRowClick, Table, Td, Th, Tr, useExpandedRow } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { LoanDialog } from "@/dialogs/LoanDialog";
import { DebtWeightCard, PrepaymentCard } from "@/components/DebtCards";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

/** Crédits en cours : calculés depuis le montant, le taux et la durée, corrigeables d'après un relevé. */
export function Credits() {
  const pf = usePortfolio();
  const del = useMutate("loans.delete", { success: "Crédit supprimé" });
  const [editing, setEditing] = useState<Loan | "new" | null>(null);
  const { isOpen, rowProps } = useExpandedRow();
  if (!pf) return null;
  const { netWorth } = pf.state;
  const properties = pf.idx.ws.properties;
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const archivedLoans = pf.idx.ws.loans.filter((l) => l.archived);

  return (
    <>
      <PageHeader
        title="Crédits"
        description="Échéance et capital restant dû sont calculés, ou repris d'un relevé. Cliquez sur un crédit pour voir son coût année par année."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Nouveau crédit
          </Button>
        }
      />

      <StatGrid>
        <Stat label="Capital restant dû" sub="part à votre charge">
          <span className="text-2xl">
            <Amount value={netWorth.debts} compact />
          </span>
        </Stat>
        <Stat label="Mensualités" sub="part à votre charge, assurance comprise">
          <Amount value={netWorth.monthlyLoans} compact />
        </Stat>
        <Stat label="Patrimoine net" sub="financier + immobilier − crédits">
          <Amount value={netWorth.net} compact />
        </Stat>
      </StatGrid>

      <Card className="overflow-hidden p-0">
        <Table className="rounded-none border-0">
          <thead>
            <tr>
              <Th className="pl-5">Crédit</Th>
              <Th align="right">Taux</Th>
              <Th align="right">Mensualité</Th>
              <Th align="right">Coût total</Th>
              <Th align="right">Capital restant dû</Th>
              <Th align="right">Échéances restantes</Th>
              <Th>Fin</Th>
              <Th className="pr-5" />
            </tr>
          </thead>
          <tbody>
            {netWorth.loans.length === 0 && <EmptyRow cols={8}>Aucun crédit en cours.</EmptyRow>}
            {netWorth.loans.map((l) => {
              const row = rowProps(l.loan.id);
              return (
              <Fragment key={l.loan.id}>
              <Tr {...row} className={`group ${row.className}`}>
                <Td className="pl-5 font-medium">
                  <ExpandButton open={isOpen(l.loan.id)} label={l.loan.name} />
                  {l.loan.name}
                  <div className="ml-[21px] text-xs font-normal text-fg-faint">
                    {LOAN_KIND_LABELS[l.loan.kind]}
                    {l.loan.propertyId ? ` · ${propertyName.get(l.loan.propertyId)}` : ""}
                  </div>
                </Td>
                <Td align="right">
                  <Pct value={l.loan.rate} digits={2} />
                  {l.loan.insuranceMode !== "montant" && (
                    <div className="text-xs text-fg-faint">
                      assurance <Pct value={l.loan.insuranceRate} digits={2} />
                    </div>
                  )}
                </Td>
                <Td align="right">
                  <Amount value={l.monthly} />
                  {l.insurance > 0 && (
                    <div className="text-xs text-fg-faint">
                      dont assurance <Amount value={l.insurance} />
                    </div>
                  )}
                  {l.loan.share < 1 && (
                    <div className="text-xs text-fg-faint">
                      à votre charge <Amount value={l.heldMonthly} />
                    </div>
                  )}
                </Td>
                <Td align="right">
                  <Amount value={l.totalInterest + l.totalInsurance} compact />
                  <div className="text-xs text-fg-faint">
                    dont assurance <Amount value={l.totalInsurance} compact />
                  </div>
                </Td>
                <Td align="right">
                  <span className="inline-flex items-center gap-2">
                    {l.fromManualBalance && <Badge>d'après relevé</Badge>}
                    <Amount value={l.balance} />
                  </span>
                  {l.loan.share < 1 && (
                    <div className="text-xs text-fg-faint">
                      à votre charge <Amount value={l.heldBalance} />
                    </div>
                  )}
                </Td>
                <Td align="right">{l.paymentsLeft}</Td>
                <Td className="whitespace-nowrap text-fg-muted">{formatDate(l.endDate)}</Td>
                <Td className="w-20 pr-5" onClick={stopRowClick}><RowActions onEdit={() => setEditing(l.loan)} onDelete={() => confirm(`Supprimer « ${l.loan.name} » ?`) && del.mutate({ id: l.loan.id })} /></Td>
              </Tr>
              {isOpen(l.loan.id) && (
                <DetailRow cols={8}>
                  <LoanYearsChart loan={l.loan} />
                  <LoanPrepayments loan={l.loan} />
                </DetailRow>
              )}
              </Fragment>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <DebtWeightCard />
      <PrepaymentCard />

      {archivedLoans.length > 0 && (
        <Card className="mt-5">
          <CardTitle hint="pour rétablir un crédit, ouvrez-le et décochez « Archivé »">Crédits archivés</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Crédit</Th>
                <Th align="right">Montant emprunté</Th>
                <Th>Soldé le</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {archivedLoans.map((loan) => (
                <Tr key={loan.id} className="group">
                  <Td className="font-medium">
                    {loan.name}
                    <div className="text-xs font-normal text-fg-faint">{LOAN_KIND_LABELS[loan.kind]}</div>
                  </Td>
                  <Td align="right"><Amount value={loan.principal} /></Td>
                  <Td className="whitespace-nowrap text-fg-muted">{loan.closedOn ? formatDate(loan.closedOn) : "—"}</Td>
                  <Td className="w-20"><RowActions onEdit={() => setEditing(loan)} onDelete={() => confirm(`Supprimer « ${loan.name} » ?`) && del.mutate({ id: loan.id })} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <LoanDialog open={editing !== null} loan={editing === "new" ? null : editing} properties={properties.filter((p) => !p.archived)} onClose={() => setEditing(null)} />
    </>
  );
}
