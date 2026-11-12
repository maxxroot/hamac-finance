import type { PropertySale } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { DetailLine as Line } from "@/shared/components/DetailLine";
import { Card, CardTitle } from "@/shared/components/ui";

/** Bilan de la vente, pour la part détenue. */
export function SaleCard({ sale }: { sale: PropertySale }) {
  return (
    <Card>
      <CardTitle hint="votre part, avant impôt">Bilan de la vente</CardTitle>
      <Line label="Prix de vente"><Amount value={sale.price} /></Line>
      <Line label="Frais de vente"><Amount value={sale.fees} /></Line>
      <Line label="Coût total du bien">{sale.cost == null ? "—" : <Amount value={sale.cost} />}</Line>
      <Line label="Gain réalisé" strong>{sale.gain == null ? "—" : <Amount value={sale.gain} signed />}</Line>
      <div className="mt-1.5 border-t border-line pt-1.5">
        <Line label="Crédit remboursé à la vente"><Amount value={sale.loanPayoff} /></Line>
        <Line label="Reste après frais et crédit" strong><Amount value={sale.net} /></Line>
      </div>
    </Card>
  );
}
