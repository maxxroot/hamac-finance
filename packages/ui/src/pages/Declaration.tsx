import { Download, Printer } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  buildTaxReport,
  compareWithStatement,
  MODE_LABELS,
  reportTotalsMismatches,
  rulesValidityLabel,
  STATUS_LABELS,
  TAX_DISCLAIMER,
  taxReportAlerts,
  taxReportCsvRows,
  taxReportYears,
  type ConsolidatedLine,
  type FiscalYearRules,
  type TaxAlert,
  type TaxLine,
  type TaxReport,
  type TaxSheet,
  type TaxStatementAmount,
  type TaxStatus,
} from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Field, MoneyInput, Select } from "@/components/form";
import { Notice } from "@/components/Stat";
import { Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { downloadText, toCsv } from "@/lib/files";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";
import { Onboarding } from "@/pages/Onboarding";

const COMPLETE = "complet";

export function Declaration() {
  const pf = usePortfolio();
  const [chosenYear, setYear] = useState<number | null>(null);
  const [chosenDoc, setDoc] = useState(COMPLETE);
  const years = useMemo(() => (pf ? taxReportYears(pf.data, pf.today) : []), [pf]);
  // Par défaut : la dernière année terminée, celle qui se déclare.
  const year = chosenYear ?? (pf && years.includes(+pf.today.slice(0, 4) - 1) ? +pf.today.slice(0, 4) - 1 : (years[0] ?? 0));
  const report = useMemo(() => (pf ? buildTaxReport(pf.data, pf.state.disposals, pf.crypto, year) : null), [pf, year]);
  const alerts = useMemo(() => (pf && report ? taxReportAlerts(report, pf.data, pf.state.disposals, pf.idx.ws.taxStatements) : []), [pf, report]);
  if (!pf || !report) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;

  const fiches = report.sheets.filter((s) => s.mode === "a_saisir");
  const sheet = fiches.find((s) => s.key === chosenDoc) ?? null;
  const exportCsv = () => downloadText(`recapitulatif-fiscal-${year}.csv`, toCsv(taxReportCsvRows(report)), "text/csv;charset=utf-8");

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Aide à la déclaration"
          description="Ce qu'il faut reporter, dans quelle case, et d'après quelles opérations."
          actions={
            <>
              <Button onClick={exportCsv}>
                <Download size={15} /> Détail (CSV)
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                <Printer size={15} /> Imprimer ou enregistrer en PDF
              </Button>
            </>
          }
        />
        <div className="mb-6 flex flex-wrap gap-4">
          <Field label="Année de revenus" className="w-44">
            {(id) => (
              <Select id={id} value={year} onChange={(e) => setYear(+e.target.value)}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Document" className="w-80">
            {(id) => (
              <Select id={id} value={sheet ? sheet.key : COMPLETE} onChange={(e) => setDoc(e.target.value)}>
                <option value={COMPLETE}>Récapitulatif fiscal complet</option>
                {fiches.map((s) => (
                  <option key={s.key} value={s.key}>
                    Récapitulatif fiscal – {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {fiches.length === 0 && (
          <div className="mb-6">
            <Notice>
              Aucun récapitulatif par établissement pour cette année : cochez la case sur la fiche de l'établissement, dans <Link className="underline" to="/parametres">Paramètres › Établissements</Link>.
            </Notice>
          </div>
        )}
      </div>

      <DocumentHeader title={sheet ? `Récapitulatif fiscal – ${sheet.name}` : "Récapitulatif fiscal complet"} rules={report.rules} today={pf.today} mode={sheet ? MODE_LABELS[sheet.mode] : null} />
      <Controls alerts={sheet ? alerts.filter((a) => a.sheetKey === sheet.key) : alerts} consistent={sheet ? null : reportTotalsMismatches(report).length === 0} />
      {sheet ? <SheetView key={`${sheet.key}-${year}`} sheet={sheet} rules={report.rules} statements={pf.idx.ws.taxStatements} /> : <CompleteView report={report} onOpen={setDoc} />}
    </>
  );
}

function DocumentHeader({ title, rules, today, mode }: { title: string; rules: FiscalYearRules; today: string; mode: string | null }) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {mode && <Badge tone="accent">{mode}</Badge>}
      </div>
      <p className="text-sm font-medium">
        Revenus {rules.incomeYear} · Déclaration {rules.declarationYear} · Édité le {formatDate(today)}
      </p>
      <div className="mt-3 space-y-2">
        <Notice tone={rules.covered ? "info" : "warning"}>{rulesValidityLabel(rules)}</Notice>
        <Notice>{TAX_DISCLAIMER}</Notice>
      </div>
    </div>
  );
}

function Controls({ alerts, consistent }: { alerts: readonly TaxAlert[]; consistent: boolean | null }) {
  if (alerts.length === 0 && consistent === null) return null;
  return (
    <div className="mb-6 space-y-2">
      {consistent && <Notice tone="ok">Contrôle de cohérence : la somme des fiches correspond au récapitulatif.</Notice>}
      {alerts.length > 0 && (
        <Notice tone="warning">
          <div className="mb-1.5 font-medium">{alerts.length > 1 ? `${alerts.length} points à contrôler` : "1 point à contrôler"}</div>
          <ul className="list-disc space-y-1 pl-5">
            {alerts.map((a) => (
              <li key={a.message} className={a.level === "erreur" ? "text-negative" : undefined}>
                {a.message}
              </li>
            ))}
          </ul>
        </Notice>
      )}
    </div>
  );
}

function Status({ status }: { status: TaxStatus }) {
  return <Badge tone={status === "calcule" ? "positive" : status === "a_verifier" ? "accent" : "negative"}>{STATUS_LABELS[status]}</Badge>;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mb-6">
      <h3 className="mb-4 font-medium">{title}</h3>
      {children}
    </Card>
  );
}

function BoxCell({ line, covered }: { line: Pick<TaxLine, "rule">; covered: boolean }) {
  return (
    <Td className="font-semibold whitespace-nowrap">
      {line.rule.box}
      {!covered && <span className="ml-1 text-xs font-normal text-fg-faint">indicative</span>}
    </Td>
  );
}

function Notes({ notes }: { notes: readonly string[] }) {
  if (notes.length === 0) return null;
  return <div className="mt-1 text-xs text-fg-faint">{notes.join(" ")}</div>;
}

function CompleteView({ report, onOpen }: { report: TaxReport; onOpen: (key: string) => void }) {
  const { lines, sheets, securities, crypto, others, reminders, rules } = report;
  const incomeOf = (s: TaxSheet) => s.lines.filter((l) => l.key === "dividendes" || l.key === "interets" || l.key === "crowdlending").reduce((t, l) => t + l.amount, 0);
  const prepaid = (s: TaxSheet) => s.lines.find((l) => l.key === "acompte")?.amount ?? 0;
  return (
    <>
      <Block title="Cases à reporter">
        {lines.length === 0 ? (
          <p className="text-sm text-fg-muted">Aucun montant à reporter pour cette année dans les comptes suivis.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Case</Th>
                <Th>Formulaire</Th>
                <Th>Libellé</Th>
                <Th align="right">À saisir</Th>
                <Th align="right">À contrôler avec l'IFU</Th>
                <Th align="right">Total</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l: ConsolidatedLine) => (
                <Tr key={l.key}>
                  <BoxCell line={l} covered={rules.covered} />
                  <Td>{l.rule.form}</Td>
                  <Td>
                    {l.rule.label}
                    <Notes notes={l.notes} />
                  </Td>
                  <Td align="right">{l.toEnter == null ? <span className="text-xs text-fg-faint">global</span> : <Amount value={l.toEnter} />}</Td>
                  <Td align="right">{l.toCheck == null ? <span className="text-xs text-fg-faint">global</span> : <Amount value={l.toCheck} />}</Td>
                  <Td align="right" className="font-medium">
                    <Amount value={l.total} />
                  </Td>
                  <Td>
                    <Status status={l.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="mt-3 text-xs text-fg-faint">Les montants « à contrôler » proviennent normalement déjà de l'IFU de l'établissement : ne les ajoutez pas une seconde fois.</p>
      </Block>

      {sheets.length > 0 && (
        <Block title="Répartition par établissement">
          <Table>
            <thead>
              <tr>
                <Th>Établissement</Th>
                <Th>Traitement</Th>
                <Th align="right">Revenus bruts</Th>
                <Th align="right">Acompte retenu</Th>
                <Th align="right">Résultat des cessions</Th>
                <Th align="right">Cessions crypto</Th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((s) => (
                <Tr key={s.key}>
                  <Td className="font-medium">
                    {s.mode === "a_saisir" ? (
                      <button type="button" className="underline" onClick={() => onOpen(s.key)}>
                        {s.name}
                      </button>
                    ) : (
                      s.name
                    )}
                  </Td>
                  <Td className="text-xs text-fg-muted">{MODE_LABELS[s.mode]}</Td>
                  <Td align="right">
                    <Amount value={incomeOf(s)} />
                  </Td>
                  <Td align="right">
                    <Amount value={prepaid(s)} />
                  </Td>
                  <Td align="right">
                    <Amount value={s.securities.net} signed />
                  </Td>
                  <Td align="right">
                    <Amount value={s.crypto.proceeds} />
                  </Td>
                </Tr>
              ))}
              <tr className="bg-surface-2/60 font-medium">
                <Td colSpan={2}>Total</Td>
                <Td align="right">
                  <Amount value={sheets.reduce((t, s) => t + incomeOf(s), 0)} />
                </Td>
                <Td align="right">
                  <Amount value={sheets.reduce((t, s) => t + prepaid(s), 0)} />
                </Td>
                <Td align="right">
                  <Amount value={sheets.reduce((t, s) => t + s.securities.net, 0)} signed />
                </Td>
                <Td align="right">
                  <Amount value={sheets.reduce((t, s) => t + s.crypto.proceeds, 0)} />
                </Td>
              </tr>
            </tbody>
          </Table>
        </Block>
      )}

      {securities && (securities.gains > 0 || securities.losses > 0 || securities.carryOut.length > 0) && (
        <Block title="Plus et moins-values de valeurs mobilières">
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Plus-values de l'année">
              <Amount value={securities.gains} />
            </Row>
            <Row label="Moins-values de l'année">
              <Amount value={securities.losses} />
            </Row>
            <Row label="Résultat de l'année">
              <Amount value={securities.net} signed />
            </Row>
            <Row label="Moins-values antérieures imputées">{securities.usedCarry.length ? securities.usedCarry.map((c) => <div key={c.year}><Amount value={c.amount} /> <span className="text-xs text-fg-faint">({c.year})</span></div>) : "—"}</Row>
            <Row label="Moins-values restant reportables">{securities.carryOut.length ? securities.carryOut.map((c) => <div key={c.year}><Amount value={c.amount} /> <span className="text-xs text-fg-faint">({c.year}, jusqu'en {c.year + rules.lossCarryYears})</span></div>) : "—"}</Row>
          </dl>
          <p className="mt-3 text-xs text-fg-faint">Moins-values antérieures : uniquement celles que Hamac connaît par votre journal.</p>
        </Block>
      )}

      {crypto && (
        <Block title="Actifs numériques (portefeuille global)">
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Total des cessions">
              <Amount value={crypto.grossSales} />
            </Row>
            <Row label="Résultat net">
              <Amount value={crypto.netGain} signed />
            </Row>
            <Row label="Seuil d'exonération">{crypto.exempt ? "Sous le seuil : plus-value exonérée" : "Dépassé"}</Row>
          </dl>
        </Block>
      )}

      {others.length > 0 && (
        <Block title="Autres comptes">
          <ul className="space-y-1.5 text-sm">
            {others.map((o) => (
              <li key={o.account.id}>
                <span className="font-medium">{o.account.name}</span> <span className="text-fg-muted">: {o.reason}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="Rappels">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
          {reminders.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Block>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1.5">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/** Montants lus sur le document de l'établissement, comparés au récapitulatif de Hamac. */
function StatementCheck({ sheet, rules, statements }: { sheet: TaxSheet; rules: FiscalYearRules; statements: readonly TaxStatementAmount[] }) {
  const save = useMutate("taxStatements.save", { success: "Montants enregistrés" });
  const saved = useMemo(() => new Map(statements.filter((x) => x.institutionId === sheet.institutionId && x.year === rules.incomeYear).map((x) => [x.box, x.amount])), [statements, sheet.institutionId, rules.incomeYear]);
  const [draft, setDraft] = useState<ReadonlyMap<string, number | null>>(new Map());
  const official = new Map(saved);
  for (const [box, amount] of draft) {
    if (amount == null) official.delete(box);
    else official.set(box, amount);
  }
  const rows = compareWithStatement(sheet, rules, official);
  if (!sheet.institutionId || rows.length === 0) return null;
  const persist = () => save.mutate({ institutionId: sheet.institutionId!, year: rules.incomeYear, amounts: rows.flatMap((r) => (r.official == null ? [] : [{ box: r.rule.box, amount: r.official }])) }, { onSuccess: () => setDraft(new Map()) });
  return (
    <Block title="Comparer avec le document de l'établissement">
      <p className="mb-3 text-sm text-fg-muted">Recopiez les montants de son document fiscal : l'écart apparaît case par case.</p>
      <Table>
        <thead>
          <tr>
            <Th>Case</Th>
            <Th>Libellé</Th>
            <Th align="right">Hamac</Th>
            <Th align="right">Document</Th>
            <Th align="right">Écart</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.key}>
              <BoxCell line={r} covered={rules.covered} />
              <Td>{r.rule.label}</Td>
              <Td align="right">
                <Amount value={r.hamac} />
              </Td>
              <Td align="right" className="w-40">
                <MoneyInput aria-label={`Document, case ${r.rule.box}`} value={r.official} onChange={(v) => setDraft(new Map(draft).set(r.rule.box, v))} />
              </Td>
              <Td align="right" className={r.gap != null && Math.abs(r.gap) >= 1 ? "font-medium text-warning" : undefined}>
                {r.gap == null ? "—" : <Amount value={r.gap} />}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <div className="no-print mt-3 flex justify-end">
        <Button variant="primary" disabled={draft.size === 0 || save.isPending} onClick={persist}>
          Enregistrer les montants
        </Button>
      </div>
    </Block>
  );
}

function SheetView({ sheet, rules, statements }: { sheet: TaxSheet; rules: FiscalYearRules; statements: readonly TaxStatementAmount[] }) {
  const empty = sheet.lines.length === 0 && sheet.disposals.length === 0 && sheet.cryptoSales.length === 0;
  return (
    <>
      <Block title="Comptes concernés">
        <p className="text-sm">{sheet.accounts.map((a) => a.name).join(", ")}</p>
      </Block>
      {empty && <Notice>Aucun revenu ni aucune cession pour cette année sur cet établissement.</Notice>}

      {sheet.lines.length > 0 && (
        <Block title="Cases à reporter">
          <Table>
            <thead>
              <tr>
                <Th>Case</Th>
                <Th>Formulaire</Th>
                <Th>Libellé</Th>
                <Th align="right">Montant</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {sheet.lines.map((l) => (
                <Tr key={l.key}>
                  <BoxCell line={l} covered={rules.covered} />
                  <Td>{l.rule.form}</Td>
                  <Td>
                    {l.rule.label}
                    <Notes notes={l.notes} />
                  </Td>
                  <Td align="right" className="font-medium">
                    <Amount value={l.amount} />
                  </Td>
                  <Td>
                    <Status status={l.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Block>
      )}

      {sheet.incomes.length > 0 && (
        <Block title="Détail des revenus">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Compte</Th>
                <Th>Nature</Th>
                <Th align="right">Reçu</Th>
                <Th align="right">Brut</Th>
                <Th align="right">Acompte</Th>
                <Th align="right">Prél. sociaux</Th>
                <Th align="right">Retenue étrangère</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {sheet.incomes.map((i) => (
                <Tr key={i.tx.id}>
                  <Td className="whitespace-nowrap">{formatDate(i.tx.date)}</Td>
                  <Td>{i.accountName}</Td>
                  <Td>
                    {i.tx.type === "dividende" ? "Dividende" : "Intérêts"}
                    {i.assetName ? ` · ${i.assetName}` : ""}
                    {i.note && <Notes notes={[i.note]} />}
                  </Td>
                  <Td align="right">
                    <Amount value={i.tx.amount} />
                  </Td>
                  <Td align="right">
                    <Amount value={i.gross} />
                  </Td>
                  <Td align="right">
                    <Amount value={i.incomeTax} />
                  </Td>
                  <Td align="right">
                    <Amount value={i.social} />
                  </Td>
                  <Td align="right">
                    <Amount value={i.foreign} />
                  </Td>
                  <Td>
                    <Status status={i.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Block>
      )}

      {sheet.disposals.length > 0 && (
        <Block title="Cessions de titres (détail pour la 2074)">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Titre</Th>
                <Th align="right">Quantité</Th>
                <Th align="right">Prix de cession net</Th>
                <Th align="right">Prix de revient</Th>
                <Th align="right">Plus ou moins-value</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {sheet.disposals.map((d) => (
                <Tr key={`${d.txId ?? d.assetId}-${d.date}`}>
                  <Td className="whitespace-nowrap">{formatDate(d.date)}</Td>
                  <Td>
                    {d.assetName}
                    {d.note && <Notes notes={[d.note]} />}
                  </Td>
                  <Td align="right">{d.quantity.toLocaleString("fr-FR")}</Td>
                  <Td align="right">
                    <Amount value={d.proceeds} />
                  </Td>
                  <Td align="right">
                    <Amount value={d.cost} />
                  </Td>
                  <Td align="right">
                    <Amount value={d.gain} signed />
                  </Td>
                  <Td>
                    <Status status={d.status} />
                  </Td>
                </Tr>
              ))}
              <tr className="bg-surface-2/60 font-medium">
                <Td colSpan={5}>Résultat de cet établissement, avant compensation avec les autres</Td>
                <Td align="right">
                  <Amount value={sheet.securities.net} signed />
                </Td>
                <Td />
              </tr>
            </tbody>
          </Table>
        </Block>
      )}

      {sheet.cryptoSales.length > 0 && (
        <Block title="Cessions d'actifs numériques (détail pour la 2086)">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Actif</Th>
                <Th align="right">Prix de cession</Th>
                <Th align="right">Frais</Th>
                <Th align="right">Valeur globale du portefeuille</Th>
                <Th align="right">Prix d'acquisition imputé</Th>
                <Th align="right">Plus ou moins-value</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {sheet.cryptoSales.map((c) => (
                <Tr key={c.sale.tx.id}>
                  <Td className="whitespace-nowrap">{formatDate(c.sale.date)}</Td>
                  <Td>{c.assetName}</Td>
                  <Td align="right">
                    <Amount value={c.sale.gross} />
                  </Td>
                  <Td align="right">
                    <Amount value={c.sale.fee} />
                  </Td>
                  <Td align="right">
                    <Amount value={c.sale.portfolioValue} />
                  </Td>
                  <Td align="right">
                    <Amount value={c.sale.attributed} />
                  </Td>
                  <Td align="right">
                    <Amount value={c.sale.gain} signed />
                  </Td>
                  <Td>
                    <Status status={c.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-fg-faint">Le gain imposable se calcule sur le portefeuille global, toutes plateformes : voir le récapitulatif complet.</p>
        </Block>
      )}

      <StatementCheck sheet={sheet} rules={rules} statements={statements} />
    </>
  );
}
