import { DISMEMBERMENT_LABELS, DISMEMBERMENT_SOURCE, DISMEMBERMENTS, dismembermentRatio, usufructRate, type Dismemberment, type DismembermentFields as Fields } from "@hamac/core";
import { Field, FormGrid, Select, TextInput } from "@/components/form";
import { todayIso } from "@/lib/numbers";

/** Usufruit, nue-propriété ou pleine propriété, et ce qui sert à les évaluer. */
export function DismembermentFields({ value, onChange }: Readonly<{ value: Fields; onChange: (v: Fields) => void }>) {
  const today = todayIso();
  const missing = value.dismemberment !== "pleine" && !value.usufructBirthDate && !value.usufructEnd;
  const usufruct = value.dismemberment === "pleine" ? null : usufructRate(value, today);
  return (
    <div className="space-y-2">
      <FormGrid cols={3}>
        <Field label="Droit détenu">
          {(id) => (
            <Select id={id} value={value.dismemberment} onChange={(e) => onChange({ ...value, dismemberment: e.target.value as Dismemberment })}>
              {DISMEMBERMENTS.map((k) => (
                <option key={k} value={k}>
                  {DISMEMBERMENT_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {value.dismemberment !== "pleine" && (
          <>
            <Field label="Naissance de l'usufruitier" help={value.dismemberment === "usufruit" ? "La vôtre, si l'usufruit est à vie." : "L'usufruit est évalué selon son âge."}>
              {(id) => <TextInput id={id} type="date" value={value.usufructBirthDate ?? ""} onChange={(e) => onChange({ ...value, usufructBirthDate: e.target.value || null })} />}
            </Field>
            <Field label="Fin de l'usufruit" help="Seulement s'il est à durée fixe.">
              {(id) => <TextInput id={id} type="date" value={value.usufructEnd ?? ""} onChange={(e) => onChange({ ...value, usufructEnd: e.target.value || null })} />}
            </Field>
          </>
        )}
      </FormGrid>
      {value.dismemberment !== "pleine" && (
        <p className="text-xs text-fg-faint">
          {missing
            ? "Indiquez la date de naissance de l'usufruitier, ou la fin de l'usufruit s'il est à durée fixe."
            : `Valeur retenue aujourd'hui : ${Math.round(dismembermentRatio(value, today) * 100)} % du bien (usufruit ${Math.round((usufruct ?? 0) * 100)} %, barème fiscal). Elle évolue avec l'âge de l'usufruitier. `}
          <a href={DISMEMBERMENT_SOURCE.url} target="_blank" rel="noreferrer" className="underline hover:text-accent">
            {DISMEMBERMENT_SOURCE.label}
          </a>
        </p>
      )}
    </div>
  );
}

/** Le formulaire peut-il être enregistré : un démembrement demande de quoi l'évaluer. */
export const dismembermentComplete = (v: Fields) => v.dismemberment === "pleine" || v.usufructBirthDate != null || v.usufructEnd != null;
