import { ACCOUNT_KIND_LABELS, BUCKET_LABELS, BUCKETS, INVESTED_BUCKETS } from "@hamac/core";
import { useMemo } from "react";
import { Amount } from "@/components/Amount";
import { Chart, type ChartOption } from "@/components/Chart";
import { Notice, Pct, Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { BUCKET_COLORS, INK } from "@/lib/colors";
import { usePortfolio } from "@/lib/portfolio";
import { formatEur } from "@hamac/core";

const ACTION_LABEL = { ok: "OK", renforcer: "Renforcer", alleger: "Alléger (verser ailleurs)" } as const;

export function Synthese() {
  const pf = usePortfolio();
  const donut = useMemo<ChartOption | null>(() => {
    if (!pf) return null;
    const data = BUCKETS.map((b) => ({ name: BUCKET_LABELS[b], value: pf.state.buckets[b], itemStyle: { color: BUCKET_COLORS[b] } })).filter((d) => d.value > 0);
    return {
      tooltip: { trigger: "item", backgroundColor: INK.surface2, borderColor: INK.line, textStyle: { color: INK.fg }, valueFormatter: (v: unknown) => formatEur(Number(v), { compact: true }) },
      legend: { bottom: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: INK.muted } },
      series: [
        {
          type: "pie",
          radius: ["58%", "80%"],
          center: ["50%", "44%"],
          padAngle: 1,
          itemStyle: { borderColor: INK.surface, borderWidth: 2, borderRadius: 4 },
          label: { show: false },
          data,
        },
      ],
    };
  }, [pf]);

  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const { state } = pf;
  const rows = state.accounts.filter((a) => !a.account.archived || a.value !== 0);

  return (
    <>
      <PageHeader title="Synthèse des enveloppes" description="Tout est calculé depuis le journal : apports, versements mensuels passés et mouvements." />
      <StatGrid>
        <Stat label="Patrimoine total">
          <Amount value={state.totals.value} compact />
        </Stat>
        <Stat label="Versé net">
          <Amount value={state.totals.netContrib} compact />
        </Stat>
        <Stat label="Gain / perte" sub={<Pct value={state.totals.netContrib > 0 ? state.totals.gain / state.totals.netContrib : null} signed />}>
          <Amount value={state.totals.gain} signed compact />
        </Stat>
        <Stat label="Versements ce mois-ci">
          <Amount value={state.totals.monthly} compact />
        </Stat>
      </StatGrid>

      <Table className="mb-6">
        <thead>
          <tr>
            <Th>Compte</Th>
            <Th>Type</Th>
            <Th>Rôle</Th>
            <Th align="right">Apport initial</Th>
            <Th align="right">Versement mensuel</Th>
            <Th align="right">Valeur</Th>
            <Th align="right">Versé net</Th>
            <Th align="right">Gain / perte</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow cols={8}>Aucun compte.</EmptyRow>}
          {rows.map((a) => (
            <Tr key={a.account.id}>
              <Td className="font-medium">{a.account.name}</Td>
              <Td className="text-fg-muted">{ACCOUNT_KIND_LABELS[a.account.kind]}</Td>
              <Td className="max-w-64 truncate text-fg-muted">{a.account.role}</Td>
              <Td align="right">
                <Amount value={a.initial} compact />
              </Td>
              <Td align="right">
                <Amount value={a.currentMonthly} compact />
              </Td>
              <Td align="right" className="font-medium">
                <Amount value={a.value} />
              </Td>
              <Td align="right">
                <Amount value={a.netContrib} />
              </Td>
              <Td align="right">
                <Amount value={a.gain} signed />
              </Td>
            </Tr>
          ))}
          <tr className="bg-surface-2/60 font-medium">
            <Td>Total</Td>
            <Td />
            <Td />
            <Td align="right">
              <Amount value={rows.reduce((s, a) => s + a.initial, 0)} compact />
            </Td>
            <Td align="right">
              <Amount value={state.totals.monthly} compact />
            </Td>
            <Td align="right">
              <Amount value={state.totals.value} />
            </Td>
            <Td align="right">
              <Amount value={state.totals.netContrib} />
            </Td>
            <Td align="right">
              <Amount value={state.totals.gain} signed />
            </Td>
          </tr>
        </tbody>
      </Table>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle hint={`Âge ${state.age} ans · seuil d'alerte ${Math.round(pf.data.params.livrets.driftAlert * 100)} points`}>Allocation de la partie investie (hors livrets et crypto)</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Poche</Th>
                <Th align="right">Valeur</Th>
                <Th align="right">Part réelle</Th>
                <Th align="right">Part cible</Th>
                <Th align="right">Écart</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {state.allocation.rows.map((r) => (
                <Tr key={r.bucket}>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ background: BUCKET_COLORS[r.bucket] }} />
                      {BUCKET_LABELS[r.bucket]}
                    </span>
                  </Td>
                  <Td align="right">
                    <Amount value={r.value} compact />
                  </Td>
                  <Td align="right">
                    <Pct value={r.share} />
                  </Td>
                  <Td align="right">
                    <Pct value={r.target} />
                  </Td>
                  <Td align="right">
                    <Pct value={r.drift} signed />
                  </Td>
                  <Td>
                    <Badge tone={r.action === "ok" ? "positive" : "accent"}>{ACTION_LABEL[r.action]}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-fg-faint">
            Partie investie : <Amount value={state.allocation.invested} compact /> ({INVESTED_BUCKETS.map((b) => BUCKET_LABELS[b].toLowerCase()).join(", ")}). On rééquilibre en orientant les versements, sans vendre.
          </p>
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle>Répartition du patrimoine</CardTitle>
          {donut && <Chart option={donut} height={260} />}
        </Card>
      </div>

      <div className="mt-5">
        <LivretsStatus />
      </div>
    </>
  );
}

export function LivretsStatus() {
  const pf = usePortfolio();
  if (!pf) return null;
  const l = pf.state.livrets;
  if (l.status === "sous_plancher")
    return (
      <Notice tone="warning">
        ⚠ Livrets sous le plancher (<Amount value={l.total} compact /> pour {formatEur(l.floor, { compact: true })}) : reconstituer avant tout autre placement.
      </Notice>
    );
  if (l.status === "au_dessus")
    return (
      <Notice tone="warning">
        → Livrets au-dessus du plafond : transférer <Amount value={l.excess} compact /> vers le fonds euros.
      </Notice>
    );
  return (
    <Notice tone="ok">
      ✓ Livrets dans la fourchette du plan ({formatEur(l.floor, { compact: true })} – {formatEur(l.ceiling, { compact: true })}).
    </Notice>
  );
}
