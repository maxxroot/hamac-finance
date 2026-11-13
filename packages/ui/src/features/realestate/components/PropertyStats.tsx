import type { Property, PropertySummary } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Stat, StatGrid } from "@/shared/components/Stat";
import type { Rentability } from "@/features/realestate/lib/rentability";
import { formatDate } from "@/shared/lib/numbers";

/**
 * Quatre chiffres en tête de la page d'un bien. En location : valeur nette, cashflow réel, effort net et enrichissement ;
 * sinon : valeur, coût, gain estimé et valeur nette.
 */
export function PropertyStats({ property, summary, improvements, rentability }: { property: Property; summary: PropertySummary; improvements: number; rentability: Rentability | null }) {
  const s = summary;
  if (rentability) {
    const { cashflow, balance } = rentability;
    return (
      <StatGrid>
        <Stat label="Valeur nette" sub="valeur détenue − capital restant dû">
          <Amount value={s.netValue} compact />
        </Stat>
        <Stat label="Cashflow réel" sub={cashflow.real ? `par mois, sur ${cashflow.real.months} mois, avant impôt` : "pas encore de mois complet loué"}>
          {cashflow.real ? <Amount value={cashflow.real.total} signed /> : "—"}
        </Stat>
        <Stat label="Effort net depuis l'achat" sub={balance?.monthlyEffort != null ? <>soit <Amount value={balance.monthlyEffort} /> par mois</> : "prix d'achat à renseigner"}>
          {balance?.netEffort == null ? "—" : <Amount value={balance.netEffort} compact />}
        </Stat>
        <Stat label="Enrichissement" sub="valeur nette − effort net, avant impôt">
          {balance?.enrichment == null ? "—" : <Amount value={balance.enrichment} signed compact />}
        </Stat>
      </StatGrid>
    );
  }
  return (
    <StatGrid>
      <Stat label="Valeur détenue" sub={property.valueDate ? `estimée le ${formatDate(property.valueDate)}` : "part détenue"}>
        <span className="text-2xl">
          <Amount value={s.heldValue} compact />
        </span>
      </Stat>
      <Stat label={improvements > 0 ? "Coût total" : "Coût d'achat"} sub={improvements > 0 ? "frais et améliorations compris, part détenue" : "frais compris, part détenue"}>
        {s.heldCost == null ? "—" : <Amount value={s.heldCost} compact />}
      </Stat>
      <Stat label="Gain estimé" sub="valeur détenue − coût d'achat, avant impôt">
        {s.gain == null ? "—" : <Amount value={s.gain} signed compact />}
      </Stat>
      <Stat label="Valeur nette" sub="après capital restant dû à votre charge">
        <Amount value={s.netValue} compact />
      </Stat>
    </StatGrid>
  );
}
