import { useEffect, useState } from "react";
import { loanPayoffAt, propertySale, type Loan, type Property } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, TextInput } from "@/shared/components/form";
import { Button } from "@/shared/components/ui";
import { todayIso } from "@/shared/lib/numbers";
import { useMutate } from "@/shared/lib/workspace";

/** Vente du bien : il sort du patrimoine à cette date, son bilan reste sur la fiche. */
export function SaleDialog({ open, property, improvements, loans, onClose }: { open: boolean; property: Property; improvements: number; loans: readonly Loan[]; onClose: () => void }) {
  const [saleDate, setSaleDate] = useState("");
  const [salePrice, setSalePrice] = useState<number | null>(null);
  const [saleFees, setSaleFees] = useState(0);
  const [closeLoans, setCloseLoans] = useState(true);
  const sell = useMutate("properties.sell", { success: "Vente enregistrée" });
  useEffect(() => {
    if (!open) return;
    setSaleDate(todayIso());
    setSalePrice(null);
    setSaleFees(0);
    setCloseLoans(true);
  }, [open]);
  const tooEarly = property.purchaseDate != null && saleDate !== "" && saleDate < property.purchaseDate;
  const preview = salePrice != null && saleDate && !tooEarly ? propertySale({ ...property, saleDate, salePrice, saleFees }, improvements, closeLoans ? loanPayoffAt(loans, property.id, saleDate) : 0) : null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Vendre « ${property.name} »`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={sell.isPending || !saleDate || salePrice == null || tooEarly} onClick={() => sell.mutate({ id: property.id, saleDate, salePrice: salePrice!, saleFees, closeLoans }, { onSuccess: onClose })}>
            Enregistrer la vente
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={3}>
          <Field label="Date de vente" error={tooEarly ? "Avant la date d'achat." : null}>{(id) => <TextInput id={id} type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />}</Field>
          <Field label="Prix de vente" help="Pour le bien entier.">{(id) => <MoneyInput id={id} value={salePrice} onChange={setSalePrice} />}</Field>
          <Field label="Frais de vente" help="Agence, diagnostics…">{(id) => <MoneyInput id={id} value={saleFees} onChange={(v) => setSaleFees(v ?? 0)} />}</Field>
        </FormGrid>
        <Checkbox checked={closeLoans} onChange={setCloseLoans} label="Solder les crédits rattachés à cette date" />
        {preview && (
          <p className="text-sm text-fg-muted">
            Pour votre part : gain <b className="text-fg">{preview.gain == null ? "inconnu sans prix d'achat" : <Amount value={preview.gain} signed />}</b> avant impôt, et <b className="text-fg"><Amount value={preview.net} /></b> restant après remboursement du crédit.
          </p>
        )}
        <p className="text-xs text-fg-faint">Si l'argent arrive sur un compte suivi dans Hamac, notez aussi le versement dans le Journal. L'impôt sur la plus-value n'est pas calculé.</p>
      </div>
    </Modal>
  );
}
