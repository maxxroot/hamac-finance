import { countryName, maturityFromMonth, OAT_MATURITY_DAY, SOVEREIGN_COUNTRIES } from "@hamac/core";
import { CountryPicker } from "@/shared/components/CountryPicker";
import { Field, TextInput } from "@/shared/components/form";

/** Pays de l'État émetteur d'une obligation d'État, choisi dans la liste des États avec recherche. */
export function SovereignField({ value, onChange }: { value: string | null; onChange: (code: string) => void }) {
  return (
    <Field label="Pays de l'État émetteur" help="Tapez quelques lettres pour chercher.">
      {(id) => <CountryPicker id={id} value={value} codes={SOVEREIGN_COUNTRIES} label={countryName} onChange={onChange} />}
    </Field>
  );
}

/**
 * Échéance d'une obligation. OAT : mois et année, remboursée le 25. Autre État : la date exacte, qui varie d'une émission
 * à l'autre (une OLO tombe souvent le 22). Entreprise : mois et année, le 1er du mois si le jour n'est pas connu.
 */
export function BondMaturityField({ value, oat, exact, onChange }: { value: string | null; oat: boolean; exact: boolean; onChange: (date: string | null) => void }) {
  if (exact) {
    return (
      <Field label="Échéance" help="Date exacte du remboursement, indiquée sur la fiche du titre.">
        {(id) => <TextInput id={id} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />}
      </Field>
    );
  }
  return (
    <Field label="Échéance" help={oat ? `Mois et année ; une OAT est remboursée le ${OAT_MATURITY_DAY} du mois.` : "Mois et année."}>
      {(id) => <TextInput id={id} type="month" value={value?.slice(0, 7) ?? ""} onChange={(e) => onChange(e.target.value ? maturityFromMonth(e.target.value, oat) : null)} />}
    </Field>
  );
}
