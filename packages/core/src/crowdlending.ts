import { addMonths, monthsBetween } from "./dates";
import type { Account, Transaction } from "./domain";
import type { Institution } from "./institutions";
import { roundCents } from "./money";
import type { PlanParams } from "./params";
import { loanPayment } from "./realestate";

/**
 * Crowdlending : chaque plateforme est un compte, chaque prêt un projet.
 * L'argent investi quitte les espèces de la plateforme et y revient au fil des remboursements.
 * Selon le réglage de la plateforme, les intérêts sont calculés échéance par échéance,
 * ou déclarés au journal pour l'ensemble de la plateforme.
 */

export const CROWD_REPAYMENTS = ["in_fine", "coupons", "amortissable"] as const;
export type CrowdRepayment = (typeof CROWD_REPAYMENTS)[number];
export const CROWD_REPAYMENT_LABELS: Record<CrowdRepayment, string> = {
  in_fine: "In fine (tout à l'échéance)",
  coupons: "Intérêts mensuels, capital à l'échéance",
  amortissable: "Mensualités (capital et intérêts)",
};

export const CROWD_STATUSES = ["en_cours", "retard", "defaut", "rembourse"] as const;
export type CrowdStatus = (typeof CROWD_STATUSES)[number];
export const CROWD_STATUS_LABELS: Record<CrowdStatus, string> = { en_cours: "En cours", retard: "En retard", defaut: "En défaut", rembourse: "Remboursé" };

/** Période sans paiement (difficultés de l'emprunteur) ; `to` à null : toujours en cours. */
export interface CrowdPause {
  from: string;
  to: string | null;
}

export interface CrowdProject {
  id: string;
  /** Compte de type crowdlending (la plateforme). */
  accountId: string;
  name: string;
  amount: number;
  /** Taux annuel (fraction). */
  rate: number;
  startDate: string;
  termMonths: number;
  repayment: CrowdRepayment;
  status: CrowdStatus;
  /** Date du passage en défaut ou du remboursement : avant, le projet comptait comme en cours. */
  statusDate: string | null;
  /** Capital déjà remboursé, d'après la plateforme ; null = calculé. */
  repaidCapital: number | null;
  /** En défaut : montant qu'on espère récupérer ; null = 0 € tant qu'on ne sait pas. */
  expectedRecovery: number | null;
  /** Dans ou hors de l'allocation cible ; null = comme la plateforme (hors, par défaut). */
  inAllocation: boolean | null;
  comment: string;
  /** Périodes où les échéances ne sont pas payées. */
  interestPauses: CrowdPause[];
  /** Dates d'échéances déclarées non versées. */
  missedInterests: string[];
}

export type CrowdLineStatus = "verse" | "a_venir" | "non_verse" | "en_pause";
export const CROWD_LINE_LABELS: Record<CrowdLineStatus, string> = { verse: "Versé", a_venir: "À venir", non_verse: "Non versé", en_pause: "En pause" };

/** Une échéance du projet. */
export interface CrowdLine {
  date: string;
  /** Intérêts bruts. */
  interest: number;
  principal: number;
  status: CrowdLineStatus;
}

export interface CrowdProjectState {
  project: CrowdProject;
  /** Statut à la date demandée. */
  status: CrowdStatus;
  endDate: string;
  repaid: number;
  /** Capital restant dû par l'emprunteur. */
  outstanding: number;
  /** Ce que le projet vaut dans le patrimoine. */
  value: number;
  nextDate: string | null;
  /** Encore « en cours » après son échéance. */
  overdue: boolean;
  lines: CrowdLine[];
  /** Intérêts bruts versés d'après les échéances. */
  interestPaid: number;
  /** Une pause est en cours à la date demandée. */
  paused: boolean;
}

export const crowdEndDate = (p: Pick<CrowdProject, "startDate" | "termMonths">) => addMonths(p.startDate, p.termMonths);

const inPause = (pauses: readonly CrowdPause[], date: string) => pauses.some((p) => p.from <= date && (p.to == null || date <= p.to));

function buildLines(project: CrowdProject, status: CrowdStatus, asOf: string): CrowdLine[] {
  const { amount, rate, termMonths, startDate, repayment, statusDate } = project;
  const r = rate / 12;
  const stateOf = (date: string): CrowdLineStatus => (date > asOf ? "a_venir" : project.missedInterests.includes(date) ? "non_verse" : inPause(project.interestPauses, date) ? "en_pause" : "verse");
  if (repayment === "in_fine") {
    // Capital et intérêts arrivent ensemble : rien n'est versé tant que le projet n'est pas déclaré remboursé.
    const end = crowdEndDate(project);
    const date = status === "rembourse" && statusDate && statusDate < end ? statusDate : end;
    const months = status === "rembourse" ? Math.max(1, Math.min(termMonths, monthsBetween(startDate, date))) : termMonths;
    return [{ date, interest: roundCents(amount * r * months), principal: amount, status: status === "rembourse" ? stateOf(date) : "a_venir" }];
  }
  const payment = loanPayment(amount, rate, termMonths);
  const lines: CrowdLine[] = [];
  let balance = amount;
  for (let i = 1; i <= termMonths; i++) {
    const date = addMonths(startDate, i);
    const interest = repayment === "coupons" ? amount * r : balance * r;
    const principal = repayment === "coupons" ? 0 : Math.min(balance, payment - interest);
    balance -= principal;
    lines.push({ date, interest: roundCents(interest), principal: roundCents(principal), status: stateOf(date) });
  }
  // Après un défaut ou un remboursement, plus aucune échéance.
  if (status === "defaut" && !statusDate) return [];
  return (status === "defaut" || status === "rembourse") && statusDate ? lines.filter((l) => l.date <= statusDate) : lines;
}

export function crowdProjectState(project: CrowdProject, asOf: string): CrowdProjectState {
  const endDate = crowdEndDate(project);
  const status: CrowdStatus = project.statusDate && project.statusDate > asOf ? "en_cours" : project.status;
  const lines = buildLines(project, status, asOf);
  const paidLines = lines.filter((l) => l.status === "verse");
  const scheduled = project.repayment === "amortissable" ? paidLines.reduce((t, l) => t + l.principal, 0) : 0;
  const repaid = roundCents(Math.min(project.amount, status === "rembourse" ? project.amount : (project.repaidCapital ?? scheduled)));
  const outstanding = roundCents(project.amount - repaid);
  const value = status === "rembourse" ? 0 : status === "defaut" ? roundCents(Math.min(outstanding, project.expectedRecovery ?? 0)) : outstanding;
  const live = status === "en_cours" || status === "retard";
  const nextDate = live ? (lines.find((l) => l.date > asOf && !inPause(project.interestPauses, l.date))?.date ?? null) : null;
  return { project, status, endDate, repaid, outstanding, value, nextDate, overdue: status === "en_cours" && endDate < asOf, lines, interestPaid: roundCents(paidLines.reduce((t, l) => t + l.interest, 0)), paused: inPause(project.interestPauses, asOf) };
}

/** Réglages d'une plateforme, sur la fiche de son établissement. Sans établissement : intérêts déclarés, impôts non prélevés. */
export function crowdSettingsOf(data: { params: Pick<PlanParams, "tax">; institutions?: readonly Institution[] }, account: Pick<Account, "institutionId">): { calculated: boolean; withheld: boolean; rate: number } {
  const offer = data.institutions?.find((i) => i.id === account.institutionId)?.offers.crowdlending;
  return { calculated: offer?.interestMode === "calcule", withheld: offer?.taxWithheld ?? false, rate: offer?.taxRate ?? data.params.tax.pfuIncomeTax + data.params.tax.socialGeneral };
}

/** Intérêt calculé affiché dans le journal : jamais enregistré, se déclare non versé depuis l'échéancier. */
export interface CrowdInterestTransaction extends Transaction {
  crowdInterest: true;
  projectId: string;
}

export const isCrowdInterest = (t: Transaction): t is CrowdInterestTransaction => (t as Partial<CrowdInterestTransaction>).crowdInterest === true;

export function crowdInterestTransactions(data: { params: Pick<PlanParams, "tax">; institutions?: readonly Institution[]; accounts: readonly Account[]; crowdProjects?: readonly CrowdProject[] }, today: string): CrowdInterestTransaction[] {
  const out: CrowdInterestTransaction[] = [];
  for (const account of data.accounts.filter((a) => a.kind === "crowdlending")) {
    const { calculated, withheld, rate } = crowdSettingsOf(data, account);
    if (!calculated) continue;
    for (const project of (data.crowdProjects ?? []).filter((p) => p.accountId === account.id && p.startDate <= today)) {
      for (const l of crowdProjectState(project, today).lines) {
        if (l.status !== "verse" || l.interest <= 0) continue;
        out.push({ id: `crowd:${project.id}:${l.date}`, date: l.date, type: "interets", accountId: account.id, assetId: null, counterAccountId: null, amount: roundCents(withheld ? l.interest * (1 - rate) : l.interest), quantity: null, fee: null, comment: project.name, crowdInterest: true, projectId: project.id });
      }
    }
  }
  return out;
}

export interface CrowdSummary {
  /** Capital en cours (en cours et en retard). */
  active: number;
  /** Capital en retard ou en défaut. */
  atRisk: number;
  /** Taux moyen pondéré du capital en cours. */
  averageRate: number | null;
}

export function crowdSummary(states: readonly CrowdProjectState[]): CrowdSummary {
  const live = states.filter((s) => s.status === "en_cours" || s.status === "retard");
  const active = live.reduce((t, s) => t + s.outstanding, 0);
  const atRisk = states.filter((s) => s.status === "retard" || s.status === "defaut").reduce((t, s) => t + s.outstanding, 0);
  return { active: roundCents(active), atRisk: roundCents(atRisk), averageRate: active > 0 ? live.reduce((t, s) => t + s.outstanding * s.project.rate, 0) / active : null };
}
