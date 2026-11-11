import { addMonths, monthsBetween, yearsBetween } from "./dates";

/**
 * Qui possède quoi : démembrement de propriété (usufruit, nue-propriété) et parts de société.
 *
 * Barème fiscal de l'article 669 du CGI (BOI-ENR-DMTG-10-40-10-50, vérifié le 11 novembre 2026) :
 * - usufruit viager selon l'âge révolu de l'usufruitier, de 90 % avant 21 ans à 10 % à partir de 91 ans,
 *   par tranches de dix ans ; la nue-propriété vaut le reste ;
 * - usufruit à durée fixe : 23 % de la pleine propriété par période de dix ans, toute période commencée
 *   comptant pour une entière, sans égard à l'âge, et jamais plus que l'usufruit viager.
 * La valeur compte dans le patrimoine selon ce barème : elle évolue avec l'âge de l'usufruitier.
 */

export const DISMEMBERMENTS = ["pleine", "usufruit", "nue_propriete"] as const;
export type Dismemberment = (typeof DISMEMBERMENTS)[number];
export const DISMEMBERMENT_LABELS: Record<Dismemberment, string> = {
  pleine: "Pleine propriété",
  usufruit: "Usufruit",
  nue_propriete: "Nue-propriété",
};

export const DISMEMBERMENT_SOURCE = {
  label: "CGI, art. 669 (BOI-ENR-DMTG-10-40-10-50)",
  url: "https://bofip.impots.gouv.fr/bofip/2323-PGP.html",
  verifiedOn: "2026-11-11",
};

/** Démembrement d'un bien : le droit détenu et ce qui sert à l'évaluer. */
export interface DismembermentFields {
  dismemberment: Dismemberment;
  /** Date de naissance de l'usufruitier (usufruit viager). */
  usufructBirthDate: string | null;
  /** Fin d'un usufruit à durée fixe ; null pour un usufruit viager. */
  usufructEnd: string | null;
}

export const FULL_OWNERSHIP: DismembermentFields = { dismemberment: "pleine", usufructBirthDate: null, usufructEnd: null };

/** Valeur de l'usufruit viager, en part de la pleine propriété, selon l'âge révolu de l'usufruitier. */
export function lifeUsufructRate(age: number): number {
  if (age < 21) return 0.9;
  if (age >= 91) return 0.1;
  return roundRate(0.9 - Math.floor((age - 11) / 10) * 0.1);
}

const roundRate = (r: number) => Math.round(r * 100) / 100;

/** Nombre de périodes de dix ans entre la date et la fin de l'usufruit, toute période commencée comptant. */
export function fixedUsufructPeriods(date: string, end: string): number {
  if (end <= date) return 0;
  let months = monthsBetween(date, end);
  if (addMonths(date, months) < end) months += 1;
  return Math.ceil(months / 120);
}

/**
 * Part de la pleine propriété qui revient à l'usufruit à une date ; null si l'usufruitier n'est pas connu.
 * Un usufruit à durée fixe terminé vaut 0 : la nue-propriété est redevenue pleine propriété.
 */
export function usufructRate(d: Pick<DismembermentFields, "usufructBirthDate" | "usufructEnd">, date: string): number | null {
  const life = d.usufructBirthDate && d.usufructBirthDate <= date ? lifeUsufructRate(yearsBetween(d.usufructBirthDate, date)) : null;
  if (d.usufructEnd) {
    const fixed = Math.min(1, roundRate(0.23 * fixedUsufructPeriods(date, d.usufructEnd)));
    return life == null ? fixed : Math.min(fixed, life);
  }
  return life;
}

/** Part de la valeur du bien qui revient au droit détenu (1 en pleine propriété). Usufruitier inconnu : compté en entier. */
export function dismembermentRatio(d: DismembermentFields, date: string): number {
  if (d.dismemberment === "pleine") return 1;
  const usufruct = usufructRate(d, date);
  if (usufruct == null) return 1;
  return d.dismemberment === "usufruit" ? usufruct : roundRate(1 - usufruct);
}

/** Libellé court : « Nue-propriété (60 %) ». */
export function dismembermentLabel(d: DismembermentFields, date: string): string {
  if (d.dismemberment === "pleine") return DISMEMBERMENT_LABELS.pleine;
  const r = dismembermentRatio(d, date);
  return `${DISMEMBERMENT_LABELS[d.dismemberment]} (${Math.round(r * 100)} %)`;
}

// ——— Parts de société ———

/** Société civile (SCI) qui détient des biens : l'utilisateur en détient une part. */
export interface Company {
  id: string;
  name: string;
  /** Part des parts sociales détenue par l'utilisateur (fraction). */
  share: number;
  comment: string;
  archived: boolean;
}

/** Part des parts d'une société, 1 sans société. */
export function companyShare(companies: readonly Company[] | undefined, companyId: string | null | undefined): number {
  if (!companyId) return 1;
  return companies?.find((c) => c.id === companyId)?.share ?? 1;
}

/**
 * Applique les parts de SCI : un bien détenu par une société compte pour la part du bien qu'elle détient
 * multipliée par la part de ses parts que détient l'utilisateur ; ses crédits aussi. Loyers, charges et dettes
 * suivent donc la même part, comme pour un bien en indivision.
 */
export function withCompanyShares<P extends { id: string; share: number; companyId: string | null }, L extends { propertyId: string | null; share: number }>(
  data: { properties: readonly P[]; loans: readonly L[]; companies?: readonly Company[] },
): { properties: P[]; loans: L[] } {
  if (!data.companies?.length) return { properties: [...data.properties], loans: [...data.loans] };
  const parts = new Map(data.properties.map((p) => [p.id, companyShare(data.companies, p.companyId)]));
  return {
    properties: data.properties.map((p) => (p.companyId ? { ...p, share: p.share * (parts.get(p.id) ?? 1) } : p)),
    loans: data.loans.map((l) => {
      const k = l.propertyId ? (parts.get(l.propertyId) ?? 1) : 1;
      return k === 1 ? l : { ...l, share: l.share * k };
    }),
  };
}

const pctLabel = (r: number) => `${(Math.round(r * 1000) / 10).toLocaleString("fr-FR")} %`;

/** Ce qui est détenu, en clair : « part détenue 50 % · nue-propriété (60 %) » ; vide en pleine propriété à 100 %. */
export function heldShareLabel(p: { share: number } & DismembermentFields, date: string): string {
  const parts = [p.share < 1 ? `part détenue ${pctLabel(p.share)}` : "", p.dismemberment === "pleine" ? "" : dismembermentLabel(p, date).toLocaleLowerCase("fr-FR")];
  return parts.filter(Boolean).join(" · ");
}
