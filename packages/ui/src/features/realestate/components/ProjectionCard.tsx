import { useState } from "react";
import { rentalSale, type PlanParams } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { DetailLine as Line } from "@/shared/components/DetailLine";
import { Field, Select } from "@/shared/components/form";
import { Pct } from "@/shared/components/Stat";
import { Table, Td, Th, Tr } from "@/shared/components/table";
import { Card, CardTitle } from "@/shared/components/ui";
import type { Rentability } from "@/features/realestate/lib/rentability";
import { cn } from "@/shared/lib/cn";

const pct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("fr-FR")} %`;

/** Le bien année par année jusqu'à la fin du crédit, et une revente à l'année choisie. */
export function ProjectionCard({ projection, rental }: { projection: Rentability["projection"]; rental: PlanParams["rental"] }) {
  const [saleYear, setSaleYear] = useState(projection.horizon);
  const year = projection.years.some((y) => y.year === saleYear) ? saleYear : projection.horizon;
  const sale = rentalSale(projection.sale, projection.years, year);
  if (projection.years.length === 0) return null;
  return (
    <Card>
      <CardTitle hint={`loyers ${pct(rental.rentGrowth)}, charges ${pct(rental.chargesGrowth)}, valeur ${pct(rental.valueGrowth)} par an`}>Projection et revente</CardTitle>
      <p className="mb-4 text-sm text-fg-muted">
        Le cashflow prévu d'aujourd'hui projeté chaque année, avec le vrai échéancier du crédit et l'impôt estimé, jusqu'à la fin du crédit. Puis ce que donnerait une revente : hypothèses à régler dans Paramètres › Plan › Biens en location.
      </p>
      <div className="mb-5 grid gap-5 @3xl:grid-cols-2">
        <div>
          <Field label="Revendre fin">
            {(id) => (
              <Select id={id} value={year} onChange={(e) => setSaleYear(Number(e.target.value))}>
                {projection.years.map((y) => (
                  <option key={y.year} value={y.year}>
                    {y.year}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {sale == null ? (
            <p className="mt-3 text-sm text-fg-muted">Indiquez le prix et la date d'achat du bien pour simuler une revente.</p>
          ) : (
            <div className="mt-3">
              <Line label="Prix de vente estimé">
                <Amount value={sale.price} />
              </Line>
              <Line label={`Plus-value imposable, après ${sale.gain.years} ans`}>
                <Amount value={sale.gain.gain} />
              </Line>
              <Line label="Impôt sur la plus-value">
                <Amount value={sale.gain.total} />
              </Line>
              <Line label="Crédit remboursé à la vente">
                <Amount value={sale.debt} />
              </Line>
              <Line label="Reste après impôt et crédit" strong>
                <Amount value={sale.net} />
              </Line>
            </div>
          )}
        </div>
        {sale && (
          <div className="rounded-xl bg-surface-2 p-4">
            <Line label="Gain total de l'opération" strong>
              {sale.totalGain == null ? "—" : <Amount value={sale.totalGain} signed />}
            </Line>
            <Line label="Rendement annuel de l'apport">
              <Pct value={sale.irr} digits={1} />
            </Line>
            <p className="mt-2 text-xs text-fg-faint">
              De l'apport à la revente : cashflows réels jusqu'ici, projetés ensuite, impôts compris, puis le reste de la vente. Le rendement annuel est le taux de rendement interne de ces flux. Abattements pour durée de détention : exonération d'impôt après 22 ans, de prélèvements sociaux après 30 ans
              {projection.sale.kind === "lmnp" ? " ; amortissements déduits réintégrés dans la plus-value" : ""}.
            </p>
          </div>
        )}
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Année</Th>
            <Th align="right">Loyers</Th>
            <Th align="right">Charges</Th>
            <Th align="right">Crédit</Th>
            <Th align="right">Impôt</Th>
            <Th align="right">Cashflow</Th>
            <Th align="right">Restant dû</Th>
            <Th align="right">Valeur nette</Th>
          </tr>
        </thead>
        <tbody>
          {projection.years.map((y) => (
            <Tr key={y.year} className={cn(y.year === year && "bg-surface-2", y.year > year && "opacity-50")}>
              <Td>{y.year}</Td>
              <Td align="right"><Amount value={y.rents} compact /></Td>
              <Td align="right"><Amount value={y.charges} compact /></Td>
              <Td align="right"><Amount value={y.loans} compact /></Td>
              <Td align="right"><Amount value={y.tax} compact /></Td>
              <Td align="right"><Amount value={y.cashflow} signed compact /></Td>
              <Td align="right"><Amount value={y.debt} compact /></Td>
              <Td align="right"><Amount value={y.netValue} compact /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
