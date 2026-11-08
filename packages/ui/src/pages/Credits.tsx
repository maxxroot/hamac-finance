import { Plus } from "lucide-react";
import { useState } from "react";
import { formatPct, type Loan } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { RowActions } from "@/components/RowActions";
import { Stat, StatGrid } from "@/components/Stat";
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
              <Th align="right">Capital restant dû</Th>
              <Th align="right">Échéances restantes</Th>
              <Th>Fin</Th>
              <Th className="pr-5" />
            </tr>
          </thead>
          <tbody>
            {netWorth.loans.length === 0 && <EmptyRow cols={7}>Aucun crédit en cours.</EmptyRow>}
            {netWorth.loans.map((l) => (
              <Tr key={l.loan.id} className="group">
                <Td className="pl-5 font-medium">
                  {l.loan.name}
                  {l.loan.propertyId && <div className="text-xs font-normal text-fg-faint">{propertyName.get(l.loan.propertyId)}</div>}
                </Td>
                <Td align="right">{formatPct(l.loan.rate)}</Td>
                <Td align="right"><Amount value={l.monthly} /></Td>
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
