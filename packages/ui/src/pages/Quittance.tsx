import { useParams } from "react-router";
import { formatEur, rentMonths, rentReceipt } from "@hamac/core";
import { PrintLine, PrintPage, PrintSection } from "@/components/PrintPage";
import { formatDate, formatMonth } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";

/** Quittance ou reçu d'un mois de loyer, à imprimer. */
export function Quittance() {
  const { leaseId, month } = useParams();
  const pf = usePortfolio();
  if (!pf) return null;
  const { ws } = pf.idx;
  const lease = ws.leases.find((l) => l.id === leaseId);
  const property = lease && ws.properties.find((p) => p.id === lease.propertyId);
  const rent = lease && rentMonths(lease, ws.leaseRents, ws.rentExceptions, pf.today).find((m) => m.month === month);
  const receipt = rent ? rentReceipt(rent) : null;
  if (!lease || !property || !rent || !receipt) return <PrintPage>Aucun paiement enregistré pour ce mois.</PrintPage>;
  const place = [property.address, [property.postalCode, property.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || property.name;
  const period = formatMonth(rent.month);
  const landlord = lease.landlord || "le propriétaire";
  const tenant = lease.tenant || "le locataire";
  return (
    <PrintPage>
      <h1 className="mb-1 text-xl font-semibold">{receipt.kind === "quittance" ? "Quittance de loyer" : "Reçu de paiement partiel"}</h1>
      <p className="mb-5 text-neutral-600">Période : {period}</p>
      <PrintSection title="Logement">
        <p>{place}</p>
      </PrintSection>
      <PrintSection title="Détail des sommes reçues">
        <PrintLine label="Loyer">{formatEur(receipt.rent)}</PrintLine>
        <PrintLine label="Charges">{formatEur(receipt.charges)}</PrintLine>
        <PrintLine label="Total">{formatEur(receipt.total)}</PrintLine>
      </PrintSection>
      <p className="mt-6">
        Je soussigné(e) {landlord}, déclare avoir reçu de {tenant} la somme de {formatEur(receipt.total)} au titre du loyer et des charges de {period}
        {receipt.kind === "quittance" ? " et lui en donne quittance, sous réserve de tous mes droits." : ", à titre de paiement partiel."}
      </p>
      <p className="mt-8">Fait le {formatDate(pf.today)}</p>
      <p className="mt-2">Signature :</p>
    </PrintPage>
  );
}
