import { ArrowLeft, Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { LOAN_KIND_LABELS, PROPERTY_KIND_LABELS, PROPERTY_OWNERSHIP_LABELS, formatPct, propertySummary, propertyTotalCost } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { DetailLine as Line } from "@/components/DetailLine";
import { LeaseCard } from "@/components/LeaseCard";
import { Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { PropertyDialog } from "@/dialogs/PropertyDialog";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";

const BackLink = () => (
  <Link to="/immobilier" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
    <ArrowLeft size={14} /> Immobilier
  </Link>
);

/** Fiche d'un bien : ce qu'il vaut, ce qu'il a coûté et les crédits qui s'y rattachent. */
export function Bien() {
  const { id } = useParams();
  const pf = usePortfolio();
  const [editing, setEditing] = useState(false);
  if (!pf) return null;
  const property = pf.idx.ws.properties.find((p) => p.id === id);
  if (!property) {
    return (
      <>
        <BackLink />
        <PageHeader title="Bien introuvable" description="Ce bien n'existe pas ou a été supprimé." />
      </>
    );
  }
  const s = propertySummary(property, pf.state.netWorth.loans);
  const totalCost = propertyTotalCost(property);
  const shareLabel = property.share < 1 ? ` · part détenue ${formatPct(property.share)}` : "";
  const leases = pf.idx.ws.leases.filter((l) => l.propertyId === property.id);

  return (
    <>
      <BackLink />
      <PageHeader
        title={property.name}
        description={`${PROPERTY_KIND_LABELS[property.kind]} · ${PROPERTY_OWNERSHIP_LABELS[property.ownership]}${shareLabel}`}
        actions={
          <Button onClick={() => setEditing(true)}>
            <Pencil size={16} /> Modifier
          </Button>
        }
      />
      {property.archived && (
        <div className="mb-4">
          <Badge>Archivé</Badge>
        </div>
      )}

      <StatGrid>
        <Stat label="Valeur détenue" sub={property.valueDate ? `estimée le ${formatDate(property.valueDate)}` : "part détenue"}>
          <span className="text-2xl">
            <Amount value={s.heldValue} compact />
          </span>
        </Stat>
        <Stat label="Coût d'achat" sub="frais compris, part détenue">
          {s.heldCost == null ? "—" : <Amount value={s.heldCost} compact />}
        </Stat>
        <Stat label="Gain estimé" sub="valeur détenue − coût d'achat, avant impôt">
          {s.gain == null ? "—" : <Amount value={s.gain} signed compact />}
        </Stat>
        <Stat label="Valeur nette" sub="après capital restant dû à votre charge">
          <Amount value={s.netValue} compact />
        </Stat>
      </StatGrid>

      <div className="grid gap-5 @3xl:grid-cols-2">
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
          </div>
        </Card>

        <Card>
          <CardTitle hint="part à votre charge">Crédits rattachés</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Crédit</Th>
                <Th align="right">Mensualité</Th>
                <Th align="right">Capital restant dû</Th>
                <Th>Fin</Th>
              </tr>
            </thead>
            <tbody>
              {s.loans.length === 0 && (
                <EmptyRow cols={4}>
                  Aucun crédit. Rattachez-en un depuis la page <Link to="/credits" className="underline">Crédits</Link>.
                </EmptyRow>
              )}
              {s.loans.map((l) => (
                <Tr key={l.loan.id}>
                  <Td className="font-medium">
                    {l.loan.name}
                    <div className="text-xs font-normal text-fg-faint">{LOAN_KIND_LABELS[l.loan.kind]}</div>
                  </Td>
                  <Td align="right"><Amount value={l.heldMonthly} /></Td>
                  <Td align="right"><Amount value={l.heldBalance} /></Td>
                  <Td className="whitespace-nowrap text-fg-muted">{formatDate(l.endDate)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {property.kind === "locatif" && <LeaseCard property={property} leases={leases} rents={pf.idx.ws.leaseRents} today={pf.today} />}
      </div>

      <PropertyDialog open={editing} property={property} onClose={() => setEditing(false)} />
    </>
  );
}
