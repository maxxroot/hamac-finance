import { Pencil } from "lucide-react";
import { PROPERTY_TYPE_LABELS, dpeExpiry, dpeRentalBan, formatEur, propertyProfitability, propertySqm, type EnergyLetter, type Property, type PropertyYear } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { DetailLine as Line } from "@/components/DetailLine";
import { Pct } from "@/components/Stat";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { formatDate, formatNumber } from "@/lib/numbers";

const hasDescription = (p: Property) =>
  Boolean(p.address || p.postalCode || p.city || p.propertyType || p.surface != null || p.rooms != null || p.bedrooms != null || p.floor != null || p.buildYear != null || p.outdoor || p.heating || p.parking || p.cellar || p.coOwnership || p.comment);

const located = (p: Property) => [p.address, [p.postalCode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

const LETTER_TONES: Record<EnergyLetter, "positive" | "neutral" | "negative"> = { A: "positive", B: "positive", C: "positive", D: "neutral", E: "neutral", F: "negative", G: "negative" };
const Letter = ({ value }: { value: EnergyLetter | null }) => (value ? <Badge tone={LETTER_TONES[value]}>{value}</Badge> : <>—</>);

const yesNoExtras = (p: Property) => [p.parking && "Parking", p.cellar && "Cave"].filter(Boolean).join(", ");

/** Description du bien et repères au m². */
export function DescriptionCard({ property: p, monthlyRent, onEdit }: { property: Property; monthlyRent: number | null; onEdit: () => void }) {
  const filled = hasDescription(p);
  const sqm = propertySqm(p, monthlyRent);
  const extras = yesNoExtras(p);
  const perSqm = (v: number) => `${formatEur(v)}/m²`;
  return (
    <Card>
      <CardTitle
        hint={
          <Button className="h-8" onClick={onEdit}>
            <Pencil size={14} /> {filled || p.dpe || p.ges || p.dpeDate ? "Modifier la fiche" : "Compléter la fiche"}
          </Button>
        }
      >
        Description
      </CardTitle>
      {!filled && <p className="text-sm text-fg-muted">Ajoutez l'adresse, la surface et les caractéristiques du bien.</p>}
      {located(p) && <Line label="Adresse">{located(p)}</Line>}
      {p.propertyType && <Line label="Type de bien">{PROPERTY_TYPE_LABELS[p.propertyType]}</Line>}
      {p.surface != null && <Line label="Surface habitable">{formatNumber(p.surface)} m²</Line>}
      {p.rooms != null && <Line label="Pièces">{p.rooms}</Line>}
      {p.bedrooms != null && <Line label="Chambres">{p.bedrooms}</Line>}
      {p.floor != null && <Line label="Étage">{p.floor}</Line>}
      {p.buildYear != null && <Line label="Année de construction">{p.buildYear}</Line>}
      {p.outdoor && <Line label="Extérieur">{p.outdoor}</Line>}
      {extras && <Line label="Annexes">{extras}</Line>}
      {p.heating && <Line label="Chauffage">{p.heating}</Line>}
      {p.coOwnership && <Line label="Copropriété">{p.syndic ? `Oui, syndic ${p.syndic}` : "Oui"}</Line>}
      {sqm && (
        <div className="mt-1.5 border-t border-line pt-1.5">
          {sqm.purchase != null && <Line label="Prix d'achat au m²">{perSqm(sqm.purchase)}</Line>}
          <Line label="Valeur au m²">{perSqm(sqm.value)}</Line>
          {sqm.rent != null && <Line label="Loyer au m² par mois">{perSqm(sqm.rent)}</Line>}
        </div>
      )}
      {p.comment && <p className="mt-3 border-t border-line pt-3 text-sm whitespace-pre-line text-fg-muted">{p.comment}</p>}
    </Card>
  );
}

/** DPE, sa validité et l'éventuelle interdiction de louer. */
export function EnergyCard({ property: p, today }: { property: Property; today: string }) {
  const expiry = p.dpeDate ? dpeExpiry(p.dpeDate) : null;
  const ban = p.kind === "locatif" && p.dpe ? dpeRentalBan(p.dpe, p.postalCode) : null;
  const known = p.dpe != null || p.ges != null || p.dpeDate != null;
  return (
    <Card>
      <CardTitle>Énergie</CardTitle>
      {!known && <p className="text-sm text-fg-muted">DPE non renseigné.</p>}
      {known && (
        <>
          <Line label="Note DPE"><Letter value={p.dpe} /></Line>
          <Line label="Note climat (GES)"><Letter value={p.ges} /></Line>
          {p.dpeDate && <Line label="Réalisé le">{formatDate(p.dpeDate)}</Line>}
          {expiry && (
            <Line label="Valable jusqu'au">
              <span className="inline-flex items-center gap-2">
                {expiry < today && <Badge tone="negative">Expiré</Badge>}
                {formatDate(expiry)}
              </span>
            </Line>
          )}
          {ban && <Line label={ban <= today ? "Location interdite depuis le" : "Location interdite à partir du"}>{formatDate(ban)}</Line>}
          {!p.dpeReminders && <Line label="Alertes">Désactivées</Line>}
        </>
      )}
    </Card>
  );
}

/** Rentabilité du bien en location, d'après ses résultats par année. */
export function ProfitabilityCard({ years }: { years: readonly PropertyYear[] }) {
  const r = propertyProfitability(years);
  return (
    <Card>
      <CardTitle hint={r ? `${r.year}${r.partial ? ", année incomplète" : ""} · votre part, avant impôt` : undefined}>Rentabilité</CardTitle>
      {!r && <p className="text-sm text-fg-muted">Les chiffres apparaîtront dès le premier bail.</p>}
      {r && (
        <>
          <Line label="Rendement brut"><Pct value={r.grossYield} digits={2} /></Line>
          <Line label="Rendement après charges"><Pct value={r.netYield} digits={2} /></Line>
          <Line label="Ce qu'il reste par mois, en moyenne">{r.monthlyRemaining == null ? "—" : <Amount value={r.monthlyRemaining} signed />}</Line>
          <Line label="Occupation"><Pct value={r.occupancy} digits={0} /></Line>
          <div className="mt-1.5 border-t border-line pt-1.5">
            <Line label="Loyers perçus depuis l'achat"><Amount value={r.totalRents} /></Line>
            <Line label="Capital remboursé depuis l'achat"><Amount value={r.totalCapital} /></Line>
          </div>
        </>
      )}
    </Card>
  );
}
