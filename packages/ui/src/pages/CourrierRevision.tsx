import { useParams } from "react-router";
import { leaseRenterNames, LEASE_KIND_LABELS, formatEur, irlQuarterLabel, irlZone, IRL_ZONE_LABELS, revisedRent, revisionEffectiveDate } from "@hamac/core";
import { PrintLine, PrintPage, PrintSection } from "@/components/PrintPage";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";

const indexText = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = (v: number) => `${(v * 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

/** Courrier de révision du loyer, avec le détail du calcul, à imprimer. */
export function CourrierRevision() {
  const { rentId } = useParams();
  const pf = usePortfolio();
  if (!pf) return null;
  const { ws } = pf.idx;
  const change = ws.leaseRents.find((r) => r.id === rentId);
  const lease = change && ws.leases.find((l) => l.id === change.leaseId);
  const property = lease && ws.properties.find((p) => p.id === lease.propertyId);
  const revision = change?.revision;
  if (!change || !lease || !property || !revision) return <PrintPage>Aucune révision enregistrée.</PrintPage>;
  const place = [property.address, [property.postalCode, property.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || property.name;
  const effective = revisionEffectiveDate(revision.anniversary, revision.demandDate);
  const computed = revisedRent(revision.previousRent, revision.indexOld, revision.indexNew);
  const zone = irlZone(property.postalCode);
  return (
    <PrintPage>
      <div className="mb-8 grid grid-cols-2 gap-8">
        <div>
          <p className="font-semibold">{lease.landlord || "Le propriétaire"}</p>
          {lease.landlordAddress && <p className="whitespace-pre-line">{lease.landlordAddress}</p>}
        </div>
        <div className="text-right">
          <p className="font-semibold">{leaseRenterNames(lease.id, ws.leaseRenters, ws.renters) || "Le locataire"}</p>
          <p>{place}</p>
        </div>
      </div>
      <p className="mb-4 text-right">Le {formatDate(revision.demandDate)}</p>
      <h1 className="mb-4 text-base font-semibold">Objet : révision annuelle du loyer</h1>

      <p className="mb-3">Madame, Monsieur,</p>
      <p className="mb-5">
        Conformément à la clause de révision de votre contrat de location ({LEASE_KIND_LABELS[lease.kind].toLowerCase()}) du {formatDate(lease.startDate)}, portant sur le logement situé {place}, et à l'article 17-1 de la loi n° 89-462 du 6 juillet 1989, votre loyer est révisé à compter du <b>{formatDate(effective)}</b>, selon la variation de l'indice de référence des loyers publié par l'INSEE.
      </p>

      <PrintSection title={`Détail du calcul (indice : ${IRL_ZONE_LABELS[zone]})`}>
        <PrintLine label="Loyer actuel hors charges">{formatEur(revision.previousRent)}</PrintLine>
        <PrintLine label={`Indice du ${irlQuarterLabel(revision.quarterOld)}`}>{indexText(revision.indexOld)}</PrintLine>
        <PrintLine label={`Indice du ${irlQuarterLabel(revision.quarterNew)}`}>{indexText(revision.indexNew)}</PrintLine>
        <PrintLine label="Variation de l'indice sur un an">{percent(revision.indexNew / revision.indexOld - 1)}</PrintLine>
        <PrintLine label="Calcul">
          {formatEur(revision.previousRent)} × {indexText(revision.indexNew)} / {indexText(revision.indexOld)} = {formatEur(computed)}
        </PrintLine>
      </PrintSection>

      <PrintSection title={`Montants dus à compter du ${formatDate(effective)}`}>
        <PrintLine label="Nouveau loyer hors charges">{formatEur(change.rent)}</PrintLine>
        <PrintLine label="Charges (inchangées)">{formatEur(change.charges)}</PrintLine>
        <PrintLine label="Total mensuel">{formatEur(change.rent + change.charges)}</PrintLine>
      </PrintSection>

      <p className="mt-6">Je vous remercie de bien vouloir prendre en compte ce nouveau montant pour vos prochains règlements.</p>
      <p className="mt-3">Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>
      <p className="mt-8">Signature :</p>
    </PrintPage>
  );
}
