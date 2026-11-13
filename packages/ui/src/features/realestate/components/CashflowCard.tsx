import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { CASHFLOW_LABELS, CASHFLOW_TONE_LABELS, propertyCashflow, type CashflowTone, type PlanParams, type Property, type RentalData } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Stat } from "@/shared/components/Stat";
import { Table, Td, Th, Tr } from "@/shared/components/table";
import { Badge, Button, Card, CardTitle } from "@/shared/components/ui";
import { ProvisionsDialog } from "@/features/realestate/dialogs/ProvisionsDialog";
import { formatMonth } from "@/shared/lib/numbers";

const TONE_BADGE: Record<CashflowTone, "positive" | "neutral" | "negative"> = { positif: "positive", neutre: "neutral", negatif: "negative" };

function Total({ value, tone }: { value: number; tone: CashflowTone }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-3">
      <Amount value={value} signed />
      <span className="font-sans text-base">
        <Badge tone={TONE_BADGE[tone]}>{CASHFLOW_TONE_LABELS[tone]}</Badge>
      </span>
    </span>
  );
}

/** Cashflow du bien, avant impôt : le réel des 12 derniers mois en avant, le prévu à côté, poste par poste. */
export function CashflowCard({ data, property, rental, today }: { data: RentalData; property: Property; rental: PlanParams["rental"]; today: string }) {
  const [editing, setEditing] = useState(false);
  const c = propertyCashflow(data, rental, today);
  const { real, planned } = c;
  const gap = planned.chargeProvisions - planned.recoverable;
  return (
    <Card>
      <CardTitle
        hint={
          <Button className="h-8" onClick={() => setEditing(true)}>
            <SlidersHorizontal size={14} /> Hypothèses
          </Button>
        }
      >
        Cashflow
      </CardTitle>
      <p className="mb-4 text-sm text-fg-muted">Ce que le bien vous laisse, ou vous coûte, chaque mois : loyers moins charges et crédit, avant impôt, pour votre part.</p>
      <div className="mb-5 grid gap-4 @3xl:grid-cols-2">
        <Stat hero label="Réel, par mois" sub={real ? `Moyenne de ${real.months} mois, de ${formatMonth(real.from)} à ${formatMonth(real.to)}` : "Pas encore de mois complet loué."}>
          {real ? <Total value={real.total} tone={real.tone} /> : "—"}
        </Stat>
        <Stat label="Prévu, par mois" sub="D'après le loyer en cours, vos dépenses annuelles et vos provisions.">
          <Total value={planned.total} tone={planned.tone} />
        </Stat>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Poste, par mois</Th>
            <Th align="right">Réel</Th>
            <Th align="right">Prévu</Th>
          </tr>
        </thead>
        <tbody>
          {c.lines.map((l) => (
            <Tr key={l.key}>
              <Td>
                {CASHFLOW_LABELS[l.key]}
                {l.key === "taxe_fonciere" && planned.propertyTaxEstimated && (
                  <span className="ml-2">
                    <Badge>Estimée</Badge>
                  </span>
                )}
              </Td>
              <Td align="right">{l.real == null ? <span className="text-fg-faint">—</span> : <Amount value={l.real} signed />}</Td>
              <Td align="right"><Amount value={l.planned} signed /></Td>
            </Tr>
          ))}
          <tr className="border-t border-line font-semibold">
            <Td>Cashflow</Td>
            <Td align="right">{real ? <Amount value={real.total} signed /> : "—"}</Td>
            <Td align="right"><Amount value={planned.total} signed /></Td>
          </tr>
        </tbody>
      </Table>
      <ul className="mt-3 space-y-1 text-xs text-fg-faint">
        <li>
          Neutre entre <Amount value={-c.neutralBand} /> et <Amount value={c.neutralBand} /> par mois ({Math.round(rental.neutralBand * 100)} % du loyer hors charges).
        </li>
        <li>
          Prévu : vacance {c.assumptions.vacancy.kind === "taux" ? `${(c.assumptions.vacancy.value * 100).toLocaleString("fr-FR")} % du loyer` : <><Amount value={c.assumptions.vacancy.value} /> par an</>}, travaux{" "}
          {c.assumptions.works.kind === "taux" ? `${(c.assumptions.works.value * 100).toLocaleString("fr-FR")} % du loyer` : <><Amount value={c.assumptions.works.value} /> par an</>}. Les charges récupérables sont supposées remboursées en totalité.
        </li>
        {planned.propertyTaxEstimated && <li>Taxe foncière estimée à {rental.propertyTaxMonths.toLocaleString("fr-FR")} mois de loyer hors charges, en attendant l'avis : ajoutez-la dans les dépenses (onglet Finances).</li>}
        {planned.chargeProvisions > 0 && Math.abs(gap) >= 1 && (
          <li>
            Provisions de charges : <Amount value={planned.chargeProvisions} /> par mois, charges récupérables : <Amount value={planned.recoverable} />. Environ <Amount value={Math.abs(gap) * 12} />{" "}
            {gap > 0 ? "à rendre au locataire" : "à lui demander"} par an à la régularisation.
          </li>
        )}
        <li>Le réel compte les loyers pointés au mois du loyer, les dépenses et les échéances à leur date ; ni les travaux d'amélioration ni les remboursements anticipés.</li>
      </ul>
      <ProvisionsDialog open={editing} property={property} rental={rental} onClose={() => setEditing(false)} />
    </Card>
  );
}
