import { ArrowLeft, Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { LOAN_KIND_LABELS, PROPERTY_KIND_LABELS, PROPERTY_OWNERSHIP_LABELS, currentLease, formatPct, leaseState, loanPayoffAt, propertyImprovements, propertySale, propertySummary, propertyTotalCost, propertyYears } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { DetailLine as Line } from "@/components/DetailLine";
import { ExpensesCard } from "@/components/ExpensesCard";
import { LeaseCard } from "@/components/LeaseCard";
import { DescriptionCard, EnergyCard, ProfitabilityCard, SaleCard } from "@/components/PropertySheetCards";
import { PropertyYearsCard } from "@/components/PropertyYearsCard";
import { RentsCard } from "@/components/RentsCard";
import { ValuesCard } from "@/components/ValuesCard";
import { Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { PropertyDialog } from "@/dialogs/PropertyDialog";
import { PropertySheetDialog } from "@/dialogs/PropertySheetDialog";
import { SaleDialog } from "@/dialogs/SaleDialog";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

const BackLink = () => (
  <Link to="/immobilier" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
    <ArrowLeft size={14} /> Immobilier
  </Link>
);

type Tab = "fiche" | "location" | "finances";

/** Fiche d'un bien : sa description, sa location et ses finances. */
export function Bien() {
  const { id } = useParams();
  const pf = usePortfolio();
  const [editing, setEditing] = useState(false);
  const [editingSheet, setEditingSheet] = useState(false);
  const [selling, setSelling] = useState(false);
  const cancelSale = useMutate("properties.cancelSale", { success: "Vente annulée" });
  const [search, setSearch] = useSearchParams();
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
  const improvements = propertyImprovements(pf.idx.ws.propertyExpenses, property.id, pf.today);
  const s = propertySummary(property, pf.state.netWorth.loans, improvements);
  const totalCost = propertyTotalCost(property);
  const sale = propertySale(property, improvements, property.saleDate ? loanPayoffAt(pf.idx.ws.loans, property.id, property.saleDate) : 0);
  const shareLabel = property.share < 1 ? ` · part détenue ${formatPct(property.share)}` : "";
  const { ws } = pf.idx;
  const leases = ws.leases.filter((l) => l.propertyId === property.id);
  const rented = property.kind === "locatif";
  const tabs: Array<[Tab, string]> = [["fiche", "Fiche"], ...(rented ? ([["location", "Location"]] as Array<[Tab, string]>) : []), ["finances", "Finances"]];
  const requested = search.get("onglet");
  const tab = tabs.find(([key]) => key === requested)?.[0] ?? "fiche";
  const rentalData = { property, leases, rents: ws.leaseRents, exceptions: ws.rentExceptions, expenses: ws.propertyExpenses, loans: ws.loans };
  const years = rented ? propertyYears(rentalData, pf.today) : [];
  const lease = currentLease(leases.map((l) => leaseState(l, ws.leaseRents, pf.today)));
  const monthlyRent = rented && (lease?.status === "en_cours" || lease?.status === "conge") ? lease.rent : null;

  return (
    <>
      <BackLink />
      <PageHeader
        title={property.name}
        description={`${PROPERTY_KIND_LABELS[property.kind]} · ${PROPERTY_OWNERSHIP_LABELS[property.ownership]}${shareLabel}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {sale ? (
              <Button onClick={() => confirm("Annuler la vente ? Le bien et ses crédits reviennent dans le patrimoine.") && cancelSale.mutate({ id: property.id })}>Annuler la vente</Button>
            ) : (
              <Button onClick={() => setSelling(true)}>Vendre</Button>
            )}
            <Button onClick={() => setEditing(true)}>
              <Pencil size={16} /> Modifier
            </Button>
          </div>
        }
      />
      {property.archived && (
        <div className="mb-4">
          <Badge>{property.saleDate ? `Vendu le ${formatDate(property.saleDate)}` : "Archivé"}</Badge>
        </div>
      )}

      {!sale && (
      <StatGrid>
        <Stat label="Valeur détenue" sub={property.valueDate ? `estimée le ${formatDate(property.valueDate)}` : "part détenue"}>
          <span className="text-2xl">
            <Amount value={s.heldValue} compact />
          </span>
        </Stat>
        <Stat label={improvements > 0 ? "Coût total" : "Coût d'achat"} sub={improvements > 0 ? "frais et améliorations compris, part détenue" : "frais compris, part détenue"}>
          {s.heldCost == null ? "—" : <Amount value={s.heldCost} compact />}
        </Stat>
        <Stat label="Gain estimé" sub="valeur détenue − coût d'achat, avant impôt">
          {s.gain == null ? "—" : <Amount value={s.gain} signed compact />}
        </Stat>
        <Stat label="Valeur nette" sub="après capital restant dû à votre charge">
          <Amount value={s.netValue} compact />
        </Stat>
      </StatGrid>
      )}

      <div className="mb-6 flex gap-1 border-b border-line" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setSearch({ onglet: key }, { replace: true })}
            className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors", tab === key ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "fiche" && (
        <div className="grid items-start gap-5 @3xl:grid-cols-2">
          <DescriptionCard property={property} monthlyRent={monthlyRent} onEdit={() => setEditingSheet(true)} />
          <div className="space-y-5">
            {sale && <SaleCard sale={sale} />}
            <EnergyCard property={property} today={pf.today} />
            {rented && <ProfitabilityCard years={years} />}
          </div>
        </div>
      )}

      {tab === "location" && (
        <div className="grid items-start gap-5 @3xl:grid-cols-2">
          <LeaseCard property={property} leases={leases} rents={ws.leaseRents} today={pf.today} />
          <RentsCard leases={leases} rents={ws.leaseRents} exceptions={ws.rentExceptions} today={pf.today} />
        </div>
      )}

      {tab === "finances" && (
        <div className="grid items-start gap-5 @3xl:grid-cols-2">
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
          <ValuesCard property={property} values={ws.propertyValues.filter((v) => v.propertyId === property.id)} />
          <ExpensesCard propertyId={property.id} expenses={ws.propertyExpenses.filter((e) => e.propertyId === property.id)} />
          {rented && <PropertyYearsCard data={rentalData} today={pf.today} />}
        </div>
      )}

      <PropertyDialog open={editing} property={property} onClose={() => setEditing(false)} />
      <SaleDialog open={selling} property={property} improvements={improvements} loans={ws.loans} onClose={() => setSelling(false)} />
      <PropertySheetDialog open={editingSheet} property={property} onClose={() => setEditingSheet(false)} />
    </>
  );
}
