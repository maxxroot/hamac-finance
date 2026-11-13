import { Link } from "react-router";
import { LOAN_KIND_LABELS, type PropertySummary } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { EmptyRow, Table, Td, Th, Tr } from "@/shared/components/table";
import { Card, CardTitle } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/numbers";

/** Crédits rattachés au bien, pour la part à charge de l'utilisateur. */
export function PropertyLoansCard({ loans }: { loans: PropertySummary["loans"] }) {
  return (
    <Card>
      <CardTitle hint="part à votre charge">Crédits rattachés</CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Crédit</Th>
            <Th align="right">Mensualité</Th>
            <Th align="right">Capital restant dû</Th>
            <Th>Fin</Th>
          </tr>
        </thead>
        <tbody>
          {loans.length === 0 && (
            <EmptyRow cols={4}>
              Aucun crédit. Rattachez-en un depuis la page <Link to="/credits" className="underline">Crédits</Link>.
            </EmptyRow>
          )}
          {loans.map((l) => (
            <Tr key={l.loan.id}>
              <Td className="font-medium">
                {l.loan.name}
                <div className="text-xs font-normal text-fg-faint">{LOAN_KIND_LABELS[l.loan.kind]}</div>
              </Td>
              <Td align="right"><Amount value={l.heldMonthly} /></Td>
              <Td align="right"><Amount value={l.heldBalance} /></Td>
              <Td className="whitespace-nowrap text-fg-muted">{formatDate(l.endDate)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
