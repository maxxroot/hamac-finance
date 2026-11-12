import { Fragment } from "react";
import { type EnvelopePerformance } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { ExpandButton, Table, Td, Tr, useExpandedRow } from "@/shared/components/table";
import { SortTh, useSortable } from "@/shared/lib/sort";

export function EnvelopeCells({ r, wholeHistory }: { r: EnvelopePerformance; wholeHistory: boolean }) {
  return (
    <>
      <Td align="right"><Amount value={r.value} /></Td>
      <Td align="right"><Amount value={r.inflow} /></Td>
      <Td align="right"><Amount value={r.gain} signed /></Td>
      <Td align="right"><Pct value={r.gainPct} signed /></Td>
      <Td align="right" title={r.annualizedReason ?? undefined}>
        {r.annualized != null ? <Pct value={r.annualized} signed /> : <span className="text-xs text-fg-faint">{r.annualizedReason}</span>}
      </Td>
      <Td align="right">{r.assumption != null ? <Pct value={r.assumption} /> : "—"}</Td>
      <Td align="right">{r.annualized != null && r.assumption != null ? <Pct value={r.annualized - r.assumption} signed /> : "—"}</Td>
      {wholeHistory && <Td align="right"><Amount value={r.afterTax} signed /></Td>}
    </>
  );
}

export function EnvelopeTable({ rows, wholeHistory }: { rows: readonly EnvelopePerformance[]; wholeHistory: boolean }) {
  const total = rows.find((r) => r.key === "total");
  const { isOpen, rowProps } = useExpandedRow();
  const { sorted, by } = useSortable(
    rows.filter((r) => r.key !== "total"),
    {
      label: (r) => r.label,
      value: (r) => r.value,
      net: (r) => r.inflow,
      gain: (r) => r.gain,
      gainPct: (r) => r.gainPct,
      irr: (r) => r.annualized,
      hyp: (r) => r.assumption,
      ecart: (r) => (r.annualized != null && r.assumption != null ? r.annualized - r.assumption : null),
      tax: (r) => r.afterTax,
    },
  );
  return (
    <Table>
      <thead>
        <tr>
          <SortTh {...by("label")}>Enveloppe ou placement</SortTh>
          <SortTh {...by("value")} align="right">Valeur</SortTh>
          <SortTh {...by("net")} align="right">{wholeHistory ? "Montant investi" : "Versé sur la période"}</SortTh>
          <SortTh {...by("gain")} align="right">Gain (€)</SortTh>
          <SortTh {...by("gainPct")} align="right">Gain (%)</SortTh>
          <SortTh {...by("irr")} align="right">Rendement annualisé</SortTh>
          <SortTh {...by("hyp")} align="right">Hypothèse du plan</SortTh>
          <SortTh {...by("ecart")} align="right">Écart</SortTh>
          {wholeHistory && <SortTh {...by("tax")} align="right">Gain après impôts</SortTh>}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <Fragment key={r.key}>
            <Tr {...rowProps(r.key)}>
              <Td className="font-medium whitespace-nowrap">
                <ExpandButton open={isOpen(r.key)} label={r.label} />
                {r.label}
              </Td>
              <EnvelopeCells r={r} wholeHistory={wholeHistory} />
            </Tr>
            {isOpen(r.key) &&
              r.accounts.map((a) => (
                <Tr key={a.key} className="bg-surface-2/40 text-fg-muted">
                  <Td className="pl-9 whitespace-nowrap">{a.label}</Td>
                  <EnvelopeCells r={a} wholeHistory={wholeHistory} />
                </Tr>
              ))}
          </Fragment>
        ))}
        {total && (
          <Tr className="bg-surface-2/60 font-medium">
            <Td>{total.label}</Td>
            <EnvelopeCells r={total} wholeHistory={wholeHistory} />
          </Tr>
        )}
      </tbody>
    </Table>
  );
}
