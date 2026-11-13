import { Field, FormGrid, NumberInput, Select } from "@/shared/components/form";
import { Section } from "./Section";
import { PlanDraft, planFields } from "./usePlanDraft";

/** Paramètres › Plan › Biens en location : valeurs proposées, hypothèses du cashflow et régimes fiscaux du foyer. */
export function RentalSection({ draft }: { draft: PlanDraft }) {
  const { p, setP, issues } = draft;
  if (!p) return null;
  const { set, err, pctField, eurField } = planFields(p, setP, issues);
  return (
    <Section title="Biens en location" hint="Valeurs proposées par défaut : chaque dépense garde sa part récupérable, et chaque bien peut avoir ses propres provisions.">
      <FormGrid cols={3}>
        {pctField("Copropriété récupérable sur le locataire", ["rental", "coproRecoverable"], "Part des charges du syndic que le locataire rembourse. Deux tiers en général.")}
        {pctField("Provision pour vacance", ["rental", "vacancyRate"], "Part du loyer hors charges mise de côté pour les mois sans locataire.")}
        {pctField("Provision pour travaux", ["rental", "worksRate"], "Part du loyer hors charges mise de côté pour l'entretien.")}
        {pctField("Cashflow neutre", ["rental", "neutralBand"], "Écart à zéro, en part du loyer, en dessous duquel un bien n'est ni positif ni négatif.")}
        <Field label="Taxe foncière estimée" help="En mois de loyer hors charges, tant que l'avis n'est pas saisi." error={err(["rental", "propertyTaxMonths"])}>
          {(id) => <NumberInput id={id} decimals={2} suffix="mois" value={p.rental.propertyTaxMonths} onChange={(v) => set(["rental", "propertyTaxMonths"], v ?? 0)} />}
        </Field>
      </FormGrid>
      <div className="mt-4 mb-2 text-xs font-medium text-fg-muted">Impôts sur les loyers : un régime pour tout le foyer</div>
      <FormGrid cols={3}>
        <Field label="Location vide" help="Micro-foncier : 30 % d'abattement, jusqu'à 15 000 € de loyers. Réel : charges réelles et déficit.">
          {(id) => (
            <Select id={id} value={p.rental.unfurnishedRegime} onChange={(e) => set(["rental", "unfurnishedRegime"], e.target.value)}>
              <option value="micro">Micro-foncier</option>
              <option value="reel">Réel</option>
            </Select>
          )}
        </Field>
        <Field label="Location meublée (LMNP)" help="Micro-BIC : 50 % d'abattement. Réel : charges, amortissements et frais comptables.">
          {(id) => (
            <Select id={id} value={p.rental.furnishedRegime} onChange={(e) => set(["rental", "furnishedRegime"], e.target.value)}>
              <option value="micro">Micro-BIC</option>
              <option value="reel">Réel</option>
            </Select>
          )}
        </Field>
        {eurField("Frais comptables (meublé au réel)", ["rental", "accountingFees"], "Comptable et organisme de gestion agréé, par an, pour tout le foyer.")}
        {pctField("Part du terrain (meublé au réel)", ["rental", "landShare"], "Part du prix qui ne s'amortit pas. 15 % en général, plus en maison.")}
      </FormGrid>
      <div className="mt-4 mb-2 text-xs font-medium text-fg-muted">Projection et revente : hausse par an</div>
      <FormGrid cols={3}>
        {pctField("Loyers", ["rental", "rentGrowth"], "Révision annuelle (indice de référence des loyers).")}
        {pctField("Charges", ["rental", "chargesGrowth"], "Taxe foncière, copropriété, assurance, gestion.")}
        {pctField("Valeur du bien", ["rental", "valueGrowth"], "Peut être négative.")}
      </FormGrid>
    </Section>
  );
}
