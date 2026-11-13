import { z } from "zod";
import { AllocationRule, allocationIssues } from "./allocations";
import { ACCOUNT_KIND_LABELS, BUCKET_LABELS, type AccountKind, type Bucket } from "./domain";

/**
 * Paramètres du plan (onglet « Paramètres » du sheet), typés et validés.
 * Les taux sont des fractions (0.128 = 12,8 %). Valeurs par défaut : fiscalité 2026.
 */
const pct = z.number().min(0).max(1);
const pctSigned = z.number().min(-1).max(1);
const eur = z.number().min(0);

/** Parties de l'application que l'on peut masquer. */
export const MODULES = ["performance", "historique", "simulateurs", "projets", "livrets", "fondsEuros", "obligations", "actions", "crypto", "immobilier", "crowdlending", "autresBiens", "credits", "impots"] as const;
export type ModuleKey = (typeof MODULES)[number];
export const MODULE_LABELS: Record<ModuleKey, string> = {
  performance: "Performance",
  historique: "Historique",
  simulateurs: "Simulateurs",
  projets: "Projets",
  livrets: "Livrets",
  fondsEuros: "Fonds euros",
  obligations: "Obligations",
  actions: "Actions & ETF",
  crypto: "Crypto",
  immobilier: "Immobilier",
  autresBiens: "Autres biens",
  crowdlending: "Crowdlending",
  credits: "Crédits",
  impots: "Impôts",
};

/** Classe d'actifs créée par l'utilisateur (or, immobilier papier…) ; sa cible est une ligne de `targets`. */
export const AssetClass = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Donnez un nom à cette classe.").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type AssetClass = z.infer<typeof AssetClass>;

/** Une ligne de « Ma répartition cible » : une classe de base (Bucket) ou une classe créée. */
export const TargetLine = z.object({
  key: z.string().min(1),
  /** Les éléments de la classe comptent dans l'allocation, sauf choix contraire sur l'élément. */
  inAllocation: z.boolean(),
  target: z.number().min(0).max(1),
  /** Rendement attendu, facultatif ; une classe hors des quatre de base n'entre dans la projection que s'il est renseigné. */
  expectedReturn: z.number().min(-1).max(1).nullable(),
});
export type TargetLine = z.infer<typeof TargetLine>;

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
      /** Revenus nets du foyer par mois, pour le taux d'effort des crédits ; 0 = non renseignés. */
      netMonthlyIncome: eur,
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
      /** Plan de retraite : part d'actions visée à l'âge de départ. */
      etfAtRetirement: pct,
    }),
    /** Ma répartition cible : une ligne par classe. */
    targets: z.array(TargetLine),
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
      /** Plafond de déduction des versements sur un PER, lu sur l'avis d'impôt ; 0 = non renseigné. */
      perDeductionCeiling: eur,
    }),
    /** Biens en location : valeurs proposées pour les nouvelles dépenses et hypothèses du cashflow prévu. */
    rental: z.object({
      /** Part des charges de copropriété récupérable sur le locataire, proposée à la saisie. */
      coproRecoverable: pct,
      /** Provisions du cashflow prévu, en part du loyer hors charges ; chaque bien peut avoir les siennes. */
      vacancyRate: pct,
      worksRate: pct,
      /** Écart à zéro, en part du loyer hors charges, en dessous duquel le cashflow est dit neutre. */
      neutralBand: pct,
      /** Taxe foncière estimée en mois de loyer hors charges, tant que l'avis n'est pas saisi. */
      propertyTaxMonths: z.number().min(0).max(12),
      /** Régime fiscal du foyer : un pour toute la location vide, un pour toute la location meublée (LMNP). */
      unfurnishedRegime: z.enum(["micro", "reel"]),
      furnishedRegime: z.enum(["micro", "reel"]),
      /** Location meublée au réel : frais de comptabilité et d'organisme de gestion agréé, par an, pour le foyer. */
      accountingFees: eur,
      /** Location meublée au réel : part du prix qui revient au terrain, non amortissable. */
      landShare: pct,
      /** Projection d'un bien en location : hausse annuelle des loyers, des charges et de la valeur. */
      rentGrowth: pctSigned,
      chargesGrowth: pctSigned,
      valueGrowth: pctSigned,
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
    /** Classes d'actifs créées par l'utilisateur. */
    customClasses: z.array(AssetClass),
    /** Anciennes cibles posées sur des comptes, retirées à la reprise : à signaler une fois. */
    removedTargets: z.array(z.object({ label: z.string(), share: pct })),
    alerts: z.object({
      ctoCashThreshold: eur,
      peaCashThreshold: eur,
      fgapGuarantee: eur,
      /** Part du patrimoine financier au-delà de laquelle un titre, un émetteur ou une plateforme est signalé ; 0 = pas d'alerte. */
      concentrationMax: pct,
      stressEquity: z.tuple([pct, pct]),
      stressCrypto: z.tuple([pct, pct]),
      /** Jours après l'échéance d'un loyer non reçu où proposer le rappel amiable, la relance, puis la mise en demeure. */
      rentReminderDays: z.number().int().min(1).max(365),
      rentRelanceDays: z.number().int().min(1).max(365),
      rentFormalNoticeDays: z.number().int().min(1).max(365),
    }),
  })
  .superRefine((p, ctx) => {
    const a = p.alerts;
    if (a.rentReminderDays > a.rentRelanceDays || a.rentRelanceDays > a.rentFormalNoticeDays) {
      ctx.addIssue({ code: "custom", path: ["alerts", "rentRelanceDays"], message: "Les relances se suivent : rappel, puis relance, puis mise en demeure." });
    }
    const { birthYear: _b, retirementAge, securisationAge, horizonAge } = p.profile;
    const retraite = p.profile.goal === "retraite";
    if (retraite && securisationAge > retirementAge) {
      ctx.addIssue({ code: "custom", path: ["profile", "securisationAge"], message: "L'âge de sécurisation doit précéder (ou égaler) l'âge de départ." });
    }
    if (retraite && horizonAge <= retirementAge) {
      ctx.addIssue({ code: "custom", path: ["profile", "horizonAge"], message: "L'âge horizon doit dépasser l'âge de départ." });
    }
    for (const i of allocationIssues(p.customAllocations)) {
      ctx.addIssue({ code: "custom", path: ["customAllocations", i.index, i.field], message: i.message });
    }
    const total = p.targets.filter((l) => l.inAllocation).reduce((t, l) => t + l.target, 0);
    if (total > 1 + 1e-9) ctx.addIssue({ code: "custom", path: ["targets", "total"], message: `La répartition dépasse 100 % (${Math.round(total * 1000) / 10} %).` });
    const actions = p.targets.find((l) => l.key === "croissance")?.target ?? 0;
    if (retraite && p.allocation.etfAtRetirement > actions) {
      ctx.addIssue({ code: "custom", path: ["allocation", "etfAtRetirement"], message: "La part d'actions au départ doit être inférieure ou égale à la part actuelle." });
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
      netMonthlyIncome: 0,
    },
    returns: { livrets: 0.02, fondsEuros: 0.03, obligations: 0.035, actions: 0.06, inflation: 0.02, realReturnRetirement: 0.01 },
    allocation: { etfAtRetirement: 0.15 },
    targets: [
      { key: "garanti", inAllocation: true, target: 0.2, expectedReturn: null },
      { key: "obligations", inAllocation: true, target: 0.5, expectedReturn: null },
      { key: "croissance", inAllocation: true, target: 0.3, expectedReturn: null },
      { key: "precaution", inAllocation: false, target: 0, expectedReturn: null },
      { key: "immobilier", inAllocation: false, target: 0, expectedReturn: null },
      { key: "crowdlending", inAllocation: false, target: 0, expectedReturn: null },
      { key: "speculatif", inAllocation: false, target: 0, expectedReturn: null },
    ],
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
      perDeductionCeiling: 0,
    },
    rental: { coproRecoverable: 2 / 3, vacancyRate: 0.04, worksRate: 0.05, neutralBand: 0.02, propertyTaxMonths: 1.3, unfurnishedRegime: "micro", furnishedRegime: "micro", accountingFees: 0, landShare: 0.15, rentGrowth: 0.015, chargesGrowth: 0.02, valueGrowth: 0.01 },
    modules: Object.fromEntries(MODULES.map((m) => [m, true])) as Record<ModuleKey, boolean>,
    contributions: { mode: "libre", capacity: 0 },
    customAllocations: [],
    customClasses: [],
    removedTargets: [],
    alerts: {
      ctoCashThreshold: 1000,
      peaCashThreshold: 50,
      fgapGuarantee: 70000,
      concentrationMax: 0.2,
      stressEquity: [0.3, 0.5],
      stressCrypto: [0.5, 0.8],
      rentReminderDays: 10,
      rentRelanceDays: 20,
      rentFormalNoticeDays: 30,
    },
  };
}

/** Anciens réglages (allocation à trois parts, classes prises sur une base, cibles sur des comptes) vers « Ma répartition cible ». */
function migrateTargets(stored: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(stored.targets)) return stored;
  const old = (stored.allocation ?? {}) as { etfBefore?: number; obligations?: number };
  const etf = old.etfBefore ?? 0.3;
  const obligations = old.obligations ?? 0.5;
  const classes = (Array.isArray(stored.customClasses) ? stored.customClasses : []) as Array<{ id: string; target?: number; behavesLike?: string }>;
  const taken = (key: string) => classes.filter((c) => c.behavesLike === key).reduce((t, c) => t + (c.target ?? 0), 0);
  const base = (key: string, target: number) => ({ key, inAllocation: true, target: Math.max(0, Math.round((target - taken(key)) * 1e6) / 1e6), expectedReturn: null });
  const off = (key: string) => ({ key, inAllocation: false, target: 0, expectedReturn: null });
  const rules = (Array.isArray(stored.customAllocations) ? stored.customAllocations : []) as Array<{ asTarget?: boolean; asContribution?: boolean; label?: string; share?: number; target?: { kind: string; accountKind?: AccountKind } }>;
  const named = (r: (typeof rules)[number]) => r.label?.trim() || (r.target?.kind === "type" && r.target.accountKind ? ACCOUNT_KIND_LABELS[r.target.accountKind] : "Un compte");
  return {
    ...stored,
    targets: [base("garanti", Math.max(0, 1 - obligations - etf)), base("obligations", obligations), base("croissance", etf), off("precaution"), off("immobilier"), off("crowdlending"), off("speculatif"), ...classes.map((c) => ({ key: c.id, inAllocation: true, target: c.target ?? 0, expectedReturn: null }))],
    customAllocations: rules.filter((r) => r.asContribution !== false),
    removedTargets: rules.filter((r) => r.asTarget).map((r) => ({ label: named(r), share: r.share ?? 0 })),
  };
}

/** Complète, section par section, des paramètres d'une version antérieure avec les valeurs par défaut. */
export function withDefaultParams(stored: unknown, today = new Date()): unknown {
  const base = defaultParams(today);
  if (!stored || typeof stored !== "object") return base;
  const s = migrateTargets(stored as Record<string, unknown>) as Record<string, Record<string, unknown>>;
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

export const targetLine = (p: Pick<PlanParams, "targets">, key: string) => p.targets.find((l) => l.key === key);
export const classEnabled = (p: Pick<PlanParams, "targets">, key: string) => targetLine(p, key)?.inAllocation ?? false;

/** Nom affiché d'une classe : de base ou créée par l'utilisateur. */
export function classLabel(p: Pick<PlanParams, "customClasses">, key: string): string {
  return p.customClasses.find((c) => c.id === key)?.label ?? BUCKET_LABELS[key as Bucket] ?? key;
}

/**
 * Part d'actions visée à un âge donné : baisse linéaire entre l'âge de sécurisation et le départ.
 * En gestion de patrimoine, la part reste celle du tableau.
 */
export function etfTarget(p: PlanParams, age: number): number {
  const base = targetLine(p, "croissance")?.target ?? 0;
  const { securisationAge, retirementAge } = p.profile;
  const atRetirement = p.allocation.etfAtRetirement;
  if (!isRetirementPlan(p) || age < securisationAge) return base;
  if (retirementAge <= securisationAge) return Math.min(base, atRetirement);
  const t = (age - securisationAge) / (retirementAge - securisationAge);
  return Math.max(Math.min(base, atRetirement), base - (base - atRetirement) * t);
}

export interface ClassTarget {
  key: string;
  inAllocation: boolean;
  target: number;
}

/** Cibles à un âge donné : ce que les actions perdent avec l'âge va au fonds euros, sinon aux obligations. */
export function classTargets(p: PlanParams, age: number): ClassTarget[] {
  const out = p.targets.map((l) => ({ key: l.key, inAllocation: l.inAllocation, target: l.target }));
  const actions = out.find((l) => l.key === "croissance");
  if (actions?.inAllocation) {
    const next = etfTarget(p, age);
    const freed = actions.target - next;
    actions.target = next;
    const dest = out.find((l) => l.key === "garanti" && l.inAllocation) ?? out.find((l) => l.key === "obligations" && l.inAllocation);
    if (dest) dest.target += freed;
  }
  return out;
}

/** Taux d'impôt sur le revenu appliqué aux revenus de placement : barème si plus avantageux, sinon PFU. */
export function incomeTaxRate(p: PlanParams): number {
  return Math.min(p.tax.tmi, p.tax.pfuIncomeTax);
}

export function taxRegimeLabel(p: PlanParams): string {
  return p.tax.tmi < p.tax.pfuIncomeTax ? "Barème (plus avantageux)" : "Flat tax 12,8 %";
}
