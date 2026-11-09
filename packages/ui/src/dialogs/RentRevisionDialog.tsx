import { useEffect, useState } from "react";
import { irlQuarterLabel, revisedRent, revisionEffectiveDate, revisionStillPossible, type Lease, type RevisionProposal } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Field, FormGrid, Modal, MoneyInput, NumberInput, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { formatDate, todayIso } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

/** Applique la révision annuelle : calcul détaillé, indices modifiables, puis courrier au locataire. */
export function RentRevisionDialog({ proposal, lease, onClose }: { proposal: RevisionProposal | null; lease: Lease; onClose: () => void }) {
  const [indexNew, setIndexNew] = useState<number | null>(null);
  const [indexOld, setIndexOld] = useState<number | null>(null);
  const [demandDate, setDemandDate] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);
  const save = useMutate("leaseRents.upsert", { success: "Loyer révisé : le courrier est prêt" });
  useEffect(() => {
    if (!proposal) return;
    setIndexNew(proposal.indexNew);
    setIndexOld(proposal.indexOld);
    setDemandDate(todayIso());
    setChosen(null);
  }, [proposal]);
  if (!proposal) return null;
  const maximum = indexNew && indexOld ? revisedRent(proposal.previousRent, indexOld, indexNew) : null;
  const rent = chosen ?? maximum;
  const tooHigh = rent != null && maximum != null && rent > maximum;
  const tooLate = demandDate !== "" && !revisionStillPossible(proposal.anniversary, demandDate);
  const effective = demandDate ? revisionEffectiveDate(proposal.anniversary, demandDate) : null;
  const ready = indexNew != null && indexNew > 0 && indexOld != null && indexOld > 0 && rent != null && rent > 0 && !tooHigh && !tooLate && effective != null;
  return (
    <Modal
      open
      onClose={onClose}
      title="Révision annuelle du loyer"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            disabled={save.isPending || !ready}
            onClick={() =>
              save.mutate(
                { leaseId: lease.id, fromMonth: effective!.slice(0, 7), rent: rent!, charges: proposal.charges, revision: { anniversary: proposal.anniversary, demandDate, previousRent: proposal.previousRent, quarterNew: proposal.quarterNew, quarterOld: proposal.quarterOld, indexNew: indexNew!, indexOld: indexOld! } },
                { onSuccess: onClose },
              )
            }
          >
            Appliquer la révision
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">
          Anniversaire du bail : <b className="text-fg">{formatDate(proposal.anniversary)}</b>. Loyer actuel hors charges : <b className="text-fg"><Amount value={proposal.previousRent} /></b>.
        </p>
        <FormGrid>
          <Field label={`Indice du ${irlQuarterLabel(proposal.quarterNew)}`} help={proposal.indexNew == null ? "Pas encore connu : saisissez la valeur publiée par l'INSEE." : "Publié par l'INSEE."}>
            {(id) => <NumberInput id={id} decimals={2} grouping={false} value={indexNew} onChange={setIndexNew} />}
          </Field>
          <Field label={`Indice du ${irlQuarterLabel(proposal.quarterOld)}`} help="Même trimestre, un an plus tôt.">
            {(id) => <NumberInput id={id} decimals={2} grouping={false} value={indexOld} onChange={setIndexOld} />}
          </Field>
          <Field label="Date de la demande" error={tooLate ? "Plus d'un an après l'anniversaire : la révision de cette année n'est plus possible." : null} help="Si elle est après l'anniversaire, la révision ne prend effet qu'à cette date.">
            {(id) => <TextInput id={id} type="date" value={demandDate} onChange={(e) => setDemandDate(e.target.value)} />}
          </Field>
          <Field label="Nouveau loyer hors charges" error={tooHigh ? "Au-delà de la variation de l'indice." : null} help="Calculé ; vous pouvez appliquer moins, pas plus.">
            {(id) => <MoneyInput id={id} value={rent} onChange={setChosen} />}
          </Field>
        </FormGrid>
        {maximum != null && effective && (
          <p className="text-sm text-fg-muted">
            <Amount value={proposal.previousRent} /> × {indexNew} / {indexOld} = <b className="text-fg"><Amount value={maximum} /></b>, à compter du <b className="text-fg">{formatDate(effective)}</b>. Les charges ne changent pas.
          </p>
        )}
      </div>
    </Modal>
  );
}
