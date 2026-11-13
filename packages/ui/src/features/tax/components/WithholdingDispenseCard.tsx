import { DISPENSE_CEILING, institutionWithholds, type PlanParams } from "@hamac/core";
import { Checkbox } from "@/shared/components/form";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useMutate } from "@/shared/lib/workspace";

type Dispense = PlanParams["tax"]["withholdingDispenses"][number];

/**
 * Dispense de l'acompte de 12,8 % sur les intérêts, par année puis par établissement : la demande se fait auprès de
 * chacun. Années proposées : l'année en cours, la suivante (demande avant le 30 novembre) et toute année déjà cochée.
 * Enregistrée dans Paramètres › Plan (`tax.withholdingDispenses`).
 */
export function WithholdingDispenseCard() {
  const pf = usePortfolio();
  const save = useMutate("params.update", { success: "Dispense enregistrée" });
  if (!pf) return null;
  const { params } = pf.data;
  const year = +pf.today.slice(0, 4);
  const entries = params.tax.withholdingDispenses;
  const years = [...new Set([year, year + 1, ...entries.map((e) => e.year)])].sort((a, b) => b - a);
  const ceiling = params.profile.couple ? DISPENSE_CEILING.couple : DISPENSE_CEILING.single;
  // Établissements des comptes-titres et plateformes de crowdlending : ceux qui versent des intérêts soumis à l'acompte.
  const usedIds = new Set(pf.data.accounts.filter((a) => (a.kind === "cto" || a.kind === "crowdlending") && !a.archived && a.institutionId).map((a) => a.institutionId!));
  const institutions = (pf.data.institutions ?? []).filter((i) => usedIds.has(i.id) || entries.some((e) => e.institutionIds?.includes(i.id))).sort((a, b) => a.name.localeCompare(b.name));

  const write = (next: Dispense[]) => save.mutate({ ...params, tax: { ...params.tax, withholdingDispenses: [...next].sort((a, b) => a.year - b.year) } });
  const toggleYear = (y: number, on: boolean) => write(on ? [...entries, { year: y, institutionIds: [] }] : entries.filter((e) => e.year !== y));
  const toggleInstitution = (entry: Dispense, id: string, on: boolean) => {
    // « Tous » (ancienne case unique) : on part de tous les établissements affichés.
    const current = entry.institutionIds ?? institutions.map((i) => i.id);
    const ids = on ? [...new Set([...current, id])] : current.filter((x) => x !== id);
    write(entries.map((e) => (e.year === entry.year ? { ...e, institutionIds: ids } : e)));
  };

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-2 font-medium">Dispense de l'acompte de 12,8 % sur les intérêts</h2>
      <p className="mb-4 text-sm text-fg-muted">
        Sur les coupons d'obligations et les intérêts de crowdlending, l'établissement retient un acompte d'impôt de 12,8 % (prélèvement forfaitaire non libératoire), imputé l'année suivante sur
        l'impôt. Si le revenu fiscal de référence de l'avant-dernière année est inférieur à {ceiling.toLocaleString("fr-FR")} € ({params.profile.couple ? "couple marié ou pacsé" : "personne seule"}), une
        attestation remise à un établissement avant le 30 novembre l'en dispense pour l'année suivante. La demande se fait auprès de chaque établissement : cochez l'année, puis ceux qui l'ont reçue. Les
        prélèvements sociaux restent retenus, et l'impôt reste dû à la déclaration. Les dividendes font l'objet d'une demande distincte, non suivie ici.
      </p>
      <div className="space-y-3">
        {years.map((y) => {
          const entry = entries.find((e) => e.year === y);
          return (
            <div key={y}>
              <Checkbox checked={entry != null} onChange={(v) => toggleYear(y, v)} label={<span className="font-medium">{y === year + 1 ? `Dispensé pour ${y} (demande avant le 30/11/${year})` : `Dispensé pour ${y}`}</span>} />
              {entry && (
                <div className="mt-2 ml-6.5 space-y-1.5">
                  {institutions.length === 0 ? (
                    <p className="text-sm text-fg-faint">Rattachez vos comptes-titres et plateformes à leur établissement (Paramètres › Comptes) pour indiquer où la dispense a été demandée.</p>
                  ) : (
                    <div role="group" aria-label={`Établissements dispensés pour ${y}`} className="flex flex-wrap gap-x-6 gap-y-1.5">
                      {institutions.map((i) => (
                        <Checkbox
                          key={i.id}
                          checked={entry.institutionIds == null || entry.institutionIds.includes(i.id)}
                          onChange={(v) => toggleInstitution(entry, i.id, v)}
                          label={
                            <>
                              {i.name}
                              {!institutionWithholds(i) && <span className="ml-1.5 text-xs text-fg-faint">(ne prélève rien)</span>}
                            </>
                          }
                        />
                      ))}
                    </div>
                  )}
                  {entry.institutionIds?.length === 0 && institutions.length > 0 && <p className="text-xs text-warning">Cochez les établissements auprès desquels la demande a été faite : sans eux, la dispense ne s'applique nulle part.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
