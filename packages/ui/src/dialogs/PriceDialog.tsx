import { useEffect, useState } from "react";
import type { Asset } from "@hamac/core";
import { Field, FormGrid, Modal, MoneyInput, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { todayIso } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

/** Saisie d'un cours à la main (prioritaire sur le cours automatique du même jour). */
export function PriceDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const save = useMutate("prices.setManual", { success: "Cours enregistré" });
  const [price, setPrice] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  useEffect(() => {
    if (asset) {
      setPrice(asset.manualPrice);
      setDate(todayIso());
    }
  }, [asset]);
  if (!asset) return null;
  const bond = asset.kind === "obligation";
  return (
    <Modal
      open
      onClose={onClose}
      title={`Cours de « ${asset.name} »`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!price} onClick={() => price && save.mutate({ assetId: asset.id, date, price }, { onSuccess: onClose })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label={bond ? "Cours (% du nominal, pied de coupon)" : "Cours"}>{(id) => <MoneyInput id={id} value={price} decimals={4} onChange={setPrice} autoFocus />}</Field>
        <Field label="Date">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      </FormGrid>
    </Modal>
  );
}
