import { CURRENCIES, currencyName, EUR } from "@hamac/core";
import { Field, Select } from "@/shared/components/form";

/** L'euro et le dollar d'abord, puis les autres devises de la BCE par nom. */
const ORDER = [EUR, "USD", ...CURRENCIES.filter((c) => c !== EUR && c !== "USD").sort((a, b) => currencyName(a).localeCompare(currencyName(b), "fr"))];

/** Devise de cotation d'un titre : l'euro ou une devise dont la BCE publie le taux. */
export function CurrencyField({ value, onChange, help }: { value: string; onChange: (code: string) => void; help?: string }) {
  return (
    <Field label="Devise" help={help ?? "Celle du cours et du nominal. Les opérations restent en euros, au taux de change du jour."}>
      {(id) => (
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {ORDER.map((c) => (
            <option key={c} value={c}>
              {c} · {currencyName(c)}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
