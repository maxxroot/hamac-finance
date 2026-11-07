import { Amount } from "@/components/Amount";
import { Notice, Pct } from "@/components/Stat";
import { Table, Td, Th, Tr } from "@/components/table";
import { PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { usePortfolio } from "@/lib/portfolio";

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
      <Table>
        <thead>
          <tr>
            <Th>Enveloppe</Th>
            <Th align="right">Valeur</Th>
            <Th align="right">Versé net</Th>
            <Th align="right">Gain (€)</Th>
            <Th align="right">Gain (%)</Th>
            <Th align="right">Rendement annualisé</Th>
            <Th align="right">Hypothèse du plan</Th>
            <Th align="right">Écart</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
          ))}
        </tbody>
      </Table>
    </>
  );
}
