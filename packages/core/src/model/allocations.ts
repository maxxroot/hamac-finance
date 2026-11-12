import { z } from "zod";
import { ACCOUNT_KIND_LABELS, ACCOUNT_KINDS, type Account } from "./domain";
import { roundCents } from "../base";

/**
 * Allocations personnalisées (Paramètres › Plan) : une part des versements mensuels vers un compte
 * ou un type de compte, éventuellement jusqu'à une limite (montant versé ou valeur atteinte). Une fois
 * la limite atteinte, sa part va à la ligne choisie, ou à défaut se répartit sur les autres au prorata.
 */

export const AllocationTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("type"), accountKind: z.enum(ACCOUNT_KINDS) }),
  z.object({ kind: z.literal("compte"), accountId: z.string().min(1) }),
]);
export type AllocationTarget = z.infer<typeof AllocationTarget>;

export const AllocationLimit = z.object({
  /** « verse » : jusqu'à avoir versé (net) ce montant ; « valeur » : jusqu'à ce que la valeur l'atteigne. */
  basis: z.enum(["verse", "valeur"]),
  amount: z.number().positive(),
});
export type AllocationLimit = z.infer<typeof AllocationLimit>;

export const AllocationRule = z.object({
  id: z.string().min(1),
  /** Nom libre ; à défaut, celui du compte ou du type visé. */
  label: z.string().max(80),
  target: AllocationTarget,
  /** Part des versements mensuels. */
  share: z.number().min(0).max(1),
  limit: AllocationLimit.nullable(),
  /** Ligne qui reçoit la part une fois la limite atteinte ; null = les autres lignes, au prorata. */
  overflowTo: z.string().nullable(),
});
export type AllocationRule = z.infer<typeof AllocationRule>;

/** Vérifications d'ensemble, pour le formulaire et la validation des paramètres. */
export function allocationIssues(rules: readonly AllocationRule[]): Array<{ index: number; field: "share" | "overflowTo"; message: string }> {
  const out: Array<{ index: number; field: "share" | "overflowTo"; message: string }> = [];
  const ids = new Set(rules.map((r) => r.id));
  rules.forEach((r, index) => {
    if (r.overflowTo && (r.overflowTo === r.id || !ids.has(r.overflowTo))) out.push({ index, field: "overflowTo", message: "Ligne de destination introuvable." });
  });
  const total = rules.reduce((s, r) => s + r.share, 0);
  if (total > 1 + 1e-9) out.push({ index: rules.length - 1, field: "share", message: `Les parts des versements dépassent 100 % (${Math.round(total * 1000) / 10} %).` });
  return out;
}

export function targetLabel(t: AllocationTarget, accounts: readonly Pick<Account, "id" | "name">[]): string {
  if (t.kind === "type") return t.accountKind === "livret" ? "Livrets" : ACCOUNT_KIND_LABELS[t.accountKind];
  return accounts.find((a) => a.id === t.accountId)?.name ?? "Compte supprimé";
}

export function ruleName(r: AllocationRule, accounts: readonly Pick<Account, "id" | "name">[]): string {
  return r.label.trim() || targetLabel(r.target, accounts);
}

/**
 * Parts effectives après les limites : une ligne terminée cède sa part à sa ligne de destination
 * (en suivant la chaîne si celle-ci est aussi terminée), sinon aux lignes encore actives au prorata.
 */
export function effectiveShares(rules: readonly Pick<AllocationRule, "id" | "share" | "overflowTo">[], done: ReadonlySet<string>): Map<string, number> {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const eff = new Map(rules.map((r) => [r.id, done.has(r.id) ? 0 : r.share]));
  const active = rules.filter((r) => !done.has(r.id));
  const activeTotal = active.reduce((s, r) => s + r.share, 0);
  for (const r of rules) {
    if (!done.has(r.id) || r.share === 0) continue;
    let dest = r.overflowTo;
    const seen = new Set([r.id]);
    while (dest && done.has(dest) && !seen.has(dest)) {
      seen.add(dest);
      dest = byId.get(dest)?.overflowTo ?? null;
    }
    if (dest && byId.has(dest) && !done.has(dest)) eff.set(dest, (eff.get(dest) ?? 0) + r.share);
    else if (activeTotal > 0) for (const a of active) eff.set(a.id, (eff.get(a.id) ?? 0) + (r.share * a.share) / activeTotal);
  }
  return eff;
}

export interface AllocationAccountInput {
  account: Pick<Account, "id" | "name" | "kind" | "archived">;
  value: number;
  netContrib: number;
  /** Versement programmé ce mois-ci. */
  currentMonthly: number;
}

export interface AllocationStatus {
  rule: AllocationRule;
  name: string;
  accountIds: string[];
  value: number;
  deposited: number;
  /** Limite atteinte. */
  done: boolean;
  /** Avancement vers la limite (0 à 1), null sans limite. */
  progress: number | null;
  /** Montant restant avant la limite, null sans limite. */
  remaining: number | null;
  /** Versements : part après redistribution, montant conseillé et montant programmé par mois. */
  contributionShare: number;
  advisedMonthly: number;
  programmedMonthly: number;
}

export interface AllocationReport {
  rows: AllocationStatus[];
  total: number;
  /** Total des versements programmés ce mois (base des parts de versements). */
  monthlyBase: number;
}

/** `monthlyBase` : base des parts de versements (capacité d'épargne si connue, sinon total programmé ce mois). */
export function allocationReport(rules: readonly AllocationRule[], accounts: readonly AllocationAccountInput[], total: number, monthlyBase = roundCents(accounts.reduce((s, a) => s + a.currentMonthly, 0))): AllocationReport {
  const base = rules.map((rule) => {
    const members = accounts.filter((a) => (rule.target.kind === "type" ? a.account.kind === rule.target.accountKind && !a.account.archived : a.account.id === rule.target.accountId));
    const value = roundCents(members.reduce((s, a) => s + a.value, 0));
    const deposited = roundCents(members.reduce((s, a) => s + a.netContrib, 0));
    const reached = rule.limit ? (rule.limit.basis === "verse" ? deposited : value) : 0;
    const done = !!rule.limit && reached >= rule.limit.amount - 0.005;
    return {
      rule,
      name: ruleName(rule, accounts.map((a) => a.account)),
      accountIds: members.map((a) => a.account.id),
      value,
      deposited,
      done,
      progress: rule.limit ? Math.min(1, Math.max(0, reached / rule.limit.amount)) : null,
      remaining: rule.limit ? roundCents(Math.max(0, rule.limit.amount - reached)) : null,
      programmedMonthly: roundCents(members.reduce((s, a) => s + a.currentMonthly, 0)),
    };
  });
  const done = new Set(base.filter((b) => b.done).map((b) => b.rule.id));
  const contributions = effectiveShares(rules, done);
  const rows = base.map((b): AllocationStatus => {
    const contributionShare = contributions.get(b.rule.id) ?? 0;
    return {
      ...b,
      contributionShare,
      advisedMonthly: roundCents(contributionShare * monthlyBase),
    };
  });
  return { rows, total, monthlyBase };
}
