import type { PropertyFullCost } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { DetailLine as Line } from "@/shared/components/DetailLine";
import { Pct } from "@/shared/components/Stat";
import { Table, Td, Th, Tr } from "@/shared/components/table";
import { Card, CardTitle } from "@/shared/components/ui";

/** Coût de revient, crédit compris, et rendements d'une année type. */
export function FullCostCard({ cost: c }: { cost: PropertyFullCost }) {
  return (
    <Card>
      <CardTitle hint="votre part">Coût de revient</CardTitle>
      <Line label="Achat, frais compris">{c.purchase == null ? "—" : <Amount value={c.purchase} />}</Line>
      {c.improvements > 0 && (
        <Line label="Travaux d'amélioration">
          <Amount value={c.improvements} />
        </Line>
      )}
      <Line label="Intérêts et assurance payés">
        <Amount value={c.loanCostPaid} />
      </Line>
      <Line label="Coût à ce jour" strong>
        {c.toDate == null ? "—" : <Amount value={c.toDate} />}
      </Line>
      {c.loanCostLeft > 0 && (
        <>
          <Line label="Intérêts et assurance restant à payer">
            <Amount value={c.loanCostLeft} />
          </Line>
          <Line label="Coût total, crédit remboursé" strong>
            {c.total == null ? "—" : <Amount value={c.total} />}
          </Line>
        </>
      )}
      <div className="mt-4">
        <Table>
          <thead>
            <tr>
              <Th>Rendement d'une année type</Th>
              <Th align="right">Sur l'achat</Th>
              <Th align="right">Sur le coût total</Th>
            </tr>
          </thead>
          <tbody>
            <Tr>
              <Td>Brut (loyers)</Td>
              <Td align="right"><Pct value={c.yields.onPurchase.gross} digits={2} /></Td>
              <Td align="right"><Pct value={c.yields.onTotal.gross} digits={2} /></Td>
            </Tr>
            <Tr>
              <Td>Net de charges et provisions</Td>
              <Td align="right"><Pct value={c.yields.onPurchase.net} digits={2} /></Td>
              <Td align="right"><Pct value={c.yields.onTotal.net} digits={2} /></Td>
            </Tr>
            <Tr>
              <Td>Net après impôt sur les loyers</Td>
              <Td align="right"><Pct value={c.yields.onPurchase.afterTax} digits={2} /></Td>
              <Td align="right"><Pct value={c.yields.onTotal.afterTax} digits={2} /></Td>
            </Tr>
          </tbody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-fg-faint">
        Année type d'après le cashflow prévu, sans le crédit. « Sur l'achat » : achat et améliorations ; « sur le coût total » : en ajoutant tout le coût du crédit, ce qui fait baisser le rendement d'un bien acheté à crédit. Impôt : celui de l'année de référence de la carte Impôts.
        {c.purchase == null && " Indiquez le prix d'achat pour calculer le coût et les rendements."}
      </p>
    </Card>
  );
}
