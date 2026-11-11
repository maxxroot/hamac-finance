import { ACCOUNT_KIND_LABELS } from "@hamac/core";
import { Fragment } from "react";
import { SortTh, useSortable } from "@/lib/sort";
import type { AccountState, PortfolioState } from "@hamac/core";
import { AccountEvolution, EnvelopesEvolution } from "@/components/AccountEvolution";
import { Amount } from "@/components/Amount";
import { ProtectionCard } from "@/components/ProtectionCard";
import { Notice, Pct } from "@/components/Stat";
import { DetailRow, EmptyRow, ExpandButton, Table, Td, Th, Tr, useExpandedRow } from "@/components/table";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { BUCKET_COLORS } from "@/lib/colors";
import { usePortfolio } from "@/lib/portfolio";
import { formatEur } from "@hamac/core";

const ACTION_LABEL = { ok: "OK", renforcer: "Renforcer", alleger: "Alléger (verser ailleurs)" } as const;

export function Synthese() {
  const pf = usePortfolio();
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const { state } = pf;
  const rows = state.accounts.filter((a) => !a.account.archived || a.value !== 0);

  return (
    <>
      <PageHeader title="Synthèse des enveloppes" description="Tout est calculé depuis le journal : apports, versements mensuels passés et mouvements." />
      <AccountsTable rows={rows} totals={state.totals} />

      <Card className="mb-6">
        <CardTitle hint="Cliquer sur la légende masque ou réaffiche une courbe">Évolution par enveloppe</CardTitle>
        <EnvelopesEvolution className="p-0" />
      </Card>

      <ProtectionCard />

      <Card>
          <CardTitle hint={`Âge ${state.age} ans · alerte au-delà de ${Math.round(pf.data.params.livrets.driftAlert * 100)} % d'écart`}>Allocation de la partie investie</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Classe d'actifs</Th>
                <Th align="right">Valeur</Th>
                <Th align="right">Part réelle</Th>
                <Th align="right">Part cible</Th>
                <Th align="right">Écart</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {state.allocation.rows.map((r) => (
                <Tr key={r.key}>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ background: r.color ?? BUCKET_COLORS[r.bucket!] }} />
                      {r.label}
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
            Partie investie : <Amount value={state.allocation.invested} compact /> (réglée dans Paramètres › Répartition). On rééquilibre en orientant les versements, sans vendre.
          </p>
      </Card>

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

/** Tableau des comptes, triable par colonne, avec la plus-value en %. */
function AccountsTable({ rows, totals }: { rows: AccountState[]; totals: PortfolioState["totals"] }) {
  const { isOpen, rowProps } = useExpandedRow();
  const pct = (a: { gain: number; netContrib: number }) => (a.netContrib > 0 ? a.gain / a.netContrib : null);
  const { sorted, by } = useSortable(rows, {
    name: (a) => a.account.name,
    role: (a) => a.account.role,
    share: (a) => a.value,
    monthly: (a) => a.currentMonthly,
    value: (a) => a.value,
    net: (a) => a.netContrib,
    gain: (a) => a.gain,
    gainPct: (a) => pct(a),
  });
  return (
    <Table className="mb-6">
      <thead>
        <tr>
          <SortTh {...by("name")}>Compte</SortTh>
          <SortTh {...by("role")}>Rôle</SortTh>
          <SortTh {...by("monthly")} align="right">
            Versement mensuel
          </SortTh>
          <SortTh {...by("value")} align="right">
            Valeur
          </SortTh>
          <SortTh {...by("share")} align="right">
            Part du patrimoine
          </SortTh>
          <SortTh {...by("net")} align="right">
            Versé net
          </SortTh>
          <SortTh {...by("gain")} align="right">
            Gain / perte
          </SortTh>
          <SortTh {...by("gainPct")} align="right">
            Gain (%)
          </SortTh>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow cols={8}>Aucun compte.</EmptyRow>}
        {sorted.map((a) => (
          <Fragment key={a.account.id}>
          <Tr {...rowProps(a.account.id)}>
            <Td className="font-medium whitespace-nowrap">
              <ExpandButton open={isOpen(a.account.id)} label={a.account.name} />
              {a.account.name}
              {a.account.name !== ACCOUNT_KIND_LABELS[a.account.kind] && <div className="ml-[21px] text-xs font-normal text-fg-faint">{ACCOUNT_KIND_LABELS[a.account.kind]}</div>}
            </Td>
            <Td className="max-w-56 truncate text-fg-muted" title={a.account.role}>
              {a.account.role}
            </Td>
            <Td align="right">
              <Amount value={a.currentMonthly} compact />
            </Td>
            <Td align="right" className="font-medium">
              <Amount value={a.value} />
            </Td>
            <Td align="right">
              <Pct value={totals.value > 0 ? a.value / totals.value : null} />
            </Td>
            <Td align="right">
              <Amount value={a.netContrib} />
            </Td>
            <Td align="right">
              <Amount value={a.gain} signed />
            </Td>
            <Td align="right">
              <Pct value={pct(a)} signed />
            </Td>
          </Tr>
          {isOpen(a.account.id) && (
            <DetailRow cols={8}>
              <AccountEvolution accountIds={[a.account.id]} />
            </DetailRow>
          )}
          </Fragment>
        ))}
        <tr className="bg-surface-2/60 font-medium">
          <Td>Total</Td>
          <Td />
          <Td align="right">
            <Amount value={totals.monthly} compact />
          </Td>
          <Td align="right">
            <Amount value={totals.value} />
          </Td>
          <Td align="right">
            <Pct value={totals.value > 0 ? 1 : null} />
          </Td>
          <Td align="right">
            <Amount value={totals.netContrib} />
          </Td>
          <Td align="right">
            <Amount value={totals.gain} signed />
          </Td>
          <Td align="right">
            <Pct value={pct(totals)} signed />
          </Td>
        </tr>
      </tbody>
    </Table>
  );
}
