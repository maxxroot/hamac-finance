import { Checkbox, Field, FormGrid, Select, TextInput } from "@/shared/components/form";
import { MODULES, MODULE_LABELS, formatPct, incomeTaxRate, retirementYear, taxRegimeLabel } from "@hamac/core";
import { cn } from "@/shared/lib/cn";
import { RentalSection } from "./RentalSection";
import { Section } from "./Section";
import { PlanDraft, planFields } from "./usePlanDraft";

export function PlanTab({ draft }: { draft: PlanDraft }) {
  const { p, setP, idx, issues } = draft;
  if (!p || !idx) return null;
  const { set, err, pctField, eurField, intField } = planFields(p, setP, issues);
  const year = new Date().getFullYear();
  const age = year - p.profile.birthYear;
  const retraite = p.profile.goal === "retraite";

  return (
    <div className="space-y-5">
      <Section title="Usage" hint="Ce que Hamac doit faire pour vous. Vous pouvez changer à tout moment : vos données ne bougent pas.">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
          {(
            [
              ["retraite", "Préparer ma retraite", "Projection jusqu'au départ, revenu mensuel possible, part actions qui baisse à l'approche de la retraite."],
              ["patrimoine", "Gérer mon patrimoine", "Suivi, allocation cible fixe, versements et alertes, sans projection de retraite."],
            ] as const
          ).map(([goal, label, text]) => (
            <button
              key={goal}
              type="button"
              role="radio"
              aria-checked={p.profile.goal === goal}
              onClick={() => set(["profile", "goal"], goal)}
              className={cn(
                "rounded-lg border px-4 py-3 text-left transition-colors",
                p.profile.goal === goal ? "border-accent bg-accent/10" : "border-line hover:border-fg-faint hover:bg-surface-2",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className={cn("size-3.5 rounded-full border-2", p.profile.goal === goal ? "border-accent bg-accent" : "border-fg-faint")} />
                {label}
              </div>
              <p className="mt-1 pl-5.5 text-xs text-fg-muted">{text}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Modules" hint="Les pages affichées dans le menu. Masquer un module ne supprime rien et ne change aucun calcul.">
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-3">
          {MODULES.map((m) => (
            <Checkbox key={m} checked={p.modules[m]} onChange={(v) => set(["modules", m], v)} label={MODULE_LABELS[m]} />
          ))}
        </div>
      </Section>

      <Section title={retraite ? "Profil et calendrier" : "Profil et versements"}>
        <FormGrid cols={3}>
          {intField("Année de naissance", ["profile", "birthYear"], `Âge cette année : ${age} ans.`)}
          {retraite && intField("Âge de départ visé", ["profile", "retirementAge"], `Départ en ${retirementYear(p)}.`)}
          {retraite && intField("Âge de début de sécurisation", ["profile", "securisationAge"], "À partir de cet âge, la part actions baisse progressivement.")}
          {retraite && intField("Âge horizon (fin des retraits)", ["profile", "horizonAge"], "Sert au calcul du revenu mensuel possible.")}
          <Field label="Premier mois des versements" help="Début du calendrier des versements mensuels." error={err(["profile", "startMonth"])}>
            {(id) => <TextInput id={id} type="month" value={p.profile.startMonth} onChange={(e) => set(["profile", "startMonth"], e.target.value)} />}
          </Field>
          {intField("Jour des versements", ["profile", "contributionDay"], "Jour du mois où les versements programmés sont prélevés (dernier jour du mois s'il est plus court).")}
          {eurField("Revenus nets par mois", ["profile", "netMonthlyIncome"], "Du foyer, avant impôt sur le revenu : sert au taux d'effort des crédits. Les banques retiennent en général 70 % des loyers perçus.")}
          <div className="self-end pb-2">
            <Checkbox checked={p.profile.couple} onChange={(v) => set(["profile", "couple"], v)} label="Imposition en couple" />
          </div>
        </FormGrid>
      </Section>

      <Section title="Hypothèses" hint="Le rendement attendu de chaque classe se règle dans l'onglet Répartition.">
        <FormGrid cols={3}>
          {pctField("Inflation", ["returns", "inflation"])}
          {retraite && pctField("Rendement réel pendant la retraite", ["returns", "realReturnRetirement"], "Rendement après inflation du capital pendant les retraits.")}
        </FormGrid>
      </Section>

      <Section title="Règles des livrets">
        <FormGrid cols={3}>
          {eurField("Plancher (ne jamais descendre sous)", ["livrets", "floor"], "Le matelas de sécurité.")}
          {eurField("Plafond (au-delà, transférer)", ["livrets", "ceiling"], "L'excédent part vers le fonds euros.")}
        </FormGrid>
      </Section>

      <Section title="Fiscalité" hint="Taux 2026, à vérifier chaque année.">
        <FormGrid cols={3}>
          <Field label="Tranche marginale d'imposition (TMI)" help="Sur l'avis d'imposition.">
            {(id) => (
              <Select id={id} value={p.tax.tmi} onChange={(e) => set(["tax", "tmi"], Number(e.target.value))}>
                {[0, 0.11, 0.3, 0.41, 0.45].map((v) => (
                  <option key={v} value={v}>
                    {Math.round(v * 100)} %
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="self-center">
            <Checkbox
              checked={p.tax.withholdingDispense}
              onChange={(v) => set(["tax", "withholdingDispense"], v)}
              label="Dispense d'acompte sur les intérêts (demandée avant le 30/11)"
            />
          </div>
          <div className="self-center rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <div className="text-fg-muted">Imposition retenue</div>
            <div>
              {taxRegimeLabel(p)} · {formatPct(incomeTaxRate(p))}
            </div>
          </div>
          {pctField("Prélèvements sociaux (cas général)", ["tax", "socialGeneral"], "PEA, compte-titres, coupons, dividendes, crypto.")}
          {pctField("Prélèvements sociaux assurance-vie", ["tax", "socialAv"])}
          {pctField("Impôt PEA si retrait avant 5 ans", ["tax", "peaBefore5"], "Un retrait avant 5 ans clôture aussi le plan.")}
          {pctField("Impôt assurance-vie avant 8 ans", ["tax", "avBefore8"])}
          {pctField("Impôt assurance-vie après 8 ans", ["tax", "avAfter8"], "Pour moins de 150 000 € de versements.")}
          {eurField("Abattement annuel assurance-vie (seul)", ["tax", "avAllowanceSingle"], "Après 8 ans. 9 200 € pour un couple.")}
          {eurField("Plafond de déduction PER", ["tax", "perDeductionCeiling"], "Indiqué sur votre avis d'impôt. 0 : non renseigné.")}
          {eurField("Seuil d'exonération des ventes crypto", ["crypto", "exemptionThreshold"], "Total annuel des cessions en dessous duquel rien n'est dû.")}
        </FormGrid>
      </Section>

      {p.modules.immobilier && <RentalSection draft={draft} />}

      <Section title="Seuils d'alerte">
        <FormGrid cols={3}>
          {eurField("Espèces du compte-titres à investir", ["alerts", "ctoCashThreshold"], "Alerte quand de quoi acheter une obligation attend.")}
          {eurField("Espèces du PEA à investir", ["alerts", "peaCashThreshold"])}
          {eurField("Garantie des assureurs (FGAP)", ["alerts", "fgapGuarantee"], "Par personne et par assureur.")}
          {pctField("Concentration maximale", ["alerts", "concentrationMax"], "Part du patrimoine financier sur un seul titre, émetteur ou plateforme. 0 : pas d'alerte.")}
        </FormGrid>
        <div className="mt-4 mb-2 text-xs font-medium text-fg-muted">Loyers non reçus : jours après l'échéance</div>
        <FormGrid cols={3}>
          {intField("Rappel amiable", ["alerts", "rentReminderDays"])}
          {intField("Relance", ["alerts", "rentRelanceDays"])}
          {intField("Mise en demeure", ["alerts", "rentFormalNoticeDays"])}
        </FormGrid>
      </Section>
    </div>
  );
}
