import { propertyTotalCost, type Property } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { DetailLine as Line } from "@/shared/components/DetailLine";
import { Card, CardTitle } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/numbers";

/** Achat du bien entier, frais compris, et travaux d'amélioration faits depuis. */
export function PurchaseCard({ property, improvements }: { property: Property; improvements: number }) {
  const totalCost = propertyTotalCost(property);
  return (
    <Card>
      <CardTitle hint="bien entier">Achat</CardTitle>
      <Line label="Date d'achat">{property.purchaseDate ? formatDate(property.purchaseDate) : "—"}</Line>
      <Line label="État à l'achat">{property.newBuild ? "Neuf ou en construction" : "Ancien"}</Line>
      <Line label="Prix d'achat">{property.purchasePrice == null ? "—" : <Amount value={property.purchasePrice} />}</Line>
      <Line label="Frais de notaire"><Amount value={property.notaryFees} /></Line>
      <Line label="Frais d'agence"><Amount value={property.agencyFees} /></Line>
      <Line label="Travaux à l'achat"><Amount value={property.initialWorks} /></Line>
      <Line label="Autres frais"><Amount value={property.otherFees} /></Line>
      <div className="mt-1.5 border-t border-line pt-1.5">
        <Line label="Coût d'achat complet" strong>{totalCost == null ? "—" : <Amount value={totalCost} />}</Line>
        {improvements > 0 && (
          <>
            <Line label="Travaux d'amélioration depuis l'achat"><Amount value={improvements} /></Line>
            <Line label="Coût total" strong>{totalCost == null ? "—" : <Amount value={totalCost + improvements} />}</Line>
          </>
        )}
      </div>
    </Card>
  );
}
