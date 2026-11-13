import type { Lease, Property } from "../../realestate";

export type RentalTaxKind = "foncier" | "lmnp";
export type RentalRegime = "micro" | "reel";
export const RENTAL_TAX_KIND_LABELS: Record<RentalTaxKind, string> = { foncier: "Location vide (revenus fonciers)", lmnp: "Location meublée (LMNP)" };
export const RENTAL_REGIME_LABELS: Record<RentalTaxKind, Record<RentalRegime, string>> = {
  foncier: { micro: "Micro-foncier", reel: "Réel" },
  lmnp: { micro: "Micro-BIC", reel: "Réel" },
};

const FURNISHED_LEASES = new Set<Lease["kind"]>(["meuble", "etudiant", "mobilite"]);

/** Location vide ou meublée, d'après le mode de location du bien et son bail le plus récent. */
export function rentalTaxKind(property: Pick<Property, "id" | "rentalMode">, leases: readonly Lease[]): RentalTaxKind {
  if (property.rentalMode === "meuble") return "lmnp";
  if (property.rentalMode === "vide") return "foncier";
  const last = leases.filter((l) => l.propertyId === property.id).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  return last != null && FURNISHED_LEASES.has(last.kind) ? "lmnp" : "foncier";
}
