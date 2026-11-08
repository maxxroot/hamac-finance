import { Field, Select } from "@/components/form";

/** Choix par élément : dans ou hors de l'allocation cible, ou le comportement par défaut. */
export function AllocationChoice({ value, defaultLabel, onChange }: { value: boolean | null; defaultLabel: string; onChange: (v: boolean | null) => void }) {
  return (
    <Field label="Allocation cible" help="Hors allocation, l'élément reste compté dans le patrimoine. Il faut une cible pour sa classe dans Paramètres › Plan.">
      {(id) => (
        <Select id={id} value={value == null ? "" : value ? "in" : "out"} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "in")}>
          <option value="">Par défaut ({defaultLabel})</option>
          <option value="in">Dans l'allocation</option>
          <option value="out">Hors allocation</option>
        </Select>
      )}
    </Field>
  );
}
