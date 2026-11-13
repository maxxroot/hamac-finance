import { propertyYears, type RentalData } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/shared/components/table";
import { Card, CardTitle } from "@/shared/components/ui";

/** Bilan du bien année par année depuis l'achat, à la part détenue et avant impôt. */
export function PropertyYearsCard({ data, today }: { data: RentalData; today: string }) {
  const years = [...propertyYears(data, today)].reverse();
  return (
    <Card className="mt-5">
      <CardTitle hint="votre part, avant impôt">Résultats par année</CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Année</Th>
            <Th align="right">Loyers et charges reçus</Th>
            <Th align="right">Autres recettes</Th>
            <Th align="right">Dépenses</Th>
            <Th align="right">Intérêts et assurance</Th>
            <Th align="right">Capital remboursé</Th>
            <Th align="right">Ce qu'il reste</Th>
            <Th align="right">Rendement brut</Th>
            <Th align="right">Rendement après charges</Th>
            <Th align="right">Occupation</Th>
          </tr>
        </thead>
        <tbody>
          {years.length === 0 && <EmptyRow cols={10}>Indiquez une date d'achat ou un bail pour voir les résultats.</EmptyRow>}
          {years.map((y) => (
            <Tr key={y.year}>
              <Td className="font-medium whitespace-nowrap">
                {y.year}
                {y.partial && <span title="Année incomplète : rendements ramenés à une année entière"> *</span>}
              </Td>
              <Td align="right"><Amount value={y.rents + y.charges} /></Td>
              <Td align="right"><Amount value={y.otherIncome} /></Td>
              <Td align="right"><Amount value={y.expenses} /></Td>
              <Td align="right"><Amount value={y.interest + y.insurance} /></Td>
              <Td align="right"><Amount value={y.capital} /></Td>
              <Td align="right"><Amount value={y.remaining} signed /></Td>
              <Td align="right"><Pct value={y.grossYield} digits={2} /></Td>
              <Td align="right"><Pct value={y.netYield} digits={2} /></Td>
              <Td align="right"><Pct value={y.occupancy} digits={0} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {years.some((y) => y.partial) && <p className="mt-2 text-xs text-fg-faint">* Année incomplète : les rendements sont ramenés à une année entière.</p>}
    </Card>
  );
}
