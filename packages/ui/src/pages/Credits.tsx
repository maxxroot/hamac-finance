import { Plus } from "lucide-react";
import { useState } from "react";
import { LOAN_KIND_LABELS, type Loan } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { RowActions } from "@/components/RowActions";
import { Pct, Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { LoanDialog } from "@/dialogs/LoanDialog";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

/** Crédits en cours : calculés depuis le montant, le taux et la durée, corrigeables d'après un relevé. */
export function Credits() {
  const pf = usePortfolio();
  const del = useMutate("loans.delete", { success: "Crédit supprimé" });
  const [editing, setEditing] = useState<Loan | "new" | null>(null);
  if (!pf) return null;
  const { netWorth } = pf.state;
  const properties = pf.idx.ws.properties;
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader
        title="Crédits"
        description="Échéance et capital restant dû sont calculés ; vous pouvez les remplacer par les chiffres d'un relevé."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Nouveau crédit
          </Button>
        }
      />

      <StatGrid>
        <Stat label="Capital restant dû">
          <span className="text-2xl">
            <Amount value={netWorth.debts} compact />
          </span>
        </Stat>
        <Stat label="Mensualités" sub="assurance comprise">
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
            {netWorth.loans.map((l) => (
              <Tr key={l.loan.id} className="group">
                <Td className="pl-5 font-medium">
                  {l.loan.name}
                  <div className="text-xs font-normal text-fg-faint">
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
                </Td>
                <Td align="right">{l.paymentsLeft}</Td>
                <Td className="whitespace-nowrap text-fg-muted">{formatDate(l.endDate)}</Td>
                <Td className="w-20 pr-5"><RowActions onEdit={() => setEditing(l.loan)} onDelete={() => confirm(`Supprimer « ${l.loan.name} » ?`) && del.mutate({ id: l.loan.id })} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <LoanDialog open={editing !== null} loan={editing === "new" ? null : editing} properties={properties.filter((p) => !p.archived)} onClose={() => setEditing(null)} />
    </>
  );
}
