import { z } from "zod";
import type { Account, LivretType } from "./domain";
import type { Institution } from "./institutions";
import { roundCents } from "./money";

/**
 * Protection en cas de faillite d'un établissement : garanties légales, plafonds, et ce qui les dépasse.
 *
 * Règles vérifiées le 11 novembre 2026 :
 * - dépôts (comptes, livrets bancaires, espèces des PEA et comptes-titres) : 100 000 € par personne et par
 *   établissement agréé (Code monétaire et financier, art. L312-4 et suivants ; Fonds de garantie des dépôts et de résolution) ;
 * - Livret A, LDDS et LEP : plafond distinct de 100 000 €, qui s'ajoute au précédent ;
 * - titres qui ne pourraient pas être restitués : 70 000 € par personne et par établissement (CMF, art. L322-1) ;
 * - assurance-vie et PER assurance : 70 000 € par assuré et par assureur, tous contrats confondus
 *   (Code des assurances, art. L423-1 ; montant réglable dans Paramètres › Alertes) ;
 * - autre pays de l'Union européenne : 100 000 € sur les dépôts (directive 2014/49/UE), au moins 20 000 € sur
 *   les titres (directive 97/9/CE, art. 4), rien de commun pour l'assurance ;
 * - crowdlending et crypto : aucune garantie.
 * Le plafond s'applique par établissement agréé, pas par marque : d'où « l'établissement garant » de la fiche.
 */

export const PROTECTION_VERIFIED_ON = "2026-11-11";

export const PROTECTION_COUNTRIES = ["france", "ue", "hors_ue"] as const;
export type ProtectionCountry = (typeof PROTECTION_COUNTRIES)[number];
export const PROTECTION_COUNTRY_LABELS: Record<ProtectionCountry, string> = {
  france: "France",
  ue: "Autre pays de l'Union européenne",
  hors_ue: "Hors Union européenne",
};

/** Réglages d'un établissement pour le calcul de la protection. */
export const InstitutionProtection = z.object({
  /** Établissement agréé (ou assureur) qui porte la garantie, s'il diffère du nom de l'établissement. */
  guarantor: z.string().trim().max(80).default(""),
  country: z.enum(PROTECTION_COUNTRIES).default("france"),
});
export type InstitutionProtection = z.infer<typeof InstitutionProtection>;
export const NO_PROTECTION: InstitutionProtection = { guarantor: "", country: "france" };

export const GUARANTEE_KINDS = ["depots", "livrets", "titres", "assurance", "separe", "aucune", "inconnue"] as const;
export type GuaranteeKind = (typeof GUARANTEE_KINDS)[number];
export const GUARANTEE_LABELS: Record<GuaranteeKind, string> = {
  depots: "Dépôts",
  livrets: "Livret A, LDDS, LEP",
  titres: "Titres",
  assurance: "Assurance-vie et PER",
  separe: "Épargne salariale",
  aucune: "Sans garantie",
  inconnue: "À vérifier",
};

export const GUARANTEE_SOURCES: Array<{ label: string; url: string }> = [
  { label: "Garantie des dépôts et des titres (ministère de l'Économie)", url: "https://www.economie.gouv.fr/facileco/garantie-des-depots-et-des-titres" },
  { label: "Code monétaire et financier, art. L312-4 (dépôts) et L322-1 (titres)", url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072026" },
  { label: "Code des assurances, art. L423-1 (garantie des assurances de personnes)", url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006073984" },
];

const DEPOSITS = 100_000;
const SECURITIES = 70_000;
const EU_SECURITIES_MIN = 20_000;
const REGULATED: ReadonlySet<LivretType> = new Set(["LIVRET_A", "LDDS", "LEP"]);

/** Ce dont le calcul a besoin pour un compte : sa valeur, ses espèces, et la part qui revient à l'utilisateur. */
export interface ProtectionAccountInput {
  account: Pick<Account, "id" | "name" | "kind" | "livretType" | "institutionId" | "archived"> & { share?: number };
  value: number;
  cash: number;
}

export interface ProtectionLine {
  /** Groupe : établissement garant + type de garantie. */
  key: string;
  guarantee: GuaranteeKind;
  /** Établissement garant (ou assureur) ; null quand le compte n'est rattaché à aucun établissement. */
  guarantor: string | null;
  /** Établissements de l'utilisateur regroupés sous ce garant. */
  institutions: string[];
  accounts: Array<{ id: string; name: string; amount: number }>;
  amount: number;
  /** Plafond légal ; null quand il n'y en a pas (ou qu'il est inconnu). */
  ceiling: number | null;
  covered: number;
  uncovered: number;
  note: string | null;
}

export interface ProtectionSummary {
  lines: ProtectionLine[];
  total: number;
  /** Sous les plafonds. */
  covered: number;
  /** Au-delà d'un plafond. */
  overCeiling: number;
  /** Sans aucune garantie : crowdlending, crypto. */
  unprotected: number;
  /** Garantie à vérifier : établissement non renseigné, hors de France pour l'assurance, hors Union européenne. */
  toCheck: number;
  /** Fonds détenus à part de l'établissement (épargne salariale). */
  separate: number;
}

const normalize = (s: string) => s.trim().toLocaleLowerCase("fr-FR").replace(/\s+/g, " ");

/** Nom de l'établissement qui porte la garantie, selon le type de garantie. */
export function guarantorOf(inst: Institution, guarantee: GuaranteeKind): string {
  const insurer = inst.offers.assurance_vie?.insurer?.trim();
  if (guarantee === "assurance" && insurer) return insurer;
  return inst.protection.guarantor.trim() || inst.name;
}

function ceilingFor(guarantee: GuaranteeKind, country: ProtectionCountry, fgap: number): { ceiling: number | null; kind: GuaranteeKind; note: string | null } {
  if (guarantee === "aucune" || guarantee === "separe" || guarantee === "inconnue") return { ceiling: null, kind: guarantee, note: null };
  if (country === "hors_ue") return { ceiling: null, kind: "inconnue", note: "Établissement hors de l'Union européenne : garanties de son pays, à vérifier." };
  if (country === "ue") {
    if (guarantee === "depots" || guarantee === "livrets") return { ceiling: DEPOSITS, kind: "depots", note: "Garantie de son pays, au même plafond de 100 000 € dans toute l'Union européenne." };
    if (guarantee === "titres") return { ceiling: EU_SECURITIES_MIN, kind: "titres", note: "Minimum européen de 20 000 € : son pays peut couvrir davantage." };
    return { ceiling: null, kind: "inconnue", note: "Pas de garantie européenne commune pour l'assurance : à vérifier selon le pays de l'assureur." };
  }
  if (guarantee === "titres") return { ceiling: SECURITIES, kind: guarantee, note: "Vos titres restent à vous : cette garantie ne joue que s'ils ne peuvent pas être restitués." };
  if (guarantee === "assurance") return { ceiling: fgap, kind: guarantee, note: "Par assureur, tous contrats confondus." };
  return { ceiling: DEPOSITS, kind: guarantee, note: guarantee === "livrets" ? "Plafond distinct, qui s'ajoute à celui des dépôts." : null };
}

/** Garantie qui couvre chaque partie d'un compte : espèces et titres d'un PEA ou d'un compte-titres sont séparés. */
function partsOf(a: ProtectionAccountInput): Array<{ guarantee: GuaranteeKind; amount: number }> {
  const share = a.account.share ?? 1;
  const value = a.value * share;
  const cash = a.cash * share;
  switch (a.account.kind) {
    case "livret":
      return [{ guarantee: a.account.livretType && REGULATED.has(a.account.livretType) ? "livrets" : "depots", amount: value }];
    case "pea":
    case "pea_pme":
    case "cto":
      return [
        { guarantee: "depots", amount: cash },
        { guarantee: "titres", amount: value - cash },
      ];
    case "assurance_vie":
    case "per":
      return [{ guarantee: "assurance", amount: value }];
    case "epargne_salariale":
      return [{ guarantee: "separe", amount: value }];
    case "crowdlending":
    case "crypto":
      return [{ guarantee: "aucune", amount: value }];
  }
}

const ORDER: Record<GuaranteeKind, number> = { depots: 0, livrets: 1, titres: 2, assurance: 3, separe: 4, inconnue: 5, aucune: 6 };

/**
 * Regroupe les comptes par établissement garant et par garantie, et compare chaque groupe à son plafond.
 * `fgap` : plafond de la garantie des assureurs (Paramètres › Alertes).
 */
export function protectionOf(accounts: readonly ProtectionAccountInput[], institutions: readonly Institution[], fgap: number): ProtectionSummary {
  const byId = new Map(institutions.map((i) => [i.id, i]));
  const groups = new Map<string, ProtectionLine>();
  for (const a of accounts) {
    if (a.account.archived && a.value === 0) continue;
    const inst = a.account.institutionId ? byId.get(a.account.institutionId) : undefined;
    for (const part of partsOf(a)) {
      const amount = roundCents(part.amount);
      if (amount <= 0) continue;
      const missing = !inst && part.guarantee !== "aucune" && part.guarantee !== "separe";
      const rule = missing ? { ceiling: null, kind: "inconnue" as const, note: "Rattachez le compte à son établissement pour calculer sa garantie." } : ceilingFor(part.guarantee, inst?.protection.country ?? "france", fgap);
      const guarantor = inst ? guarantorOf(inst, part.guarantee) : null;
      const key = `${rule.kind}|${guarantor ? normalize(guarantor) : ""}`;
      const line =
        groups.get(key) ??
        ({ key, guarantee: rule.kind, guarantor, institutions: [], accounts: [], amount: 0, ceiling: rule.ceiling, covered: 0, uncovered: 0, note: rule.note } satisfies ProtectionLine);
      if (inst && !line.institutions.includes(inst.name)) line.institutions.push(inst.name);
      const existing = line.accounts.find((x) => x.id === a.account.id);
      if (existing) existing.amount = roundCents(existing.amount + amount);
      else line.accounts.push({ id: a.account.id, name: a.account.name, amount });
      line.amount = roundCents(line.amount + amount);
      groups.set(key, line);
    }
  }
  const lines = [...groups.values()]
    .map((l) => {
      const covered = l.ceiling == null ? 0 : Math.min(l.amount, l.ceiling);
      return { ...l, covered: roundCents(covered), uncovered: l.ceiling == null ? 0 : roundCents(l.amount - covered) };
    })
    .sort((a, b) => ORDER[a.guarantee] - ORDER[b.guarantee] || b.amount - a.amount);
  const sum = (pick: (l: ProtectionLine) => number) => roundCents(lines.reduce((t, l) => t + pick(l), 0));
  return {
    lines,
    total: sum((l) => l.amount),
    covered: sum((l) => l.covered),
    overCeiling: sum((l) => l.uncovered),
    unprotected: sum((l) => (l.guarantee === "aucune" ? l.amount : 0)),
    toCheck: sum((l) => (l.guarantee === "inconnue" ? l.amount : 0)),
    separate: sum((l) => (l.guarantee === "separe" ? l.amount : 0)),
  };
}
