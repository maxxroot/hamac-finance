import { useParams } from "react-router";
import { LEASE_KIND_LABELS, formatEur, leaseArrears, leaseState, rentLedgerOf } from "@hamac/core";
import { PrintPage } from "@/shared/components/PrintPage";
import { leaseAddressee, leasePlace } from "@/features/realestate/lib/leaseLetters";
import { formatDate } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";

/** Attestation de loyer : le locataire occupe le logement, pour quel loyer, et s'il est à jour de ses paiements. */
export function AttestationLoyer() {
  const { leaseId } = useParams();
  const pf = usePortfolio();
  if (!pf) return null;
  const { ws } = pf.idx;
  const lease = ws.leases.find((l) => l.id === leaseId);
  const property = lease && ws.properties.find((p) => p.id === lease.propertyId);
  if (!lease || !property) return <PrintPage>Bail introuvable.</PrintPage>;
  const state = leaseState(lease, ws.leaseRents, pf.today);
  const arrears = leaseArrears(lease, ws.leaseRents, rentLedgerOf(ws), pf.today);
  const tenant = leaseAddressee(lease, ws, "le locataire");
  const ended = state.status === "termine" && state.end;
  return (
    <PrintPage>
      <h1 className="mb-6 text-xl font-semibold">Attestation de loyer</h1>
      <p className="mb-4">
        Je soussigné(e) {lease.landlord || "le propriétaire"}, propriétaire du logement situé {leasePlace(property, lease, ws)}, atteste que {tenant} {ended ? "en a été locataire" : "en est locataire"} ({LEASE_KIND_LABELS[lease.kind].toLowerCase()}) depuis le {formatDate(lease.startDate)}
        {ended ? ` jusqu'au ${formatDate(state.end)}` : ""}, pour un loyer mensuel de {formatEur(state.rent)} hors charges et {formatEur(state.charges)} de charges.
      </p>
      <p className="mb-4">{arrears ? `À la date du ${formatDate(pf.today)}, il reste dû ${formatEur(arrears.total)} au titre des loyers et charges.` : `À la date du ${formatDate(pf.today)}, ${tenant} est à jour du paiement de ses loyers et charges.`}</p>
      <p className="mb-4">Attestation établie pour servir et valoir ce que de droit.</p>
      <p className="mt-8">Fait le {formatDate(pf.today)}</p>
      <p className="mt-2">Signature :</p>
    </PrintPage>
  );
}
