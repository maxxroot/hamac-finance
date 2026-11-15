import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/shared/components/Amount";
import { Field, NumberInput, PercentInput } from "@/shared/components/form";
import { Pct } from "@/shared/components/Stat";
import { EmptyRow, stopRowClick, Table, Td, Th, Tr } from "@/shared/components/table";
import { Button } from "@/shared/components/ui";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useMutate } from "@/shared/lib/workspace";
import type { FundLine } from "@/features/accounts/lib/fundLines";

/** Taux servis d'un fonds euros dans un contrat, année par année, avec les intérêts saisis cette année-là. */
export function FundRates({ line }: { line: FundLine }) {
  const pf = usePortfolio();
  const set = useMutate("fundRates.set", { success: "Taux enregistré" });
  const del = useMutate("fundRates.delete");
  const [year, setYear] = useState<number | null>(new Date().getFullYear() - 1);
  const [rate, setRate] = useState<number | null>(null);
  if (!pf) return null;
  const accountId = line.s.account.id;
  const assetId = line.fund.id;
  // Mêmes règles que le calcul : les intérêts sans support vont au fonds par défaut ; un coupon d'obligation n'en est pas.
  const interestsByYear = (y: number) =>
    pf.idx.ws.transactions
      .filter((t) => t.accountId === accountId && t.type === "interets" && t.date.startsWith(`${y}-`) && (t.assetId === assetId || (t.assetId == null && line.isDefault)))
      .reduce((t, x) => t + x.amount, 0);
  return (
    <div onClick={stopRowClick}>
      <h4 className="mb-2 text-xs font-medium text-fg-muted">Taux servis</h4>
      <Table className="mb-3">
        <thead>
          <tr>
            <Th>Année</Th>
            <Th align="right">Taux net</Th>
            <Th align="right">Intérêts saisis</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {line.rates.length === 0 && <EmptyRow cols={4}>Aucun taux saisi.</EmptyRow>}
          {[...line.rates].reverse().map((r) => (
            <Tr key={r.year} className="group">
              <Td>{r.year}</Td>
              <Td align="right">
                <Pct value={r.rate} />
              </Td>
              <Td align="right">
                <Amount value={interestsByYear(r.year)} />
              </Td>
              <Td className="w-8">
                <button className="text-fg-faint opacity-0 group-hover:opacity-100 hover:text-negative" onClick={() => del.mutate({ accountId, assetId, year: r.year })} aria-label="Supprimer">
                  <Trash2 size={13} />
                </button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <Field label="Année">{(id) => <NumberInput id={id} decimals={0} grouping={false} value={year} onChange={setYear} />}</Field>
        <Field label="Taux">{(id) => <PercentInput id={id} value={rate} onChange={setRate} />}</Field>
        <Button disabled={year == null || rate == null} onClick={() => year != null && rate != null && set.mutate({ accountId, assetId, year, rate }, { onSuccess: () => setRate(null) })}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
