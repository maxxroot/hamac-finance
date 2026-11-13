import { Checkbox } from "@/shared/components/form";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useMutate } from "@/shared/lib/workspace";

/** Plafond de revenu fiscal de référence (avant-dernière année) pour la dispense sur les intérêts (impots.gouv.fr, CGI art. 125 A). */
const CEILING = { single: 25_000, couple: 50_000 };

/**
 * Dispense de l'acompte de 12,8 % sur les intérêts, année par année : l'année en cours, la suivante (demande avant
 * le 30 novembre), et toute année déjà cochée. Enregistrée dans Paramètres › Plan (`tax.withholdingDispenseYears`).
 */
export function WithholdingDispenseCard() {
  const pf = usePortfolio();
  const save = useMutate("params.update", { success: "Dispense enregistrée" });
  if (!pf) return null;
  const params = pf.data.params;
  const year = +pf.today.slice(0, 4);
  const chosen = params.tax.withholdingDispenseYears;
  const years = [...new Set([year, year + 1, ...chosen])].sort((a, b) => b - a);
  const ceiling = params.profile.couple ? CEILING.couple : CEILING.single;
  const toggle = (y: number, on: boolean) => {
    const next = on ? [...new Set([...chosen, y])].sort((a, b) => a - b) : chosen.filter((x) => x !== y);
    save.mutate({ ...params, tax: { ...params.tax, withholdingDispenseYears: next } });
  };

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-2 font-medium">Dispense de l'acompte de 12,8 % sur les intérêts</h2>
      <p className="mb-3 text-sm text-fg-muted">
        Sur les coupons d'obligations et les intérêts de crowdlending, l'établissement retient un acompte d'impôt de 12,8 % (prélèvement forfaitaire non libératoire), imputé l'année suivante sur
        l'impôt. Si le revenu fiscal de référence de l'avant-dernière année est inférieur à {ceiling.toLocaleString("fr-FR")} € ({params.profile.couple ? "couple marié ou pacsé" : "personne seule"}), une
        attestation remise à chaque établissement avant le 30 novembre en dispense pour l'année suivante. Les prélèvements sociaux restent retenus, et l'impôt reste dû à la déclaration. Les dividendes font
        l'objet d'une demande distincte, non suivie ici.
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {years.map((y) => (
          <Checkbox
            key={y}
            checked={chosen.includes(y)}
            onChange={(v) => toggle(y, v)}
            label={y === year + 1 ? `Dispensé pour ${y} (demande avant le 30/11/${year})` : `Dispensé pour ${y}`}
          />
        ))}
      </div>
    </section>
  );
}
