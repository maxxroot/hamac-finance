/**
 * Lots d'un bien en location : ce qui se loue (logement entier, chambre, parking…), le bien restant ce qu'on possède.
 * Le mode de location du bien décide des lots et des baux proposés.
 * Colocation : loi n° 89-462 du 6 juillet 1989, art. 8-1 (bail unique ou baux individuels), consultée sur legifrance.gouv.fr le 12/11/2026.
 */

export const RENTAL_MODES = ["vide", "meuble", "colocation", "chambres"] as const;
export type RentalMode = (typeof RENTAL_MODES)[number];
export const RENTAL_MODE_LABELS: Record<RentalMode, string> = {
  vide: "Location vide",
  meuble: "Location meublée",
  colocation: "Colocation, un bail pour tous",
  chambres: "Colocation, un bail par chambre",
};
export const RENTAL_MODE_HELP: Record<RentalMode, string> = {
  vide: "Le logement entier, loué sans meubles.",
  meuble: "Le logement entier, loué meublé : bail meublé, étudiant ou mobilité.",
  colocation: "Un seul bail signé par tous les colocataires.",
  chambres: "Chaque chambre a son propre bail et son locataire.",
};

export const LOT_KINDS = ["logement", "chambre", "parking", "cave", "local", "autre"] as const;
export type LotKind = (typeof LOT_KINDS)[number];
export const LOT_KIND_LABELS: Record<LotKind, string> = {
  logement: "Logement entier",
  chambre: "Chambre",
  parking: "Parking ou box",
  cave: "Cave",
  local: "Local",
  autre: "Autre",
};

export interface Lot {
  id: string;
  propertyId: string;
  name: string;
  kind: LotKind;
  /** Surface en m², facultative. */
  surface: number | null;
  /** Loyer mensuel hors charges espéré : pèse le lot dans le taux d'occupation et chiffre sa vacance. */
  targetRent: number | null;
  comment: string;
  archived: boolean;
  sortOrder: number;
}

/** Lot loué à part du logement, avec un bail hors loi de 1989 (« autre bail »). */
export const lotIsAnnex = (kind: LotKind) => kind !== "logement" && kind !== "chambre";

/** Natures de lot proposées pour un mode : le logement entier, ou les chambres en colocation par chambre, plus les annexes. */
export function lotKindsFor(mode: RentalMode): LotKind[] {
  return LOT_KINDS.filter((k) => lotIsAnnex(k) || k === (mode === "chambres" ? "chambre" : "logement"));
}

/** Le lot correspond au mode de location actuel du bien. */
export const lotFitsMode = (kind: LotKind, mode: RentalMode) => lotKindsFor(mode).includes(kind);

/** Lot encore proposé à la location : non archivé et adapté au mode du bien. */
export const lotIsActive = (lot: Pick<Lot, "kind" | "archived">, mode: RentalMode) => !lot.archived && lotFitsMode(lot.kind, mode);

/** Nom proposé pour un nouveau lot : « Chambre 3 » après deux chambres. */
export function defaultLotName(kind: LotKind, existing: readonly Pick<Lot, "kind">[]): string {
  if (kind === "logement") return "Logement";
  const n = existing.filter((l) => l.kind === kind).length + 1;
  return n > 1 || kind === "chambre" ? `${LOT_KIND_LABELS[kind]} ${n}` : LOT_KIND_LABELS[kind];
}

export const sortLots = <T extends Pick<Lot, "sortOrder" | "name">>(lots: readonly T[]): T[] => [...lots].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr", { numeric: true }));
