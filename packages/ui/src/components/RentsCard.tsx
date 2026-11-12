import { useState } from "react";
import { Link } from "react-router";
import { formatEur, rentMonths, rentReceipt, settlingPayment, type Lease, type LeaseRent, type Lot, type RentLedger, type RentMonth } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Select } from "@/components/form";
import { RentStatusBadge } from "@/components/RentStatusBadge";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Button, Card, CardTitle } from "@/components/ui";
import { RentMonthDialog } from "@/dialogs/RentMonthDialog";
import { formatMonth } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

/** Loyers mois par mois : chacun se pointe à réception ; rien n'est reçu tant qu'il n'est pas pointé. */
export function RentsCard({ leases, rents, ledger, lots = [], today }: { leases: readonly Lease[]; rents: readonly LeaseRent[]; ledger: RentLedger; lots?: readonly Lot[]; today: string }) {
  const months = leases.flatMap((l) => rentMonths(l, rents, ledger, today)).sort((a, b) => b.month.localeCompare(a.month));
  const years = [...new Set(months.map((m) => m.month.slice(0, 4)))];
  const [chosenYear, setChosenYear] = useState<string | null>(null);
  const year = chosenYear != null && years.includes(chosenYear) ? chosenYear : (years[0] ?? null);
  const [opened, setOpened] = useState<{ leaseId: string; month: string } | null>(null);
  const receive = useMutate("rentPayments.upsert", { success: "Loyer reçu" });
  const receiveAll = useMutate("rentPayments.addMany", { success: "Loyers reçus" });
  const shown = months.filter((m) => m.month.slice(0, 4) === year);
  // Avec plusieurs lots loués, chaque ligne dit de quel lot il s'agit.
  const lotOf = new Map(leases.map((l) => [l.id, lots.find((x) => x.id === l.lotId)?.name ?? ""]));
  const named = new Set(leases.map((l) => l.lotId)).size > 1;
  // Mois déjà échus de l'année, à rattraper d'un coup.
  const catchUp = shown.filter((m) => m.dueDate <= today).map((m) => settlingPayment(m, today)).filter((p) => p != null);
  const catchUpTotal = catchUp.reduce((s, p) => s + p.amount, 0);
  const openedMonth: RentMonth | null = opened ? (months.find((m) => m.leaseId === opened.leaseId && m.month === opened.month) ?? null) : null;
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
      {catchUp.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span>
            {catchUp.length} loyers échus de {year} ne sont pas pointés (<Amount value={catchUpTotal} />).
          </span>
          <Button
            className="h-8"
            disabled={receiveAll.isPending}
            onClick={() => confirm(`Marquer reçus les ${catchUp.length} loyers échus de ${year}, pour ${formatEur(catchUpTotal)}, à leur date d'échéance ?`) && receiveAll.mutate({ payments: catchUp })}
          >
            Valider l'année {year}
          </Button>
        </div>
      )}
      <Table>
        <thead>
          <tr>
            <Th>Mois</Th>
            {named && <Th>Lot</Th>}
            <Th align="right">Dû</Th>
            <Th align="right">Reçu</Th>
            <Th>État</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && <EmptyRow cols={named ? 6 : 5}>Les loyers apparaîtront ici dès le début du bail.</EmptyRow>}
          {shown.map((m) => {
            const settle = settlingPayment(m, today);
            return (
              <Tr key={`${m.leaseId}-${m.month}`}>
                <Td className="whitespace-nowrap">{formatMonth(m.month)}</Td>
                {named && <Td>{lotOf.get(m.leaseId)}</Td>}
                <Td align="right"><Amount value={m.due} /></Td>
                <Td align="right"><Amount value={m.paid} /></Td>
                <Td><RentStatusBadge status={m.status} /></Td>
                <Td align="right" className="whitespace-nowrap">
                  {rentReceipt(m) && (
                    <Link className="mr-1 text-xs text-fg-muted underline hover:text-fg" to={`/impression/quittance/${m.leaseId}/${m.month}`} target="_blank" rel="noopener" aria-label={`Quittance de ${formatMonth(m.month)}`}>
                      Quittance
                    </Link>
                  )}
                  {settle && (
                    <Button className="h-7 px-2 text-xs" variant="ghost" disabled={receive.isPending} aria-label={`Marquer reçu le loyer de ${formatMonth(m.month)}`} onClick={() => receive.mutate(settle)}>
                      Reçu
                    </Button>
                  )}
                  <Button className="h-7 px-2 text-xs" variant="ghost" aria-label={`Détail du loyer de ${formatMonth(m.month)}`} onClick={() => setOpened({ leaseId: m.leaseId, month: m.month })}>
                    Détail
                  </Button>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <RentMonthDialog month={openedMonth} title={named && openedMonth ? lotOf.get(openedMonth.leaseId) : undefined} onClose={() => setOpened(null)} />
    </Card>
  );
}
