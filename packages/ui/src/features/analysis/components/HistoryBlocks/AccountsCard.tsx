import { type AccountChange } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Table, Td, Tr } from "@/shared/components/table";
import { Badge, Card, CardTitle } from "@/shared/components/ui";
import { SortTh, useSortable } from "@/shared/lib/sort";

export function AccountsCard({ rows, nameOf, closed }: { rows: readonly AccountChange[]; nameOf: (id: string) => string; closed: (id: string) => boolean }) {
  const { sorted, by } = useSortable(
    rows,
    {
      compte: (a) => nameOf(a.accountId),
      debut: (a) => a.startValue,
      fin: (a) => a.endValue,
      ecart: (a) => a.endValue - a.startValue,
      apport: (a) => a.contribChange,
      gain: (a) => a.gainChange,
    },
    { key: "fin", dir: "desc" },
  );
  const total = (f: (a: AccountChange) => number) => rows.reduce((t, a) => t + f(a), 0);
  return (
    <Card>
      <CardTitle hint="transferts entre comptes compris">Compte par compte</CardTitle>
      <Table>
        <thead>
          <tr>
            <SortTh {...by("compte")}>Compte</SortTh>
            <SortTh {...by("debut")} align="right">Au début</SortTh>
            <SortTh {...by("fin")} align="right">À la fin</SortTh>
            <SortTh {...by("apport")} align="right">Argent apporté</SortTh>
            <SortTh {...by("gain")} align="right">Gain</SortTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <Tr key={a.accountId}>
              <Td className="max-w-56">
                <span className="truncate">{nameOf(a.accountId)}</span>
                {closed(a.accountId) && a.endValue === 0 && <span className="ml-2"><Badge>clôturé</Badge></span>}
              </Td>
              <Td align="right"><Amount value={a.startValue} compact /></Td>
              <Td align="right" className="font-medium"><Amount value={a.endValue} compact /></Td>
              <Td align="right"><Amount value={a.contribChange} signed compact className="text-fg" /></Td>
              <Td align="right"><Amount value={a.gainChange} signed compact /></Td>
            </Tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <Td>Total</Td>
            <Td align="right"><Amount value={total((a) => a.startValue)} compact /></Td>
            <Td align="right"><Amount value={total((a) => a.endValue)} compact /></Td>
            <Td align="right"><Amount value={total((a) => a.contribChange)} signed compact className="text-fg" /></Td>
            <Td align="right"><Amount value={total((a) => a.gainChange)} signed compact /></Td>
          </tr>
        </tfoot>
      </Table>
    </Card>
  );
}

// ——— Répartition ———
