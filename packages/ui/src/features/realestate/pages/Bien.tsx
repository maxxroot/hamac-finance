import { ArrowLeft, Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { lotIsActive, lotIsAnnex, sortLots, PROPERTY_KIND_LABELS, PROPERTY_OWNERSHIP_LABELS, heldShareLabel, loanPayoffAt, propertyImprovements, propertySale, propertySummary, rentLedgerOf } from "@hamac/core";
import { CardColumn, CardColumns } from "@/shared/components/CardColumns";
import { BalanceCard } from "@/features/realestate/components/BalanceCard";
import { CashflowCard } from "@/features/realestate/components/CashflowCard";
import { ExpensesCard } from "@/features/realestate/components/ExpensesCard";
import { FullCostCard } from "@/features/realestate/components/FullCostCard";
import { IncomesCard } from "@/features/realestate/components/IncomesCard";
import { LeaseCard } from "@/features/realestate/components/LeaseCard";
import { LotsCard } from "@/features/realestate/components/LotsCard";
import { ProjectionCard } from "@/features/realestate/components/ProjectionCard";
import { PropertyLoansCard } from "@/features/realestate/components/PropertyLoansCard";
import { PropertyStats } from "@/features/realestate/components/PropertyStats";
import { PurchaseCard } from "@/features/realestate/components/PurchaseCard";
import { SaleCard } from "@/features/realestate/components/PropertySheetCards";
import { TaxCard } from "@/features/realestate/components/TaxCard";
import { PropertySheetModal } from "@/features/realestate/components/PropertySheetModal";
import { PropertyYearsCard } from "@/features/realestate/components/PropertyYearsCard";
import { RentsCard } from "@/features/realestate/components/RentsCard";
import { ValuesCard } from "@/features/realestate/components/ValuesCard";
import { Badge, Button, PageHeader, tabClass, tabListClass } from "@/shared/components/ui";
import { PropertyDialog } from "@/features/realestate/dialogs/PropertyDialog";
import { SaleDialog } from "@/features/realestate/dialogs/SaleDialog";
import { formatDate } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useMutate } from "@/shared/lib/workspace";
import { allRentalData, rentalDataOf } from "@/features/realestate/lib/rentalData";
import { cachedRentability } from "@/features/realestate/lib/rentability";

const BackLink = () => (
  <Link to="/immobilier" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
    <ArrowLeft size={14} /> Immobilier
  </Link>
);

type Tab = "rentabilite" | "location" | "finances";

/** Page d'un bien : sa rentabilité, sa location et ses finances ; sa fiche s'ouvre dans une grande fenêtre. */
export function Bien() {
  const { id } = useParams();
  const pf = usePortfolio();
  const [editing, setEditing] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
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
  // Calculs sur la part détenue, parts de SCI comprises ; les formulaires gardent le bien tel que saisi.
  const held = pf.data.properties?.find((p) => p.id === property.id) ?? property;
  const heldLoans = pf.data.loans ?? pf.idx.ws.loans;
  const improvements = propertyImprovements(pf.idx.ws.propertyExpenses, property.id, pf.today);
  const s = propertySummary(held, pf.state.netWorth.loans, improvements, pf.today);
  const sale = propertySale(held, improvements, property.saleDate ? loanPayoffAt(heldLoans, property.id, property.saleDate) : 0);
  const heldLabel = heldShareLabel(held, pf.today);
  const shareLabel = heldLabel ? ` · ${heldLabel}` : "";
  const { ws } = pf.idx;
  const leases = ws.leases.filter((l) => l.propertyId === property.id);
  const rented = property.kind === "locatif";
  const tabs: Array<[Tab, string]> = rented ? [["rentabilite", "Rentabilité"], ["location", "Location"], ["finances", "Finances"]] : [["finances", "Finances"]];
  const requested = search.get("onglet");
  const tab = tabs.find(([key]) => key === requested)?.[0] ?? tabs[0][0];
  const lots = sortLots(ws.lots.filter((l) => l.propertyId === property.id));
  const rentalData = rentalDataOf(pf, property.id)!;
  const rentability = rented ? cachedRentability(pf, rentalData, () => allRentalData(pf), ws.params, sale ? sale.net : s.netValue, pf.today) : null;
  // Une carte de bail par lot proposé à la location (annexes : dès qu'elles ont un bail), et par lot sorti du mode qui a encore un bail en cours.
  const running = (lotId: string) => leases.some((l) => l.lotId === lotId && (l.actualEnd == null || l.actualEnd >= pf.today));
  const leaseLots = lots.filter((l) => (lotIsActive(l, property.rentalMode) && (!lotIsAnnex(l.kind) || leases.some((x) => x.lotId === l.id))) || running(l.id));
  const cards: Array<(typeof lots)[number] | null> = leaseLots.length ? leaseLots : property.rentalMode === "chambres" ? [] : [null];

  return (
    <>
      <BackLink />
      <PageHeader
        title={property.name}
        description={`${PROPERTY_KIND_LABELS[property.kind]} · ${PROPERTY_OWNERSHIP_LABELS[property.ownership]}${shareLabel}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setShowSheet(true)}>
              Fiche du bien
            </Button>
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

      {!sale && <PropertyStats property={property} summary={s} improvements={improvements} rentability={rentability} />}

      {tabs.length > 1 && <div className={tabListClass} role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setSearch({ onglet: key }, { replace: true })}
            className={tabClass(tab === key)}
          >
            {label}
          </button>
        ))}
      </div>}

      {tab === "rentabilite" && rentability && (
        <div className="space-y-5">
          <CashflowCard cashflow={rentability.cashflow} property={property} rental={ws.params.rental} />
          <CardColumns>
            <CardColumn>
              <BalanceCard balance={rentability.balance} />
            </CardColumn>
            <CardColumn>
              <FullCostCard cost={rentability.cost} />
            </CardColumn>
          </CardColumns>
          <TaxCard tax={rentability.tax} tmi={ws.params.tax.tmi} />
          <ProjectionCard projection={rentability.projection} rental={ws.params.rental} />
        </div>
      )}

      {tab === "location" && (
        <CardColumns>
          <CardColumn>
            {cards.map((lot) => (
              <LeaseCard key={lot?.id ?? "logement"} property={property} lot={lot} named={lots.length > 1} leases={lot ? leases.filter((l) => l.lotId === lot.id) : leases} all={leases} rents={ws.leaseRents} today={pf.today} />
            ))}
            <LotsCard property={property} lots={lots} leases={leases} rents={ws.leaseRents} renters={ws.renters} links={ws.leaseRenters} today={pf.today} />
          </CardColumn>
          <CardColumn>
            <RentsCard leases={leases} rents={ws.leaseRents} ledger={rentLedgerOf(ws)} lots={lots} today={pf.today} />
          </CardColumn>
        </CardColumns>
      )}

      {tab === "finances" && (
        <>
          <CardColumns>
            <CardColumn>
              {sale && <SaleCard sale={sale} />}
              <PurchaseCard property={property} improvements={improvements} />
              <PropertyLoansCard loans={s.loans} />
            </CardColumn>
            <CardColumn>
              <ValuesCard property={property} values={ws.propertyValues.filter((v) => v.propertyId === property.id)} />
              <ExpensesCard propertyId={property.id} expenses={ws.propertyExpenses.filter((e) => e.propertyId === property.id)} />
              {rented && <IncomesCard propertyId={property.id} incomes={ws.propertyIncomes.filter((i) => i.propertyId === property.id)} />}
            </CardColumn>
          </CardColumns>
          {rented && <PropertyYearsCard data={rentalData} today={pf.today} />}
        </>
      )}

      <PropertyDialog open={editing} property={property} onClose={() => setEditing(false)} />
      <SaleDialog open={selling} property={property} improvements={improvements} loans={ws.loans} onClose={() => setSelling(false)} />
      <PropertySheetModal property={showSheet ? property : null} onClose={() => setShowSheet(false)} />
    </>
  );
}
