import { randomBytes } from "node:crypto";

/**
 * Écritures annoncées et pas encore confirmées : suppressions (`prepare_deletion`), montants d'un IFU
 * (`prepare_tax_statement`). Une confirmation ne sert qu'une fois, dans le tenant qui l'a demandée, pendant
 * 15 minutes. En mémoire du serveur, comme les aperçus d'import.
 */

export const CONFIRMATION_TTL_MS = 15 * 60_000;
const MAX_PER_TENANT = 50;

export interface PendingAction {
  id: string;
  kind: string;
  targetId: string;
  label: string;
  /** Ce qui sera écrit, tel qu'annoncé (montants d'un IFU…). */
  payload?: unknown;
  createdAt: number;
}

export class ConfirmationStore {
  private byTenant = new Map<string, Map<string, PendingAction>>();

  constructor(private now: () => number = Date.now) {}

  add(tenantId: string, pending: Omit<PendingAction, "id" | "createdAt">): PendingAction {
    const list = this.tenant(tenantId);
    this.prune(list);
    if (list.size >= MAX_PER_TENANT) {
      const oldest = [...list.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldest) list.delete(oldest.id);
    }
    const full: PendingAction = { ...pending, id: `cnf_${randomBytes(9).toString("base64url")}`, createdAt: this.now() };
    list.set(full.id, full);
    return full;
  }

  /**
   * Retire et renvoie l'écriture annoncée, si elle est de l'une des natures attendues : un second appel avec le même
   * identifiant ne trouve plus rien. Une confirmation présentée au mauvais outil reste disponible pour le bon.
   */
  take(tenantId: string, id: string, kinds: readonly string[]): PendingAction | null {
    const list = this.tenant(tenantId);
    this.prune(list);
    const found = list.get(id);
    if (!found || !kinds.includes(found.kind)) return null;
    list.delete(id);
    return found;
  }

  private tenant(tenantId: string): Map<string, PendingAction> {
    let list = this.byTenant.get(tenantId);
    if (!list) this.byTenant.set(tenantId, (list = new Map()));
    return list;
  }

  private prune(list: Map<string, PendingAction>): void {
    const now = this.now();
    for (const [id, p] of list) if (now - p.createdAt > CONFIRMATION_TTL_MS) list.delete(id);
  }
}
