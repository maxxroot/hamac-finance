import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { buildTaxReport, MODE_LABELS, reportTotalsMismatches, rulesValidityLabel, TAX_DISCLAIMER, taxReportAlerts, taxReportCsvRows, taxReportYears, type FiscalYearRules, type TaxAlert } from "@hamac/core";
import { Field, Select } from "@/shared/components/form";
import { Notice } from "@/shared/components/Stat";
import { Badge, Button, PageHeader } from "@/shared/components/ui";
import { downloadText, toCsv } from "@/shared/lib/files";
import { formatDate } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { Onboarding } from "@/features/entry";
import { CompleteView } from "./CompleteView";
import { SheetView } from "./SheetView";

export const COMPLETE = "complet";

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

export function DocumentHeader({ title, rules, today, mode }: { title: string; rules: FiscalYearRules; today: string; mode: string | null }) {
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

export function Controls({ alerts, consistent }: { alerts: readonly TaxAlert[]; consistent: boolean | null }) {
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
