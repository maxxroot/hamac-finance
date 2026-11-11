import { monthsBetween } from "./dates";
import type { PortfolioState } from "./engine";
import { roundCents } from "./money";

/**
 * Projets : une somme à réunir pour une date (achat, études, travaux), financée par une part de certains comptes.
 * Un compte sert un projet en pourcentage de sa valeur (la somme suit le compte) ou par un montant réservé.
 * Le versement mensuel nécessaire suppose le taux de rendement saisi sur le projet, 0 % par défaut.
 */

export const GOAL_ALLOCATION_MODES = ["pourcentage", "montant"] as const;
export type GoalAllocationMode = (typeof GOAL_ALLOCATION_MODES)[number];

export interface GoalAllocation {
  accountId: string;
  mode: GoalAllocationMode;
  /** Fraction de la valeur du compte (mode pourcentage) ou montant réservé en euros (mode montant). */
  value: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  /** Date à laquelle la somme doit être réunie. */
  targetDate: string;
  /** Début de l'effort, pour juger de l'avance ou du retard. */
  startDate: string;
  /** Rendement annuel supposé de l'argent mis de côté (fraction). */
  rate: number;
  allocations: GoalAllocation[];
  comment: string;
  archived: boolean;
}

export interface GoalProgress {
  goal: Goal;
  /** Ce que chaque compte apporte aujourd'hui. */
  contributions: Array<{ accountId: string; name: string; amount: number; label: string }>;
  saved: number;
  progress: number;
  remaining: number;
  monthsLeft: number;
  /** Versement à faire chaque mois jusqu'à la date, au taux du projet ; 0 si la somme est réunie. */
  monthlyNeeded: number;
  status: "atteint" | "en_avance" | "en_retard" | "echu";
  /** Part de l'argent du projet placée en actions ou en crypto. */
  riskyShare: number;
  warning: string | null;
}

/** Part détenue de la valeur d'un compte (comptes joints). */
const heldValue = (state: PortfolioState, accountId: string) => {
  const a = state.accountById.get(accountId);
  return a ? a.value * (a.account.share ?? 1) : 0;
};

/** Ce qu'un compte apporte à un projet : sa part en pourcentage, ou le montant réservé dans la limite de sa valeur. */
export function allocationAmount(state: PortfolioState, a: GoalAllocation): number {
  const value = Math.max(0, heldValue(state, a.accountId));
  return roundCents(a.mode === "pourcentage" ? value * a.value : Math.min(a.value, value));
}

/** Versement mensuel qui, ajouté à l'épargne déjà réunie, atteint la cible à la date, au taux annuel donné. */
export function monthlySaving(target: number, saved: number, months: number, annualRate: number): number {
  if (months <= 0) return roundCents(Math.max(0, target - saved));
  const i = Math.pow(1 + annualRate, 1 / 12) - 1;
  const missing = target - saved * Math.pow(1 + i, months);
  if (missing <= 0) return 0;
  return roundCents(i === 0 ? missing / months : (missing * i) / (Math.pow(1 + i, months) - 1));
}

const RISKY_BUCKETS = new Set(["croissance", "speculatif"]);

export function goalProgress(goal: Goal, state: PortfolioState): GoalProgress {
  const contributions = goal.allocations.map((a) => {
    const s = state.accountById.get(a.accountId);
    const amount = allocationAmount(state, a);
    const label = a.mode === "pourcentage" ? `${Math.round(a.value * 1000) / 10} % du compte` : `${Math.round(a.value).toLocaleString("fr-FR")} € réservés`;
    return { accountId: a.accountId, name: s?.account.name ?? "Compte supprimé", amount, label };
  });
  const saved = roundCents(contributions.reduce((t, c) => t + c.amount, 0));
  const monthsLeft = Math.max(0, monthsBetween(state.asOf, goal.targetDate));
  const remaining = roundCents(Math.max(0, goal.target - saved));
  // Part placée en actions ou crypto, au prorata de ce que chaque compte apporte.
  let risky = 0;
  for (const c of contributions) {
    const s = state.accountById.get(c.accountId);
    if (!s || s.value <= 0) continue;
    const riskyInAccount = Object.entries(s.byBucket).reduce((t, [b, v]) => t + (RISKY_BUCKETS.has(b) ? (v ?? 0) : 0), 0) / s.value;
    risky += c.amount * Math.max(0, Math.min(1, riskyInAccount));
  }
  const riskyShare = saved > 0 ? risky / saved : 0;
  const total = Math.max(1, monthsBetween(goal.startDate, goal.targetDate));
  const elapsed = Math.min(total, Math.max(0, monthsBetween(goal.startDate, state.asOf)));
  const expected = (goal.target * elapsed) / total;
  const status: GoalProgress["status"] = saved >= goal.target ? "atteint" : goal.targetDate <= state.asOf ? "echu" : saved >= expected ? "en_avance" : "en_retard";
  const warning =
    status !== "atteint" && monthsLeft <= 36 && riskyShare > 0.3
      ? `Échéance dans ${monthsLeft} mois avec ${Math.round(riskyShare * 100)} % en actions ou en crypto : une baisse des marchés juste avant la date ferait manquer la somme. Mieux vaut sécuriser à mesure que la date approche.`
      : null;
  return {
    goal,
    contributions,
    saved,
    progress: goal.target > 0 ? Math.min(1, saved / goal.target) : 1,
    remaining,
    monthsLeft,
    monthlyNeeded: status === "atteint" ? 0 : monthlySaving(goal.target, saved, monthsLeft, goal.rate),
    status,
    riskyShare,
    warning,
  };
}

/** Comptes affectés à plus que leur valeur, tous projets ouverts confondus. */
export function overAllocatedAccounts(goals: readonly Goal[], state: PortfolioState): Array<{ accountId: string; name: string; allocated: number; value: number }> {
  const byAccount = new Map<string, number>();
  for (const g of goals.filter((x) => !x.archived)) {
    for (const a of g.allocations) {
      const value = Math.max(0, heldValue(state, a.accountId));
      const raw = a.mode === "pourcentage" ? value * a.value : a.value;
      byAccount.set(a.accountId, (byAccount.get(a.accountId) ?? 0) + raw);
    }
  }
  return [...byAccount.entries()]
    .map(([accountId, allocated]) => ({ accountId, name: state.accountById.get(accountId)?.account.name ?? "Compte supprimé", allocated: roundCents(allocated), value: roundCents(Math.max(0, heldValue(state, accountId))) }))
    .filter((x) => x.allocated > x.value + 0.5);
}
