import { Link } from "react-router";
import { RENTAL_REGIME_LABELS, RENTAL_TAX_KIND_LABELS } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Table, Td, Th, Tr, EmptyRow } from "@/shared/components/table";
import { Badge, Card, CardTitle } from "@/shared/components/ui";
import type { Rentability } from "@/features/realestate/lib/rentability";

/** Impôt estimé sur les loyers du bien, année par année, et ce que donnerait l'autre régime. */
export function TaxCard({ tax, tmi }: { tax: Rentability["tax"]; tmi: number }) {
  const labels = RENTAL_REGIME_LABELS[tax.kind];
  const ref = tax.reference;
  const amortized = tax.years.some((y) => y.amortization > 0);
  const possible = tax.choices.filter((c) => c.tax != null && !c.impossible);
  const best = possible.length > 1 ? possible.reduce((a, b) => (b.tax! < a.tax! ? b : a)) : null;
  return (
    <Card>
      <CardTitle hint={`${RENTAL_TAX_KIND_LABELS[tax.kind]} · ${labels[tax.regime]}`}>Impôts sur les loyers</CardTitle>
      <p className="mb-4 text-sm text-fg-muted">
        Estimation de l'impôt sur le revenu et des prélèvements sociaux dus sur les loyers de ce bien, à votre tranche marginale de {Math.round(tmi * 100)} %. Le régime vaut pour toute votre location {tax.kind === "foncier" ? "vide" : "meublée"} : il se
        règle dans{" "}
        <Link to="/parametres" className="underline">
          Paramètres › Plan › Biens en location
        </Link>
        .
      </p>
      {ref?.ceilingExceeded && (
        <p className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          En {ref.year}, vos recettes de location {tax.kind === "foncier" ? "vide" : "meublée"} (<Amount value={ref.receipts} />) dépassent le plafond du {labels.micro.toLowerCase()} : le réel s'applique.
        </p>
      )}
      <Table>
        <thead>
          <tr>
            <Th>Année</Th>
            <Th>Régime</Th>
            <Th align="right">Recettes</Th>
            <Th align="right">{tax.regime === "micro" ? "Abattement" : "Charges déductibles"}</Th>
            {amortized && <Th align="right">Amortissement</Th>}
            <Th align="right">Impôt estimé</Th>
          </tr>
        </thead>
        <tbody>
          {tax.years.length === 0 && <EmptyRow cols={amortized ? 6 : 5}>Pas encore de loyer reçu.</EmptyRow>}
          {[...tax.years].reverse().map((y) => (
            <Tr key={y.year}>
              <Td className="whitespace-nowrap">
                {y.year}
                {y.partial && <span className="ml-2 text-xs text-fg-faint">en cours</span>}
              </Td>
              <Td>{labels[y.regime]}</Td>
              <Td align="right"><Amount value={y.receipts} /></Td>
              <Td align="right"><Amount value={y.deductible} /></Td>
              {amortized && <Td align="right"><Amount value={y.amortization} /></Td>}
              <Td align="right"><Amount value={y.tax} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {ref && possible.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-medium text-fg-muted">En {ref.year}, pour ce bien, selon le régime</div>
          <ul className="space-y-1 text-sm">
            {tax.choices.map((c) => (
              <li key={c.regime} className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  {labels[c.regime]}
                  {c.regime === tax.regime && <span className="ml-2 text-xs text-fg-faint">régime choisi</span>}
                </span>
                {c.impossible ? (
                  <span className="text-xs text-fg-faint">plafond dépassé</span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    {best?.regime === c.regime && <Badge tone="positive">Le moins d'impôt</Badge>}
                    <Amount value={c.tax} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="mt-3 space-y-1 text-xs text-fg-faint">
        <li>
          Négatif : un déficit fait baisser votre impôt. {tax.kind === "foncier" ? "Prélèvements sociaux de 17,2 % sur les revenus fonciers." : "Prélèvements sociaux de 18,6 % sur la location meublée depuis les revenus 2025."} L'impôt de l'année de référence, divisé par 12, compte dans le cashflow.
        </li>
        {tax.kind === "lmnp" && tax.regime === "reel" && <li>Amortissement du bâti hors terrain par composant (durées comptables usuelles, à valider avec votre comptable) et des améliorations sur 10 ans ; il ne crée pas de déficit, l'excédent se reporte.</li>}
        <li>Pas pris en compte : le plafond majoré du déficit foncier pour une rénovation énergétique, les meublés de tourisme, le statut de loueur professionnel, une SCI à l'impôt sur les sociétés, les dispositifs de défiscalisation.</li>
      </ul>
    </Card>
  );
}
