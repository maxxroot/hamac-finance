import { netYields, withdrawalTaxes, yearlyTaxes } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Notice, Pct } from "@/components/Stat";
import { Table, Td, Th, Tr } from "@/components/table";
import { Card, PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { cn } from "@/lib/cn";
import { usePortfolio } from "@/lib/portfolio";
import { SortTh, useSortable } from "@/lib/sort";
import type { WithdrawalTaxRow } from "@hamac/core";

export function Impots() {
  const pf = usePortfolio();
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const { data, state, crypto, today } = pf;
  const rows = withdrawalTaxes(data, state, crypto);
  const livret = (t: string) => pf.idx.activeAccounts.find((a) => a.livretType === t)?.rate ?? null;
  const yields = netYields(data.params, today, { lep: livret("LEP"), ldds: livret("LDDS") ?? livret("LIVRET_A") });
  const years = yearlyTaxes(data, crypto, today);
  const year = +today.slice(0, 4);

  return (
    <>
      <PageHeader title="Impôts" description="Estimations à partir des taux de Paramètres › Plan : à comparer chaque année avec la déclaration préremplie." />
      <div className="mb-6">
        <Notice>Les intérêts se saisissent tels qu'ils arrivent sur le compte (après prélèvements) : Hamac retrouve le brut et les impôts.</Notice>
      </div>

      <Section title="1. Si tout était retiré aujourd'hui">
        <WithdrawalTable rows={rows} />
      </Section>

      <Section title="2. Rendement net comparé (avec les taux du moment)">
        <Table>
          <thead>
            <tr>
              <Th>Placement</Th>
              <Th align="right">Rendement brut</Th>
              <Th>Fiscalité appliquée</Th>
              <Th align="right">Rendement net estimé</Th>
            </tr>
          </thead>
          <tbody>
            {yields.map((y) => (
              <Tr key={y.label}>
                <Td className="font-medium">{y.label}</Td>
                <Td align="right">{y.gross != null ? <Pct value={y.gross} /> : "—"}</Td>
                <Td className="text-xs text-fg-muted">{y.taxation}</Td>
                <Td align="right" className="font-medium">
                  {y.net != null ? <Pct value={y.net} /> : "—"}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title="3. Impôts de chaque année (pour la déclaration)">
        <p className="mb-3 text-sm text-fg-muted">
          Livrets et PEA : rien à déclarer tant qu'on ne retire pas. Fonds euros : prélèvements sociaux retenus par l'assureur. Coupons et dividendes du compte-titres : prélèvements sociaux et acompte retenus par le courtier,
          puis régularisation à la déclaration (négatif = remboursement). Crypto : rien n'est retenu à la source, la plus-value se déclare (formulaire 2086).
        </p>
        <Table>
          <thead>
            <tr>
              <Th>Année</Th>
              <Th align="right">Intérêts fonds euros</Th>
              <Th align="right">PS fonds euros</Th>
              <Th align="right">Coupons reçus</Th>
              <Th align="right">Coupons bruts</Th>
              <Th align="right">PS coupons</Th>
              <Th align="right">Acompte retenu</Th>
              <Th align="right">Impôt définitif</Th>
              <Th align="right">Régularisation</Th>
              <Th align="right">Crypto (IR + PS)</Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <Tr key={y.year} className={cn(y.year === year && "bg-accent/10")}>
                <Td className={cn(y.year === year && "font-semibold text-accent")}>{y.year}</Td>
                <Td align="right">
                  <Amount value={y.avInterestNet} />
                </Td>
                <Td align="right">
                  <Amount value={y.avSocial} />
                </Td>
                <Td align="right">
                  <Amount value={y.couponsNet} />
                </Td>
                <Td align="right">
                  <Amount value={y.couponsGross} />
                </Td>
                <Td align="right">
                  <Amount value={y.couponsSocial} />
                </Td>
                <Td align="right">
                  <Amount value={y.withholding} />
                </Td>
                <Td align="right">
                  <Amount value={y.couponsIncomeTax} />
                </Td>
                <Td align="right" className={cn(y.regularisation < 0 && "text-positive")}>
                  <Amount value={y.regularisation} />
                </Td>
                <Td align="right">
                  <Amount value={y.cryptoIncomeTax + y.cryptoSocial} />
                </Td>
                <Td align="right" className="font-medium">
                  <Amount value={y.total} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-6">
      <h2 className="mb-4 font-medium">{title}</h2>
      {children}
    </Card>
  );
}

/** Gain rapporté à l'argent versé (valeur − gain). */
const gainPct = (value: number, gain: number) => (value - gain > 0 ? gain / (value - gain) : null);

function WithdrawalTable({ rows }: { rows: WithdrawalTaxRow[] }) {
  const total = { value: rows.reduce((s, r) => s + r.value, 0), gain: rows.reduce((s, r) => s + r.gain, 0), tax: rows.reduce((s, r) => s + r.tax, 0) };
  const { sorted, by } = useSortable(rows, {
    compte: (r) => r.label,
    valeur: (r) => r.value,
    gain: (r) => r.gain,
    gainPct: (r) => gainPct(r.value, r.gain),
    impot: (r) => r.tax,
    net: (r) => r.value - r.tax,
    gainNet: (r) => r.gain - r.tax,
    gainNetPct: (r) => (r.value - r.gain > 0 ? (r.gain - r.tax) / (r.value - r.gain) : null),
    regime: (r) => r.regime,
  });
  return (
    <Table>
      <thead>
        <tr>
          <SortTh {...by("compte")}>Compte</SortTh>
          <SortTh {...by("valeur")} align="right">Valeur</SortTh>
          <SortTh {...by("gain")} align="right">Gain brut</SortTh>
          <SortTh {...by("gainPct")} align="right">(%)</SortTh>
          <SortTh {...by("impot")} align="right">Impôt à payer</SortTh>
          <SortTh {...by("net")} align="right">Valeur nette</SortTh>
          <SortTh {...by("gainNet")} align="right">Gain net</SortTh>
          <SortTh {...by("gainNetPct")} align="right">(%)</SortTh>
          <SortTh {...by("regime")}>Régime appliqué</SortTh>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <Tr key={r.accountId}>
            <Td className="font-medium">{r.label}</Td>
            <Td align="right">
              <Amount value={r.value} />
            </Td>
            <Td align="right">
              <Amount value={r.gain} signed />
            </Td>
            <Td align="right">
              <Pct value={gainPct(r.value, r.gain)} signed />
            </Td>
            <Td align="right">
              <Amount value={r.tax} />
            </Td>
            <Td align="right">
              <Amount value={r.value - r.tax} />
            </Td>
            <Td align="right">
              <Amount value={r.gain - r.tax} signed />
            </Td>
            <Td align="right">
              <Pct value={r.value - r.gain > 0 ? (r.gain - r.tax) / (r.value - r.gain) : null} signed />
            </Td>
            <Td className="text-xs text-fg-muted">{r.regime}</Td>
          </Tr>
        ))}
        <tr className="bg-surface-2/60 font-medium">
          <Td>Total</Td>
          <Td align="right">
            <Amount value={total.value} />
          </Td>
          <Td align="right">
            <Amount value={total.gain} signed />
          </Td>
          <Td align="right">
            <Pct value={gainPct(total.value, total.gain)} signed />
          </Td>
          <Td align="right">
            <Amount value={total.tax} />
          </Td>
          <Td align="right">
            <Amount value={total.value - total.tax} />
          </Td>
          <Td align="right">
            <Amount value={total.gain - total.tax} signed />
          </Td>
          <Td align="right">
            <Pct value={total.value - total.gain > 0 ? (total.gain - total.tax) / (total.value - total.gain) : null} signed />
          </Td>
          <Td className="text-xs text-fg-muted">
            Taux moyen d'imposition des gains : <Pct value={total.gain > 0 ? total.tax / total.gain : 0} />
          </Td>
        </tr>
      </tbody>
    </Table>
  );
}
