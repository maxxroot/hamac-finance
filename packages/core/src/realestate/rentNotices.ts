import { rentIsLate, rentMonths, type Lease, type LeaseRent, type RentLedger, type RentMonth } from "./leases";
import { daysBetween, roundCents } from "../base";
import type { PlanParams } from "../model";

/**
 * Relances d'un loyer non reçu : rappel amiable, relance, puis mise en demeure, à des délais réglables après l'échéance.
 * Ensuite, seul un commissaire de justice peut délivrer un commandement de payer (loi n° 89-462 du 6 juillet 1989, art. 24).
 * Le même article demande de signifier ce commandement à la caution dans les quinze jours. Quand l'aide au logement est
 * versée au propriétaire, l'impayé est aussi à signaler à la CAF (code de la construction et de l'habitation ; article et délai
 * non relevés). Ces obligations sont rappelées dans l'interface sans être vérifiées : à contrôler avant tout recours.
 */

export const NOTICE_LEVELS = ["rappel", "relance", "mise_en_demeure"] as const;
export type NoticeLevel = (typeof NOTICE_LEVELS)[number];
export const NOTICE_LEVEL_LABELS: Record<NoticeLevel, string> = { rappel: "Rappel amiable", relance: "Relance", mise_en_demeure: "Mise en demeure" };

/** Courrier de relance envoyé, avec la somme réclamée à cette date. */
export interface RentNotice {
  id: string;
  leaseId: string;
  level: NoticeLevel;
  sentOn: string;
  amount: number;
  comment: string;
}

export interface LeaseArrears {
  /** Loyers non reçus ou reçus en partie, passé le délai de tolérance, du plus ancien au plus récent. */
  months: RentMonth[];
  total: number;
  /** Échéance la plus ancienne restée impayée, et le retard depuis cette date. */
  since: string;
  daysLate: number;
}

/** Ce que le bail doit encore à `today` ; null s'il est à jour. */
export function leaseArrears(lease: Lease, rents: readonly LeaseRent[], ledger: RentLedger, today: string): LeaseArrears | null {
  const months = rentMonths(lease, rents, ledger, today).filter(rentIsLate);
  if (!months.length) return null;
  return { months, total: roundCents(months.reduce((s, m) => s + m.outstanding, 0)), since: months[0].dueDate, daysLate: daysBetween(months[0].dueDate, today) };
}

type NoticeDays = Pick<PlanParams["alerts"], "rentReminderDays" | "rentRelanceDays" | "rentFormalNoticeDays">;

export interface NoticeStep {
  /** Étape à laquelle le retard est arrivé. */
  level: NoticeLevel;
  /** Courriers déjà envoyés pour ce retard (depuis la plus ancienne échéance impayée). */
  sent: RentNotice[];
  /** L'étape a déjà fait l'objet d'un courrier. */
  done: boolean;
}

/** Étape de relance où en est un retard, selon les délais réglés ; null tant que le premier délai n'est pas atteint. */
export function noticeStep(arrears: LeaseArrears | null, notices: readonly RentNotice[], leaseId: string, days: NoticeDays): NoticeStep | null {
  if (!arrears) return null;
  const level: NoticeLevel | null = arrears.daysLate >= days.rentFormalNoticeDays ? "mise_en_demeure" : arrears.daysLate >= days.rentRelanceDays ? "relance" : arrears.daysLate >= days.rentReminderDays ? "rappel" : null;
  if (!level) return null;
  const sent = notices.filter((n) => n.leaseId === leaseId && n.sentOn >= arrears.since).sort((a, b) => a.sentOn.localeCompare(b.sentOn));
  return { level, sent, done: sent.some((n) => NOTICE_LEVELS.indexOf(n.level) >= NOTICE_LEVELS.indexOf(level)) };
}
