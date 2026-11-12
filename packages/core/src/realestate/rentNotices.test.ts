import { describe, expect, it } from "vitest";
import { leaseAlerts } from "../alerts";
import type { Lease, RentPayment } from "./leases";
import { PlanParams, defaultParams } from "../model";
import type { Property } from "./realestate";
import { leaseArrears, noticeStep, type RentNotice } from "./rentNotices";

const bail: Lease = { id: "l", propertyId: "b", lotId: "lot", kind: "vide", startDate: "2026-01-01", durationMonths: 36, rent: 600, charges: 50, deposit: 0, noticeBy: null, noticeDate: null, noticeMonths: null, actualEnd: null, comment: "", reminders: true, depositReturned: null, depositReturnedOn: null, depositReason: "", landlord: "", tenantInsuranceUntil: null, revisable: true, irlQuarter: null, landlordAddress: "", dueDay: 5 };
const pay = (month: string, amount: number): RentPayment => ({ id: month, leaseId: "l", month, date: `${month}-05`, amount, method: "virement", comment: "" });
const ledger = { payments: [pay("2026-01", 650), pay("2026-02", 300)], waivers: [] };
const days = { rentReminderDays: 10, rentRelanceDays: 20, rentFormalNoticeDays: 30 };
const notice = (level: RentNotice["level"], sentOn: string): RentNotice => ({ id: sentOn, leaseId: "l", level, sentOn, amount: 350, comment: "" });

describe("relances des loyers non reçus", () => {
  it("ce que doit le bail : mois en retard, total, plus ancienne échéance et retard", () => {
    expect(leaseArrears(bail, [], ledger, "2026-02-14")).toBeNull();
    const a = leaseArrears(bail, [], ledger, "2026-03-20")!;
    expect(a.months.map((m) => [m.month, m.outstanding])).toEqual([["2026-02", 350], ["2026-03", 650]]);
    expect(a).toMatchObject({ total: 1_000, since: "2026-02-05", daysLate: 43 });
  });

  it("étape selon le retard : rappel, relance, mise en demeure", () => {
    const step = (today: string) => noticeStep(leaseArrears(bail, [], ledger, today), [], "l", days)?.level ?? null;
    expect(step("2026-02-16")).toBe("rappel");
    expect(step("2026-02-25")).toBe("relance");
    expect(step("2026-03-07")).toBe("mise_en_demeure");
    expect(noticeStep(null, [], "l", days)).toBeNull();
    // Délais plus longs : encore trop tôt.
    expect(noticeStep(leaseArrears(bail, [], ledger, "2026-02-16"), [], "l", { ...days, rentReminderDays: 15 })).toBeNull();
  });

  it("une étape est faite quand ce courrier, ou un plus ferme, est parti depuis le début du retard", () => {
    const arrears = leaseArrears(bail, [], ledger, "2026-02-26");
    expect(noticeStep(arrears, [notice("rappel", "2026-02-16")], "l", days)).toMatchObject({ level: "relance", done: false });
    expect(noticeStep(arrears, [notice("rappel", "2026-02-16"), notice("relance", "2026-02-26")], "l", days)).toMatchObject({ done: true });
    expect(noticeStep(arrears, [notice("mise_en_demeure", "2026-02-20")], "l", days)?.done).toBe(true);
    // Un courrier d'un retard précédent, ou d'un autre bail, ne compte pas.
    expect(noticeStep(arrears, [notice("relance", "2025-12-01"), { ...notice("relance", "2026-02-26"), leaseId: "x" }], "l", days)).toMatchObject({ done: false, sent: [] });
  });

  it("l'alerte du bail donne l'étape à suivre tant que le courrier n'est pas parti", () => {
    const bien = { id: "b", kind: "locatif", name: "Studio", archived: false } as Property;
    const detail = (rentNotices: RentNotice[]) => leaseAlerts({ properties: [bien], leases: [bail], leaseRents: [], rentPayments: ledger.payments, rentNotices }, "2026-02-26", days).find((a) => a.id === "loyers-non-recus-l")!.detail;
    expect(detail([])).toMatch(/Étape conseillée : relance\.$/);
    expect(detail([notice("relance", "2026-02-26")])).not.toMatch(/Étape conseillée/);
  });

  it("réglages : 10, 20 et 30 jours par défaut, dans cet ordre", () => {
    expect(defaultParams().alerts).toMatchObject(days);
    expect(PlanParams.safeParse({ ...defaultParams(), alerts: { ...defaultParams().alerts, rentRelanceDays: 5 } }).success).toBe(false);
  });
});
