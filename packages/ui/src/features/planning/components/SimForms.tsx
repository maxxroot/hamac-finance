import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EquityEnvelope, Repayment, SavingsKind } from "@hamac/core";
import { Field, FormGrid, NumberInput, Select, TextInput } from "@/shared/components/form";
import type { SimConfig } from "@/features/planning/lib/simulateurs";

/** Formulaire d'une simulation : un champ par donnée du placement. */
export function SimForm({ sim, onChange, horizon }: { sim: SimConfig; onChange: (s: SimConfig) => void; horizon: number | null }) {
  // Chaque formulaire ne modifie que les champs de son placement.
  const set = <K extends string>(key: K, value: unknown) => onChange({ ...sim, input: { ...sim.input, [key]: value } } as SimConfig);
  const num = (key: string, label: string, value: number, suffix: string, help?: ReactNode, decimals = 2) => (
    <Field label={label} help={help}>
      {(id) => <NumberInput id={id} value={value} decimals={decimals} suffix={suffix} onChange={(v) => set(key, v ?? 0)} />}
    </Field>
  );
  /** Durée remplacée par la durée commune : affichée, mais non modifiable ici. */
  const common = (label: string) => (
    <Field label={label} help="La durée commune s'applique : changez-la en haut de la page.">
      {(id) => <NumberInput id={id} value={horizon} decimals={0} suffix="ans" disabled onChange={() => undefined} />}
    </Field>
  );
  const date = (key: string, label: string, value: string, help?: ReactNode) => (
    <Field label={label} help={help}>
      {(id) => <DateInput id={id} value={value} onChange={(v) => set(key, v)} />}
    </Field>
  );

  switch (sim.kind) {
    case "obligation": {
      const i = sim.input;
      return (
        <FormGrid>
          {num("pricePct", "Prix d'achat", i.pricePct, "%", "En % du nominal, pied de coupon (sans le coupon couru).", 3)}
          {num("couponPct", "Coupon annuel", i.couponPct, "%", undefined, 3)}
          <Field label="Coupons par an">
            {(id) => (
              <Select id={id} value={i.frequency} onChange={(e) => set("frequency", +e.target.value)}>
                <option value={1}>1 (annuel)</option>
                <option value={2}>2 (semestriel)</option>
                <option value={4}>4 (trimestriel)</option>
                <option value={12}>12 (mensuel)</option>
              </Select>
            )}
          </Field>
          {date("buyDate", "Date d'achat", i.buyDate, "Le coupon couru se calcule à cette date.")}
          {num("feePct", "Frais d'achat", i.feePct, "%", "Courtage, en % du montant payé.", 3)}
          {num("feeFixed", "Frais d'achat fixes", i.feeFixed, "€", "Par ordre, en plus du pourcentage (minimum de courtage, frais de place).")}
          {date("maturityDate", "Échéance", i.maturityDate, "Remboursement au pair (100 %) ce jour-là.")}
          {horizon != null ? common("Durée de détention") : num("holdYears", "Durée de détention", i.holdYears, "ans", "0 : jusqu'à l'échéance. Sinon, revendue au bout de ce nombre d'années.", 1)}
          {num("salePricePct", "Prix de revente", i.salePricePct, "%", "Si elle est revendue avant l'échéance. 0 : estimé à taux de marché inchangés.", 3)}
        </FormGrid>
      );
    }
    case "actions": {
      const i = sim.input;
      return (
        <FormGrid>
          <Field label="Enveloppe">
            {(id) => (
              <Select id={id} value={i.envelope} onChange={(e) => set("envelope", e.target.value as EquityEnvelope)}>
                <option value="pea">PEA</option>
                <option value="cto">Compte-titres</option>
                <option value="av">Assurance-vie (unités de compte)</option>
              </Select>
            )}
          </Field>
          {horizon != null ? common("Durée") : num("years", "Durée", i.years, "ans", undefined, 0)}
          {num("returnPct", "Rendement attendu par an", i.returnPct, "%", "Hausse des cours et dividendes compris, avant frais.", 2)}
          {i.envelope === "cto" ? num("dividendPct", "Dont dividendes versés", i.dividendPct, "%", "0 pour un ETF capitalisant.", 2) : <div />}
          {num("entryFeePct", i.envelope === "av" ? "Frais sur versement" : "Frais d'achat", i.entryFeePct, "%", undefined, 3)}
          {num("entryFixed", i.envelope === "av" ? "Frais sur versement fixes" : "Frais d'achat fixes", i.entryFixed, "€", "En plus du pourcentage.")}
          {num("feesPct", "Frais annuels", i.feesPct, "%", i.envelope === "av" ? "Frais de l'ETF et frais de gestion du contrat, sur l'encours." : "Frais courants de l'ETF, droits de garde en %.", 3)}
          {num("annualFixed", "Frais annuels fixes", i.annualFixed, "€", i.envelope === "cto" ? "Droits de garde, abonnement : payés à côté, non déductibles." : "Prélevés sur l'enveloppe chaque année.")}
          {i.envelope !== "av" && num("salePct", "Frais de vente", i.salePct, "%", undefined, 3)}
          {i.envelope !== "av" && num("saleFixed", "Frais de vente fixes", i.saleFixed, "€", "Déduits du prix de vente avant le calcul de la plus-value.")}
          {i.envelope !== "cto" && num("envelopeAgeYears", i.envelope === "pea" ? "Ancienneté du PEA aujourd'hui" : "Ancienneté du contrat aujourd'hui", i.envelopeAgeYears, "ans", i.envelope === "pea" ? "Les 5 ans se comptent depuis l'ouverture du PEA." : "Les 8 ans se comptent depuis l'ouverture du contrat.", 0)}
          {date("startDate", "Date d'achat", i.startDate)}
        </FormGrid>
      );
    }
    case "fondsEuros": {
      const i = sim.input;
      return (
        <FormGrid>
          {num("ratePct", "Taux servi", i.ratePct, "%", "Taux annoncé, net des frais de gestion du contrat.", 3)}
          {horizon != null ? common("Durée") : num("years", "Durée", i.years, "ans", undefined, 0)}
          {num("entryFeePct", "Frais sur versement", i.entryFeePct, "%", undefined, 3)}
          {num("contractAgeYears", "Ancienneté du contrat aujourd'hui", i.contractAgeYears, "ans", "Les 8 ans se comptent depuis l'ouverture du contrat.", 0)}
          {date("startDate", "Date du versement", i.startDate)}
        </FormGrid>
      );
    }
    case "pret": {
      const i = sim.input;
      return (
        <FormGrid>
          {num("ratePct", "Taux annuel", i.ratePct, "%", undefined, 3)}
          {num("months", "Durée du prêt", i.months, "mois", horizon != null ? "Au-delà de la durée commune, le capital restant dû est compté au pair." : undefined, 0)}
          <Field label="Remboursement">
            {(id) => (
              <Select id={id} value={i.repayment} onChange={(e) => set("repayment", e.target.value as Repayment)}>
                <option value="amortissable">Mensualités constantes</option>
                <option value="in_fine">Intérêts chaque mois, capital à la fin</option>
              </Select>
            )}
          </Field>
          {num("defaultPct", "Part en défaut", i.defaultPct, "%", "Part des sommes prêtées supposée ne rien rembourser.", 2)}
          {date("startDate", "Date du prêt", i.startDate)}
        </FormGrid>
      );
    }
    case "livret": {
      const i = sim.input;
      return (
        <FormGrid>
          <Field label="Type">
            {(id) => (
              <Select id={id} value={i.kind} onChange={(e) => set("kind", e.target.value as SavingsKind)}>
                <option value="reglemente">Livret A, LDDS, LEP (exonérés)</option>
                <option value="fiscalise">Livret bancaire ou compte à terme (imposés)</option>
              </Select>
            )}
          </Field>
          {num("ratePct", "Taux annuel", i.ratePct, "%", undefined, 3)}
          {horizon != null ? common("Durée") : num("years", "Durée", i.years, "ans", undefined, 0)}
          {date("startDate", "Date du dépôt", i.startDate)}
        </FormGrid>
      );
    }
  }
}

/** Années acceptées : au-delà, c'est une saisie en cours (0002 en tapant 2026). */
const plausible = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && +v.slice(0, 4) >= 1950 && +v.slice(0, 4) <= 2150;

/**
 * Date saisie au clavier. Pendant la frappe, le navigateur annonce une date vide ou une année partielle :
 * le champ garde ce qui est tapé et ne transmet la date qu'une fois complète. Sinon, l'ancienne valeur
 * revenait dans le champ et effaçait le chiffre tapé.
 */
export function DateInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value]);
  return (
    <TextInput
      id={id}
      type="date"
      value={local}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        if (!plausible(local)) setLocal(value);
      }}
      onChange={(e) => {
        setLocal(e.target.value);
        if (plausible(e.target.value)) onChange(e.target.value);
      }}
    />
  );
}
