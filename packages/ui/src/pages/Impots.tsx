import { Fragment } from "react";
import { accountTaxDetails, netYields, nextDeclarationYear, withdrawalTaxes, yearlyTaxes } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Notice, Pct } from "@/components/Stat";
import { DetailLine } from "@/components/DetailLine";
import { DetailRow, ExpandButton, Table, Td, Th, Tr, useExpandedRow } from "@/components/table";
import { Card, PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { SortTh, useSortable } from "@/lib/sort";
import type { AccountKind, AccountTaxDetail, WithdrawalTaxRow } from "@hamac/core";

export function Impots() {
  const pf = usePortfolio();
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const { data, state, crypto, today } = pf;
  const rows = withdrawalTaxes(data, state, crypto);
  const taxDetails = accountTaxDetails(data, state, crypto);
  const details = new Map(taxDetails.map((d) => [d.accountId, d]));
  const nextYear = nextDeclarationYear(today);
  const livret = (t: string) => pf.idx.activeAccounts.find((a) => a.livretType === t)?.rate ?? null;
  const yields = netYields(data.params, today, { lep: livret("LEP"), ldds: livret("LDDS") ?? livret("LIVRET_A") });
  const years = yearlyTaxes(data, crypto, today, state.disposals);
  const hasCrowd = years.some((y) => y.crowdReceived > 0);
  const hasGains = years.some((y) => y.securitiesGain > 0);
  const year = +today.slice(0, 4);

  return (
    <>
      <PageHeader title="Impôts" description="Estimations à partir des taux de Paramètres › Plan : à comparer chaque année avec la déclaration préremplie." />
      <div className="mb-6">
        <Notice>Les intérêts se saisissent tels qu'ils arrivent sur le compte (après prélèvements) : Hamac retrouve le brut et les impôts.</Notice>
      </div>

      <Section title={`1. À payer à la prochaine déclaration (revenus ${nextYear})`}>
        <NextDeclaration details={taxDetails} names={new Map(state.accounts.map((a) => [a.account.id, { name: a.account.name, kind: a.account.kind }]))} year={nextYear} current={nextYear === year} />
      </Section>

      <Section title="2. Si tout était retiré aujourd'hui">
        <p className="mb-3 text-sm text-fg-muted">Cliquez sur un compte pour voir ses impôts déjà payés, ceux qui restent à payer et le détail de chaque année.</p>
        <WithdrawalTable rows={rows} details={details} today={today} />
      </Section>

      <Section title="3. Rendement net comparé (avec les taux du moment)">
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

      <Section title="4. Impôts de chaque année (pour la déclaration)">
        <p className="mb-3 text-sm text-fg-muted">
          Livrets et PEA : rien à déclarer tant qu'on ne retire pas. Fonds euros : prélèvements sociaux retenus par l'assureur. Coupons et dividendes du compte-titres : prélèvements sociaux et acompte retenus par le courtier,
          puis régularisation à la déclaration (négatif = remboursement). Crypto : rien n'est retenu à la source, la plus-value se déclare (formulaire 2086). Compte-titres : la plus-value de l'année, après imputation des moins-values reportables.
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
              {hasGains && <Th align="right">Plus-values titres</Th>}
              {hasGains && <Th align="right">Impôt plus-values</Th>}
              {hasCrowd && <Th align="right">Crowdlending reçu</Th>}
              {hasCrowd && <Th align="right">Impôt crowdlending</Th>}
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <Tr key={y.year} className={cn(y.year === year && "bg-gold/10")}>
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
                {hasGains && (
                  <Td align="right">
                    <Amount value={y.securitiesGain} />
                  </Td>
                )}
                {hasGains && (
                  <Td align="right">
                    <Amount value={y.securitiesIncomeTax + y.securitiesSocial} />
                  </Td>
                )}
                {hasCrowd && (
                  <Td align="right">
                    <Amount value={y.crowdReceived} />
                  </Td>
                )}
                {hasCrowd && (
                  <Td align="right">
                    <Amount value={y.crowdWithheld + y.crowdDue} />
                    {y.crowdDue > 0 && (
                      <div className="text-xs text-fg-faint">
                        dont <Amount value={y.crowdDue} /> à payer
                      </div>
                    )}
                  </Td>
                )}
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

function WithdrawalTable({ rows, details, today }: { rows: WithdrawalTaxRow[]; details: Map<string, AccountTaxDetail>; today: string }) {
  const { isOpen, rowProps } = useExpandedRow();
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
        {sorted.map((r) => {
          const open = isOpen(r.accountId);
          const detail = details.get(r.accountId);
          return (
          <Fragment key={r.accountId}>
          <Tr {...rowProps(r.accountId)}>
            <Td className="font-medium whitespace-nowrap">
              <ExpandButton open={open} label={r.label} />
              {r.label}
            </Td>
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
          {open && detail && (
            <DetailRow cols={9}>
              <AccountTaxPanel detail={detail} gain={r.gain} withdrawalTax={r.tax} today={today} />
            </DetailRow>
          )}
          </Fragment>
          );
        })}
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

/** Ce que chaque type de compte fait payer à la déclaration. */
const DUE_REASON: Partial<Record<AccountKind, string>> = {
  crowdlending: "Intérêts dont la plateforme n'a pas prélevé les impôts",
  cto: "Impôt définitif des coupons et dividendes moins l'acompte, plus-values de cession",
  crypto: "Plus-value des ventes contre des euros (formulaire 2086)",
};

/** Impôt de la prochaine déclaration, compte par compte. */
function NextDeclaration({ details, names, year, current }: { details: AccountTaxDetail[]; names: Map<string, { name: string; kind: AccountKind }>; year: number; current: boolean }) {
  const rows = details
    .map((d) => ({ d, y: d.years.find((x) => x.year === year), who: names.get(d.accountId) }))
    .filter((r): r is typeof r & { y: NonNullable<typeof r.y>; who: NonNullable<typeof r.who> } => r.y != null && r.who != null && r.y.atDeclaration !== 0)
    .sort((a, b) => b.y.atDeclaration - a.y.atDeclaration);
  const total = rows.reduce((t, r) => t + r.y.atDeclaration, 0);
  const hasGains = rows.some((r) => r.y.realizedGain !== 0);
  return (
    <>
      <p className="mb-3 text-sm text-fg-muted">
        Impôt et prélèvements sociaux qui ne sont pas retenus par les établissements : ils arrivent sur l'avis d'impôt d'août {year + 1}, après la déclaration du printemps.
        {current && " Estimation en cours d'année, d'après les revenus et les ventes déjà au Journal."}
      </p>
      {rows.length === 0 ? (
        <Notice tone="ok">Rien à payer à la déclaration pour les revenus {year}, d'après le Journal.</Notice>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Compte</Th>
              <Th align="right">Revenus bruts</Th>
              {hasGains && <Th align="right">Plus-values</Th>}
              <Th align="right">Déjà retenu</Th>
              <Th align="right">À payer</Th>
              <Th>Pourquoi</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, y, who }) => (
              <Tr key={d.accountId}>
                <Td className="font-medium">{who.name}</Td>
                <Td align="right">
                  <Amount value={y.income} />
                </Td>
                {hasGains && (
                  <Td align="right">
                    <Amount value={y.realizedGain} signed />
                  </Td>
                )}
                <Td align="right">
                  <Amount value={y.atSource} />
                </Td>
                <Td align="right" className={cn("font-medium", y.atDeclaration < 0 && "text-positive")}>
                  <Amount value={y.atDeclaration} />
                </Td>
                <Td className="text-xs text-fg-muted">{DUE_REASON[who.kind] ?? ""}</Td>
              </Tr>
            ))}
            <tr className="bg-surface-2/60 font-medium">
              <Td>Total</Td>
              <Td />
              {hasGains && <Td />}
              <Td />
              <Td align="right" className={cn(total < 0 && "text-positive")}>
                <Amount value={total} />
              </Td>
              <Td className="text-xs text-fg-muted">{total < 0 ? "Remboursement attendu" : ""}</Td>
            </tr>
          </tbody>
        </Table>
      )}
    </>
  );
}

/** Détail fiscal d'un compte : ce qui est payé, ce qui reste, les repères et chaque année. */
function AccountTaxPanel({ detail, gain, withdrawalTax, today }: { detail: AccountTaxDetail; gain: number; withdrawalTax: number; today: string }) {
  const year = +today.slice(0, 4);
  const nextYear = nextDeclarationYear(today);
  // Les retenues à la source sont déjà sorties du compte ; l'impôt réglé avec l'avis est payé depuis la banque.
  const declared = detail.years.reduce((t, y) => t + y.atDeclaration, 0);
  const hasGains = detail.years.some((y) => y.realizedGain !== 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @5xl:grid-cols-4">
        <Figure label="Impôts déjà payés" sub="Retenus par l'établissement, et avis d'impôt déjà sortis (début août)">
          <Amount value={detail.paid} />
        </Figure>
        <Figure
          label="À payer à la prochaine déclaration"
          sub={
            detail.toPay !== detail.nextDeclaration ? (
              <>
                Revenus {nextYear}, puis <Amount value={detail.toPay - detail.nextDeclaration} /> pour {nextYear + 1}
              </>
            ) : (
              `Revenus ${nextYear}, avis d'août ${nextYear + 1} ; négatif = remboursement`
            )
          }
        >
          <Amount value={detail.nextDeclaration} />
        </Figure>
        <Figure label="En plus, si tout était retiré aujourd'hui" sub="Impôt sur le gain non encore imposé">
          <Amount value={withdrawalTax} />
        </Figure>
        <Figure label="Gain net de tous les impôts" sub="Gain, moins l'impôt des avis et celui d'un retrait aujourd'hui">
          <Amount value={gain - declared - withdrawalTax} signed />
        </Figure>
      </div>
      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="divide-y divide-line/60">
          {detail.facts.map((f) => (
            <div key={f.label}>
              <DetailLine label={f.label}>
                {f.amount != null ? <Amount value={f.amount} /> : f.pct != null ? <Pct value={f.pct} /> : f.date ? f.milestone ? <MilestoneDate date={f.date} today={today} /> : formatDate(f.date) : f.text}
              </DetailLine>
              {f.hint && <p className="-mt-1 pb-1.5 text-xs text-fg-faint">{f.hint}</p>}
            </div>
          ))}
          {detail.facts.length === 0 && <p className="py-1.5 text-sm text-fg-muted">Rien de particulier à signaler pour ce compte.</p>}
        </div>
        {detail.years.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <Th>Année</Th>
                  <Th align="right">Revenus bruts</Th>
                  {hasGains && <Th align="right">Plus-values</Th>}
                  <Th align="right">Retenu à la source</Th>
                  <Th align="right">À la déclaration</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {detail.years.map((y) => (
                  <tr key={y.year} className={cn(y.year === year && "bg-gold/10")}>
                    <Td className={cn(y.year === year && "font-semibold text-accent")}>{y.year}</Td>
                    <Td align="right">
                      <Amount value={y.income} />
                    </Td>
                    {hasGains && (
                      <Td align="right">
                        <Amount value={y.realizedGain} signed />
                      </Td>
                    )}
                    <Td align="right">
                      <Amount value={y.atSource} />
                    </Td>
                    <Td align="right" className={cn(y.atDeclaration < 0 && "text-positive")}>
                      <Amount value={y.atDeclaration} />
                      {y.atDeclaration !== 0 && <div className="text-xs text-fg-faint">{y.settled ? "payé" : `avis d'août ${y.year + 1}`}</div>}
                    </Td>
                    <Td align="right" className="font-medium">
                      <Amount value={y.total} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">Aucun revenu ni cession enregistré sur ce compte.</p>
        )}
      </div>
      {detail.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-fg-muted">
          {detail.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Figure({ label, sub, children }: { label: string; sub: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="text-lg font-semibold tracking-tight">{children}</div>
      <div className="text-xs text-fg-faint">{sub}</div>
    </div>
  );
}

/** Une échéance : sa date, et si elle est passée ou dans combien de temps. */
function MilestoneDate({ date, today }: { date: string; today: string }) {
  if (date <= today) return <span>{formatDate(date)}<span className="ml-1.5 text-xs text-positive">atteint</span></span>;
  const [y1, m1] = today.split("-").map(Number);
  const [y2, m2] = date.split("-").map(Number);
  const months = (y2! - y1!) * 12 + (m2! - m1!);
  const left = months >= 12 ? `${Math.floor(months / 12)} an${months >= 24 ? "s" : ""}${months % 12 ? ` et ${months % 12} mois` : ""}` : `${Math.max(1, months)} mois`;
  return (
    <span>
      {formatDate(date)}
      <span className="ml-1.5 text-xs text-fg-faint">dans {left}</span>
    </span>
  );
}
