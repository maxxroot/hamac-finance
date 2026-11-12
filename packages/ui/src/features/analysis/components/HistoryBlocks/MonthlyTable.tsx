import { useMemo } from "react";
import { BUCKET_LABELS, BUCKETS, type HistoryPoint } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { Table, Td, Tr } from "@/shared/components/table";
import { capitalize, formatMonth } from "@/shared/lib/numbers";
import { SortTh, useSortable } from "@/shared/lib/sort";

export function MonthlyTable({ history }: { history: readonly HistoryPoint[] }) {
  const reversed = useMemo(() => [...history].reverse(), [history]);
  const withRealEstate = history.some((h) => h.realEstate !== 0 || h.debts !== 0 || h.otherAssets !== 0);
  const used = BUCKETS.filter((b) => history.some((h) => h.buckets[b] !== 0));
  const { sorted, by } = useSortable(
    reversed,
    {
      mois: (h) => h.month,
      ...Object.fromEntries(BUCKETS.map((b) => [b, (h: HistoryPoint) => h.buckets[b]])),
      total: (h) => h.value,
      net: (h) => h.netContrib,
      gain: (h) => h.gain,
      gainPct: (h) => (h.netContrib > 0 ? h.gain / h.netContrib : null),
      biens: (h) => h.realEstate,
      credits: (h) => h.debts,
      patrimoineNet: (h) => h.netWorth,
    },
    { key: "mois", dir: "desc" },
  );
  return (
    <Table>
      <thead>
        <tr>
          <SortTh {...by("mois")}>Mois</SortTh>
          {used.map((b) => (
            <SortTh key={b} {...by(b)} align="right">
              {BUCKET_LABELS[b]}
            </SortTh>
          ))}
          <SortTh {...by("total")} align="right">Total</SortTh>
          <SortTh {...by("net")} align="right">Versé net</SortTh>
          <SortTh {...by("gain")} align="right">Gain</SortTh>
          <SortTh {...by("gainPct")} align="right">Gain (%)</SortTh>
          {withRealEstate && (
            <>
              <SortTh {...by("biens")} align="right">Biens</SortTh>
              <SortTh {...by("credits")} align="right">Crédits</SortTh>
              <SortTh {...by("patrimoineNet")} align="right">Patrimoine net</SortTh>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {sorted.map((h) => (
          <Tr key={h.month}>
            <Td>{capitalize(formatMonth(h.month))}</Td>
            {used.map((b) => (
              <Td key={b} align="right">
                <Amount value={h.buckets[b]} compact />
              </Td>
            ))}
            <Td align="right" className="font-medium"><Amount value={h.value} compact /></Td>
            <Td align="right"><Amount value={h.netContrib} compact /></Td>
            <Td align="right"><Amount value={h.gain} signed compact /></Td>
            <Td align="right"><Pct value={h.netContrib > 0 ? h.gain / h.netContrib : null} signed /></Td>
            {withRealEstate && (
              <>
                <Td align="right"><Amount value={h.realEstate} compact /></Td>
                <Td align="right"><Amount value={h.debts} compact /></Td>
                <Td align="right" className="font-medium"><Amount value={h.netWorth} compact /></Td>
              </>
            )}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
