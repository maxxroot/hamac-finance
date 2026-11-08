import { addMonths, monthsBetween } from "./dates";
import { roundCents } from "./money";
import { loanState } from "./realestate";

/**
 * Crowdlending : chaque plateforme est un compte, chaque prêt un projet.
 * L'argent investi quitte les espèces de la plateforme et y revient au fil des remboursements.
 * Les intérêts réellement reçus se notent dans le journal.
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

export interface CrowdProject {
  id: string;
  /** Compte de type crowdlending (la plateforme). */
  accountId: string;
  name: string;
  amount: number;
  /** Taux annuel (fraction) ; null = pas encore renseigné (projet importé). */
  rate: number | null;
  startDate: string;
  /** Durée en mois ; null = pas encore renseignée. */
  termMonths: number | null;
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
  /** Identifiant dans un fichier importé. */
  externalId?: string | null;
  /** Nouvelle échéance quand la plateforme la prolonge (saisie au mois, fin de mois) ; remplace celle issue de la durée. */
  extendedTo?: string | null;
}

export interface CrowdProjectState {
  project: CrowdProject;
  /** Statut à la date demandée. */
  status: CrowdStatus;
  endDate: string | null;
  repaid: number;
  /** Capital restant dû par l'emprunteur. */
  outstanding: number;
  /** Ce que le projet vaut dans le patrimoine. */
  value: number;
  nextDate: string | null;
  /** Encore « en cours » après son échéance. */
  overdue: boolean;
}

/** Échéance prévue au départ, d'après la durée. */
export const crowdInitialEndDate = (p: Pick<CrowdProject, "startDate" | "termMonths">): string | null => (p.termMonths == null ? null : addMonths(p.startDate, p.termMonths));
/** Échéance en vigueur, prolongation comprise. */
export const crowdEndDate = (p: Pick<CrowdProject, "startDate" | "termMonths" | "extendedTo">): string | null => p.extendedTo ?? crowdInitialEndDate(p);
/** Une prolongation doit reculer l'échéance. */
export function crowdExtensionError(p: Pick<CrowdProject, "startDate" | "termMonths" | "extendedTo">): string | null {
  if (!p.extendedTo) return null;
  const initial = crowdInitialEndDate(p);
  if (p.extendedTo <= p.startDate) return "La nouvelle échéance doit suivre la date d'investissement.";
  // Saisie au mois : il faut un mois plus tardif que celui de l'échéance initiale.
  return initial && p.extendedTo.slice(0, 7) <= initial.slice(0, 7) ? "La nouvelle échéance doit être après l'échéance initiale." : null;
}

export function crowdProjectState(project: CrowdProject, asOf: string): CrowdProjectState {
  const endDate = crowdEndDate(project);
  const status: CrowdStatus = project.statusDate && project.statusDate > asOf ? "en_cours" : project.status;
  const firstPayment = addMonths(project.startDate, 1);
  // En retard : les mensualités ne sont plus comptées comme remboursées à partir de cette date.
  const until = status === "retard" && project.statusDate && project.statusDate < asOf ? project.statusDate : asOf;
  const scheduled = (): number =>
    project.repayment === "amortissable" && project.rate != null && project.termMonths != null
      ? project.amount - loanState({ id: project.id, kind: "autre", name: "", propertyId: null, principal: project.amount, rate: project.rate, termMonths: project.termMonths, firstPayment, insurance: 0, manualPayment: null, manualBalance: null, manualBalanceDate: null, archived: false }, until).balance
      : 0;
  const repaid = roundCents(Math.min(project.amount, status === "rembourse" ? project.amount : (project.repaidCapital ?? (status === "defaut" ? 0 : scheduled()))));
  const outstanding = roundCents(project.amount - repaid);
  const value = status === "rembourse" ? 0 : status === "defaut" ? roundCents(Math.min(outstanding, project.expectedRecovery ?? 0)) : outstanding;
  let nextDate: string | null = null;
  if (status === "en_cours" || status === "retard") {
    if (project.repayment === "in_fine") nextDate = endDate && endDate > asOf ? endDate : null;
    else for (let i = 0; i < (endDate ? monthsBetween(project.startDate, endDate) : 0) && !nextDate; i++) if (addMonths(firstPayment, i) > asOf) nextDate = addMonths(firstPayment, i);
  }
  return { project, status, endDate, repaid, outstanding, value, nextDate, overdue: status === "en_cours" && endDate != null && endDate < asOf };
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
  // Le taux moyen ne porte que sur les projets dont le taux est renseigné.
  const rated = live.filter((s) => s.project.rate != null);
  const ratedCapital = rated.reduce((t, s) => t + s.outstanding, 0);
  return { active: roundCents(active), atRisk: roundCents(atRisk), averageRate: ratedCapital > 0 ? rated.reduce((t, s) => t + s.outstanding * s.project.rate!, 0) / ratedCapital : null };
}
