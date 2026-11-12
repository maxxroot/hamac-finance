import { useState } from "react";
import { crowdInterestEntries, crowdWithholding, formatEur, formatPct, type Account, type PlanParams } from "@hamac/core";
import { Field, Modal, MoneyInput, Select, TextInput } from "@/shared/components/form";
import { Button } from "@/shared/components/ui";
import { formatMonth, todayIso } from "@/shared/lib/numbers";
import { useMutate } from "@/shared/lib/workspace";

/**
 * Intérêts bruts reçus sur un mois pour toute une plateforme, paiements partiels compris.
 * Si la plateforme prélève les impôts, ils sont calculés tout de suite et notés sur une seconde ligne du Journal.
 */
export function DeclareInterestDialog({
  platforms,
  taxes,
  params,
  journal,
  onClose,
}: {
  platforms: readonly Account[];
  taxes: ReadonlyMap<string, { withheld: boolean; rate: number }>;
  params: PlanParams;
  journal: ReadonlyArray<{ accountId: string; type: string; date: string; amount: number; gross?: number | null }>;
  onClose: () => void;
}) {
  const [accountId, setAccountId] = useState(platforms[0]?.id ?? "");
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [gross, setGross] = useState<number | null>(null);
  // null : impôts calculés d'après le taux de la plateforme (aucun si elle ne prélève pas) ; sinon, le montant lu sur son relevé.
  const [taxOverride, setTaxOverride] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useMutate("transactions.bulkCreate", { success: "Intérêts enregistrés" });

  const tax = taxes.get(accountId);
  const platformWithholds = tax?.withheld ?? false;
  const computed = gross != null && gross > 0 && tax ? crowdWithholding(gross, tax.rate, params, taxOverride ?? (platformWithholds ? undefined : 0)) : null;
  const withholding = computed && computed.total > 0 ? computed : null;
  const net = withholding && gross != null ? gross - withholding.total : null;
  const already = journal.filter((t) => t.accountId === accountId && t.type === "interets" && t.date.startsWith(`${month}-`)).reduce((s, t) => s + (t.gross ?? t.amount), 0);
  const invalid = !accountId || !month || !gross || gross <= 0 || (withholding != null && withholding.total >= gross);

  const submit = () => {
    setError(null);
    const items = crowdInterestEntries({ accountId, month, monthLabel: formatMonth(month), gross: gross!, withheld: withholding, today: todayIso() });
    save.mutate(
      { items },
      {
        onSuccess: (r) => {
          const out = r as { errors: Array<{ message: string }> };
          if (out.errors.length) setError(out.errors.map((e) => e.message).join(" "));
          else onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Déclarer les intérêts du mois"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || invalid} onClick={submit}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Plateforme">
          {(id) => (
            <Select
              id={id}
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setTaxOverride(null);
              }}
            >
              {platforms.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Mois">{(id) => <TextInput id={id} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>
        <Field label="Intérêts bruts" help="Avant impôts, tels qu'affichés par la plateforme avant son prélèvement.">
          {(id) => <MoneyInput id={id} value={gross} onChange={setGross} />}
        </Field>
        <Field
          label="Impôts prélevés"
          help={
            platformWithholds
              ? `Calculés au taux de la plateforme (${formatPct(tax!.rate)}). Corrigez-les s'ils diffèrent de son relevé.`
              : "Cette plateforme n'est pas réglée comme prélevant les impôts (case sur sa fiche, Paramètres › Établissements) : laissez vide s'ils restent à payer, sinon indiquez ce qu'elle a retenu."
          }
        >
          {(id) => <MoneyInput id={id} value={taxOverride ?? withholding?.total ?? null} onChange={setTaxOverride} />}
        </Field>
        {withholding && net != null && (
          <p className="text-sm text-fg-muted">
            Deux lignes au Journal : intérêts {formatEur(gross!)}, puis impôts {formatEur(withholding.total)} (acompte d'impôt {formatEur(withholding.incomeTax)}, prélèvements sociaux {formatEur(withholding.social)}). Reste crédité : {formatEur(net)}.
          </p>
        )}
        {withholding && withholding.total >= gross! && <p className="text-sm text-negative">Les impôts dépassent les intérêts.</p>}
        {already > 0 && <p className="text-sm text-warning">Déjà {formatEur(already)} d'intérêts déclarés pour ce mois sur cette plateforme.</p>}
        {error && <p className="text-sm text-negative">{error}</p>}
      </div>
    </Modal>
  );
}
