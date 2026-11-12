import { useParams } from "react-router";
import { formatEur, rentLedgerOf, rentMonths } from "@hamac/core";
import { PrintLine, PrintPage, PrintSection } from "@/shared/components/PrintPage";
import { leaseAddressee, leasePlace } from "@/features/realestate/lib/leaseLetters";
import { formatDate, formatMonth } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";

/** Avis d'échéance (appel de loyer) d'un mois, avec ce qui reste dû des mois précédents, à imprimer. */
export function AvisEcheance() {
  const { leaseId, month } = useParams();
  const pf = usePortfolio();
  if (!pf) return null;
  const { ws } = pf.idx;
  const lease = ws.leases.find((l) => l.id === leaseId);
  const property = lease && ws.properties.find((p) => p.id === lease.propertyId);
  // Le mois peut être à venir : on calcule jusqu'à sa fin.
  const months = lease && month ? rentMonths(lease, ws.leaseRents, rentLedgerOf(ws), `${month}-28` > pf.today ? `${month}-28` : pf.today) : [];
  const current = months.find((m) => m.month === month);
  if (!lease || !property || !current) return <PrintPage>Aucune échéance pour ce mois.</PrintPage>;
  const before = months.filter((m) => m.month < current.month).reduce((s, m) => s + m.outstanding, 0);
  return (
    <PrintPage>
      <div className="mb-8 grid grid-cols-2 gap-8">
        <div>
          <p className="font-semibold">{lease.landlord || "Le propriétaire"}</p>
          {lease.landlordAddress && <p className="whitespace-pre-line">{lease.landlordAddress}</p>}
        </div>
        <div className="text-right">
          <p className="font-semibold">{leaseAddressee(lease, ws)}</p>
          <p>{leasePlace(property, lease, ws)}</p>
        </div>
      </div>
      <h1 className="mb-1 text-xl font-semibold">Avis d'échéance</h1>
      <p className="mb-5 text-neutral-600">Période : {formatMonth(current.month)}</p>
      <PrintSection title="Montants à régler">
        <PrintLine label="Loyer hors charges">{formatEur(current.expectedRent)}</PrintLine>
        <PrintLine label="Provision sur charges">{formatEur(current.expectedCharges)}</PrintLine>
        {current.waiver && <PrintLine label="Mois remis">{formatEur(-(current.expectedRent + current.expectedCharges))}</PrintLine>}
        {current.paid > 0 && <PrintLine label="Déjà reçu pour ce mois">{formatEur(-current.paid)}</PrintLine>}
        {before > 0 && <PrintLine label="Reste dû des mois précédents">{formatEur(before)}</PrintLine>}
        <PrintLine label={`Total à régler au plus tard le ${formatDate(current.dueDate)}`}>
          <b>{formatEur(current.outstanding + before)}</b>
        </PrintLine>
      </PrintSection>
      <p className="mt-6 text-neutral-600">Cet avis n'est pas une quittance : la quittance est remise une fois le paiement reçu.</p>
    </PrintPage>
  );
}
