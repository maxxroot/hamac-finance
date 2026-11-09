import { useState } from "react";
import { Link } from "react-router";
import { RENT_EXCEPTION_LABELS, rentMonths, rentReceipt, type Lease, type LeaseRent, type RentException, type RentMonth } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Select } from "@/components/form";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { RentExceptionDialog } from "@/dialogs/RentExceptionDialog";
import { formatMonth } from "@/lib/numbers";

/** Loyers comptés automatiquement, mois par mois ; seuls les écarts se signalent. */
export function RentsCard({ leases, rents, exceptions, today }: { leases: readonly Lease[]; rents: readonly LeaseRent[]; exceptions: readonly RentException[]; today: string }) {
  const months = leases.flatMap((l) => rentMonths(l, rents, exceptions, today)).sort((a, b) => b.month.localeCompare(a.month));
  const years = [...new Set(months.map((m) => m.month.slice(0, 4)))];
  const [chosenYear, setChosenYear] = useState<string | null>(null);
  const year = chosenYear != null && years.includes(chosenYear) ? chosenYear : (years[0] ?? null);
  const [reporting, setReporting] = useState<RentMonth | null>(null);
  const shown = months.filter((m) => m.month.slice(0, 4) === year);
  return (
    <Card>
      <CardTitle
        hint={
          years.length > 1 && (
            <Select aria-label="Année des loyers" value={year ?? ""} onChange={(e) => setChosenYear(e.target.value)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )
        }
      >
        Loyers
      </CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Mois</Th>
            <Th align="right">Prévu</Th>
            <Th align="right">Reçu</Th>
            <Th>État</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && <EmptyRow cols={5}>Les loyers apparaîtront ici dès le début du bail.</EmptyRow>}
          {shown.map((m) => (
            <Tr key={`${m.leaseId}-${m.month}`}>
              <Td className="whitespace-nowrap">{formatMonth(m.month)}</Td>
              <Td align="right"><Amount value={m.expectedRent + m.expectedCharges} /></Td>
              <Td align="right"><Amount value={m.receivedRent + m.receivedCharges} /></Td>
              <Td>{m.status === "paye" ? <Badge tone="positive">Reçu</Badge> : <Badge tone={m.status === "impaye" ? "negative" : "neutral"}>{RENT_EXCEPTION_LABELS[m.status]}</Badge>}</Td>
              <Td align="right">
                {rentReceipt(m) && (
                  <Link className="mr-1 text-xs text-fg-muted underline hover:text-fg" to={`/impression/quittance/${m.leaseId}/${m.month}`} target="_blank" rel="noopener" aria-label={`Quittance de ${formatMonth(m.month)}`}>
                    Quittance
                  </Link>
                )}
                <Button className="h-7 px-2 text-xs" variant="ghost" aria-label={`Signaler un écart pour ${formatMonth(m.month)}`} onClick={() => setReporting(m)}>
                  {m.exception ? "Modifier" : "Signaler"}
                </Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <RentExceptionDialog month={reporting} onClose={() => setReporting(null)} />
    </Card>
  );
}
