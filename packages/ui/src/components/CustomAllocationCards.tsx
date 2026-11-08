import { Link } from "react-router";
import type { AllocationStatus } from "@hamac/core";
import { Amount } from "./Amount";
import { Pct } from "./Stat";
import { Table, Td, Th, Tr } from "./table";
import { Badge, Card, CardTitle } from "./ui";
import { useAllocationReport } from "@/lib/allocations";

/** Avancement vers la limite d'une ligne : barre fine + montants, ou « limite atteinte ». */
function LimitProgress({ r }: { r: AllocationStatus }) {
  if (!r.rule.limit) return <span className="text-fg-faint">sans fin</span>;
  if (r.done) return <Badge tone="positive">✓ limite atteinte</Badge>;
  const reached = r.rule.limit.basis === "verse" ? r.deposited : r.value;
  return (
    <div className="min-w-40">
      <div className="flex justify-between gap-3 text-xs text-fg-muted">
        <span>
          <Amount value={reached} compact /> / <Amount value={r.rule.limit.amount} compact />
        </span>
        <span>{r.rule.limit.basis === "verse" ? "versés" : "de valeur"}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((r.progress ?? 0) * 100)}%` }} />
      </div>
    </div>
  );
}

const editLink = (
  <Link to="/parametres?onglet=Répartition" className="text-accent hover:underline">
    Paramètres › Répartition
  </Link>
);

/** Versements : répartition conseillée des versements mensuels selon les lignes « part des versements ». */
export function ContributionSplitCard() {
  const report = useAllocationReport();
  const rows = report?.rows ?? [];
  if (!report || rows.length === 0) return null;
  const advised = rows.reduce((t, r) => t + r.advisedMonthly, 0);
  return (
    <Card className="mb-6">
      <CardTitle hint={<>sur <Amount value={report.monthlyBase} compact /> programmés par mois · modifiables dans {editLink}</>}>Répartition conseillée des versements</CardTitle>
      {report.monthlyBase === 0 ? (
        <p className="text-sm text-fg-muted">Programmez des versements pour voir la répartition conseillée.</p>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Ligne</Th>
                <Th align="right">Part</Th>
                <Th align="right">Conseillé / mois</Th>
                <Th align="right">Programmé / mois</Th>
                <Th align="right">Écart</Th>
                <Th>Limite</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const gap = r.programmedMonthly - r.advisedMonthly;
                return (
                  <Tr key={r.rule.id}>
                    <Td>{r.name}</Td>
                    <Td align="right">
                      <Pct value={r.contributionShare} />
                    </Td>
                    <Td align="right" className="font-medium">
                      <Amount value={r.advisedMonthly} />
                    </Td>
                    <Td align="right">
                      <Amount value={r.programmedMonthly} />
                    </Td>
                    <Td align="right" className={Math.abs(gap) > Math.max(5, 0.1 * r.advisedMonthly) ? "text-warning" : "text-fg-muted"}>
                      <Amount value={gap} signed />
                    </Td>
                    <Td>
                      <LimitProgress r={r} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          {report.monthlyBase - advised > 0.5 && (
            <p className="mt-3 text-xs text-fg-faint">
              <Amount value={report.monthlyBase - advised} /> par mois sans consigne : à répartir librement.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
