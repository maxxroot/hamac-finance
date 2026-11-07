import { Amount } from "@/components/Amount";
import { Notice, Pct } from "@/components/Stat";
import { Table, Td, Tr } from "@/components/table";
import { PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { usePortfolio } from "@/lib/portfolio";
import { SortTh, useSortable } from "@/lib/sort";
import type { PerformanceRow } from "@hamac/core";

export function Performance() {
  const pf = usePortfolio();
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const rows = pf.state.performance;
  return (
    <>
      <PageHeader title="Performance" description="Ce que l'argent a réellement rapporté, enveloppe par enveloppe." />
      <div className="mb-5">
        <Notice>
          Le <b className="text-fg">rendement annualisé</b> (TRI) tient compte de la date de chaque versement. Il s'affiche après un an d'historique : sur quelques jours, annualiser n'a pas de sens (+5 % en une semaine
          ferait +1 000 % par an). Les transferts entre enveloppes comptent pour chaque enveloppe, mais pas pour le total.
        </Notice>
      </div>
      <PerfTable rows={rows} />
    </>
  );
}

function PerfTable({ rows }: { rows: PerformanceRow[] }) {
  const total = rows.find((r) => r.key === "total");
  const { sorted, by } = useSortable(
    rows.filter((r) => r.key !== "total"),
    {
      label: (r) => r.label,
      value: (r) => r.value,
      net: (r) => r.netContrib,
      gain: (r) => r.gain,
      gainPct: (r) => r.gainPct,
      irr: (r) => r.irr,
      hyp: (r) => r.assumption,
      ecart: (r) => (r.irr != null && r.assumption != null ? r.irr - r.assumption : null),
    },
  );
  const line = (r: PerformanceRow) => (
    <Tr key={r.key} className={r.key === "total" ? "bg-surface-2/60 font-medium" : undefined}>
      <Td>{r.label}</Td>
      <Td align="right">
        <Amount value={r.value} />
      </Td>
      <Td align="right">
        <Amount value={r.netContrib} />
      </Td>
      <Td align="right">
        <Amount value={r.gain} signed />
      </Td>
      <Td align="right">
        <Pct value={r.gainPct} signed />
      </Td>
      <Td align="right" title={r.irrReason ?? undefined}>
        {r.irr != null ? <Pct value={r.irr} signed /> : <span className="text-xs text-fg-faint">{r.irrReason}</span>}
      </Td>
      <Td align="right">{r.assumption != null ? <Pct value={r.assumption} /> : "—"}</Td>
      <Td align="right">{r.irr != null && r.assumption != null ? <Pct value={r.irr - r.assumption} signed /> : "—"}</Td>
    </Tr>
  );
  return (
    <Table>
      <thead>
        <tr>
          <SortTh {...by("label")}>Enveloppe</SortTh>
          <SortTh {...by("value")} align="right">Valeur</SortTh>
          <SortTh {...by("net")} align="right">Versé net</SortTh>
          <SortTh {...by("gain")} align="right">Gain (€)</SortTh>
          <SortTh {...by("gainPct")} align="right">Gain (%)</SortTh>
          <SortTh {...by("irr")} align="right">Rendement annualisé</SortTh>
          <SortTh {...by("hyp")} align="right">Hypothèse du plan</SortTh>
          <SortTh {...by("ecart")} align="right">Écart</SortTh>
        </tr>
      </thead>
      <tbody>
        {sorted.map(line)}
        {total && line(total)}
      </tbody>
    </Table>
  );
}
