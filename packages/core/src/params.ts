import { z } from "zod";
import { AllocationRule, allocationIssues } from "./allocations";

/**
 * Paramètres du plan (onglet « Paramètres » du sheet), typés et validés.
 * Les taux sont des fractions (0.128 = 12,8 %). Valeurs par défaut : fiscalité 2026.
 */
const pct = z.number().min(0).max(1);
const pctSigned = z.number().min(-1).max(1);
const eur = z.number().min(0);

/** Parties de l'application que l'on peut masquer. */
export const MODULES = ["performance", "historique", "livrets", "fondsEuros", "obligations", "actions", "crypto", "immobilier", "crowdlending", "credits", "impots"] as const;
export type ModuleKey = (typeof MODULES)[number];
export const MODULE_LABELS: Record<ModuleKey, string> = {
  performance: "Performance",
  historique: "Historique",
  livrets: "Livrets",
  fondsEuros: "Fonds euros",
  obligations: "Obligations",
  actions: "Actions & ETF",
  crypto: "Crypto",
  immobilier: "Immobilier",
  crowdlending: "Crowdlending",
  credits: "Crédits",
  impots: "Impôts",
};

/** Classe d'actifs ajoutée à la demande : sa cible est prise sur celle de la classe dont elle a le comportement. */
export const AssetClass = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Donnez un nom à cette classe.").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Classe de base sur laquelle sa cible est prise ; la projection lui applique son rendement. */
  behavesLike: z.enum(["garanti", "obligations", "croissance"]),
  target: z.number().min(0).max(1),
});
export type AssetClass = z.infer<typeof AssetClass>;

export const PlanParams = z
  .object({
    profile: z.object({
      /** Usage : plan de retraite (projection, sécurisation avec l'âge) ou simple gestion de patrimoine. */
      goal: z.enum(["retraite", "patrimoine"]),
      birthYear: z.number().int().min(1900).max(2100),
      retirementAge: z.number().int().min(40).max(80),
      securisationAge: z.number().int().min(18).max(80),
      horizonAge: z.number().int().min(50).max(110),
      /** Premier mois du calendrier des versements (AAAA-MM). */
      startMonth: z.string().regex(/^\d{4}-\d{2}$/),
      /** Jour du mois où les versements programmés sont prélevés (dernier jour du mois s'il est plus court). */
      contributionDay: z.number().int().min(1).max(31),
      couple: z.boolean(),
    }),
    returns: z.object({
      livrets: pctSigned,
      fondsEuros: pctSigned,
      obligations: pctSigned,
      actions: pctSigned,
      inflation: pctSigned,
      realReturnRetirement: pctSigned,
    }),
    allocation: z.object({
      etfBefore: pct,
      etfAtRetirement: pct,
      obligations: pct,
    }),
    livrets: z.object({
      floor: eur,
      ceiling: eur,
      driftAlert: pct,
    }),
    broker: z.object({ feeRate: pct, minFee: eur }),
    crypto: z.object({ feeRate: pct, exemptionThreshold: eur }),
    tax: z.object({
      tmi: z.union([z.literal(0), z.literal(0.11), z.literal(0.3), z.literal(0.41), z.literal(0.45)]),
      withholdingDispense: z.boolean(),
      pfuIncomeTax: pct,
      socialGeneral: pct,
      socialAv: pct,
      avBefore8: pct,
      avAfter8: pct,
      avAllowanceSingle: eur,
      avAllowanceCouple: eur,
      peaBefore5: pct,
    }),
    /** Pages affichées dans le menu. Masquer un module ne change aucun calcul. */
    modules: z.object(Object.fromEntries(MODULES.map((m) => [m, z.boolean()])) as Record<ModuleKey, z.ZodBoolean>),
    /** Versements : gestion libre (montants saisis compte par compte) ou suggérée (depuis la capacité mensuelle). */
    contributions: z.object({
      mode: z.enum(["libre", "suggere"]),
      capacity: eur,
    }),
    /** Allocations personnalisées, ajoutées à la demande (voir allocations.ts). */
    customAllocations: z.array(AllocationRule),
    /** Classes d'actifs personnalisées (or, immobilier papier…), prises sur les cibles de base. */
    customClasses: z.array(AssetClass),
    alerts: z.object({
      ctoCashThreshold: eur,
      peaCashThreshold: eur,
      fgapGuarantee: eur,
      stressEquity: z.tuple([pct, pct]),
      stressCrypto: z.tuple([pct, pct]),
    }),
  })
  .superRefine((p, ctx) => {
    const { birthYear: _b, retirementAge, securisationAge, horizonAge } = p.profile;
    const retraite = p.profile.goal === "retraite";
    if (retraite && securisationAge > retirementAge) {
      ctx.addIssue({ code: "custom", path: ["profile", "securisationAge"], message: "L'âge de sécurisation doit précéder (ou égaler) l'âge de départ." });
    }
    if (retraite && horizonAge <= retirementAge) {
      ctx.addIssue({ code: "custom", path: ["profile", "horizonAge"], message: "L'âge horizon doit dépasser l'âge de départ." });
    }
    const { etfBefore, etfAtRetirement, obligations } = p.allocation;
    const room = { croissance: etfBefore, obligations, garanti: Math.max(0, 1 - obligations - etfBefore) };
    for (const base of ["garanti", "obligations", "croissance"] as const) {
      const members = p.customClasses.map((c, i) => ({ c, i })).filter((x) => x.c.behavesLike === base);
      const sum = members.reduce((s, x) => s + x.c.target, 0);
      if (sum > room[base] + 1e-9 && members.length) {
        ctx.addIssue({ code: "custom", path: ["customClasses", members.at(-1)!.i, "target"], message: `Ces classes dépassent la cible de leur classe de base (${Math.round(room[base] * 1000) / 10} %).` });
      }
    }
    for (const i of allocationIssues(p.customAllocations)) {
      ctx.addIssue({ code: "custom", path: ["customAllocations", i.index, i.field], message: i.message });
    }
    if (obligations + (retraite ? Math.max(etfBefore, etfAtRetirement) : etfBefore) > 1 + 1e-9) {
      ctx.addIssue({ code: "custom", path: ["allocation", "obligations"], message: "Obligations + ETF ne peuvent pas dépasser 100 % (le fonds euros prend le reste)." });
    }
    if (retraite && etfAtRetirement > etfBefore) {
      ctx.addIssue({ code: "custom", path: ["allocation", "etfAtRetirement"], message: "La part ETF au départ doit être inférieure ou égale à la part avant sécurisation." });
    }
    if (p.livrets.floor > p.livrets.ceiling) {
      ctx.addIssue({ code: "custom", path: ["livrets", "floor"], message: "Le plancher doit être inférieur au plafond." });
    }
  });
export type PlanParams = z.infer<typeof PlanParams>;

export function defaultParams(today = new Date()): PlanParams {
  const y = today.getFullYear();
  return {
    profile: {
      goal: "retraite",
      birthYear: y - 35,
      retirementAge: 64,
      securisationAge: 57,
      horizonAge: 90,
      startMonth: `${y}-${String(today.getMonth() + 1).padStart(2, "0")}`,
      contributionDay: 1,
      couple: false,
    },
    returns: { livrets: 0.02, fondsEuros: 0.03, obligations: 0.035, actions: 0.06, inflation: 0.02, realReturnRetirement: 0.01 },
    allocation: { etfBefore: 0.3, etfAtRetirement: 0.15, obligations: 0.5 },
    livrets: { floor: 7500, ceiling: 15000, driftAlert: 0.05 },
    broker: { feeRate: 0.005, minFee: 0 },
    crypto: { feeRate: 0, exemptionThreshold: 305 },
    tax: {
      tmi: 0.11,
      withholdingDispense: false,
      pfuIncomeTax: 0.128,
      socialGeneral: 0.186,
      socialAv: 0.172,
      avBefore8: 0.128,
      avAfter8: 0.075,
      avAllowanceSingle: 4600,
      avAllowanceCouple: 9200,
      peaBefore5: 0.128,
    },
    modules: Object.fromEntries(MODULES.map((m) => [m, true])) as Record<ModuleKey, boolean>,
    contributions: { mode: "libre", capacity: 0 },
    customAllocations: [],
    customClasses: [],
    alerts: {
      ctoCashThreshold: 1000,
      peaCashThreshold: 50,
      fgapGuarantee: 70000,
      stressEquity: [0.3, 0.5],
      stressCrypto: [0.5, 0.8],
    },
  };
}

/** Complète, section par section, des paramètres d'une version antérieure avec les valeurs par défaut. */
export function withDefaultParams(stored: unknown, today = new Date()): unknown {
  const base = defaultParams(today);
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Record<string, Record<string, unknown>>;
  // Sections objets fusionnées champ par champ ; listes reprises telles quelles si présentes.
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Array.isArray(v) ? (Array.isArray(s[k]) ? s[k] : v) : { ...v, ...(s[k] ?? {}) }]));
}

/** Fusionne des paramètres stockés (éventuellement d'une version antérieure) avec les valeurs par défaut. */
export function normalizeParams(stored: unknown, today = new Date()): PlanParams {
  const parsed = PlanParams.safeParse(withDefaultParams(stored, today));
  return parsed.success ? parsed.data : defaultParams(today);
}

/**
 * Paramètres reçus à l'enregistrement : un réglage absent (interface d'une version antérieure)
 * prend sa valeur par défaut au lieu de bloquer ; une valeur présente mais invalide reste refusée.
 */
export const PlanParamsInput = z.preprocess((v) => withDefaultParams(v), PlanParams);

// ——— Valeurs dérivées (Paramètres B5–B28) ———

/** Plan de retraite (projection, revenu possible, sécurisation) plutôt que simple gestion de patrimoine. */
export function isRetirementPlan(p: PlanParams): boolean {
  return p.profile.goal === "retraite";
}

export function retirementYear(p: PlanParams): number {
  return p.profile.birthYear + p.profile.retirementAge;
}

/** Âge par année civile (comme le sheet : année − année de naissance). */
export function ageInYear(p: PlanParams, year: number): number {
  return year - p.profile.birthYear;
}

/**
 * Part ETF cible à un âge donné (désensibilisation linéaire entre l'âge de sécurisation et le départ).
 * Paramètres!B27. En gestion de patrimoine, la part reste celle de `etfBefore`.
 */
export function etfTarget(p: PlanParams, age: number): number {
  const { etfBefore, etfAtRetirement } = p.allocation;
  const { securisationAge, retirementAge } = p.profile;
  // Gestion de patrimoine : allocation fixe, sans désensibilisation avec l'âge.
  if (!isRetirementPlan(p) || age < securisationAge) return etfBefore;
  if (retirementAge <= securisationAge) return etfAtRetirement;
  const t = (age - securisationAge) / (retirementAge - securisationAge);
  return Math.max(etfAtRetirement, etfBefore - (etfBefore - etfAtRetirement) * t);
}

export interface TargetAllocation {
  garanti: number;
  obligations: number;
  croissance: number;
}

export function targetAllocation(p: PlanParams, age: number): TargetAllocation {
  const croissance = etfTarget(p, age);
  const obligations = p.allocation.obligations;
  return { croissance, obligations, garanti: Math.max(0, 1 - obligations - croissance) };
}

export interface ClassTarget {
  /** Identifiant de la classe personnalisée, ou la classe de base. */
  key: string;
  bucket: keyof TargetAllocation;
  label: string | null;
  color: string | null;
  target: number;
}

/**
 * Cibles détaillées : chaque classe personnalisée prend sa part sur sa classe de base, qui garde le reste.
 * Si la base rétrécit avec l'âge (actions), les classes personnalisées rétrécissent en proportion.
 */
export function classTargets(p: PlanParams, age: number): ClassTarget[] {
  const base = targetAllocation(p, age);
  return (["garanti", "obligations", "croissance"] as const).flatMap((bucket) => {
    const members = p.customClasses.filter((c) => c.behavesLike === bucket);
    const sum = members.reduce((s, c) => s + c.target, 0);
    const scale = sum > base[bucket] && sum > 0 ? base[bucket] / sum : 1;
    return [
      { key: bucket, bucket, label: null, color: null, target: Math.max(0, base[bucket] - sum * scale) },
      ...members.map((c) => ({ key: c.id, bucket, label: c.label, color: c.color, target: c.target * scale })),
    ];
  });
}

/** Taux d'impôt sur le revenu appliqué aux revenus de placement : barème si plus avantageux, sinon PFU. */
export function incomeTaxRate(p: PlanParams): number {
  return Math.min(p.tax.tmi, p.tax.pfuIncomeTax);
}

export function taxRegimeLabel(p: PlanParams): string {
  return p.tax.tmi < p.tax.pfuIncomeTax ? "Barème (plus avantageux)" : "Flat tax 12,8 %";
}
