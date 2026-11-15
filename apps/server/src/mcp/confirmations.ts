import { randomBytes } from "node:crypto";

/**
 * Suppressions annoncées par `prepare_deletion` et pas encore confirmées. Une confirmation ne sert qu'une fois,
 * dans le tenant qui l'a demandée, pendant 15 minutes. En mémoire du serveur, comme les aperçus d'import.
 */

export const CONFIRMATION_TTL_MS = 15 * 60_000;
const MAX_PER_TENANT = 50;

export interface PendingDeletion {
  id: string;
  kind: string;
  targetId: string;
  label: string;
  createdAt: number;
}

export class ConfirmationStore {
  private byTenant = new Map<string, Map<string, PendingDeletion>>();

  constructor(private now: () => number = Date.now) {}

  add(tenantId: string, pending: Omit<PendingDeletion, "id" | "createdAt">): PendingDeletion {
    const list = this.tenant(tenantId);
    this.prune(list);
    if (list.size >= MAX_PER_TENANT) {
      const oldest = [...list.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
      if (oldest) list.delete(oldest.id);
    }
    const full: PendingDeletion = { ...pending, id: `del_${randomBytes(9).toString("base64url")}`, createdAt: this.now() };
    list.set(full.id, full);
    return full;
  }

  /** Retire et renvoie la suppression annoncée : un second appel avec le même identifiant ne trouve plus rien. */
  take(tenantId: string, id: string): PendingDeletion | null {
    const list = this.tenant(tenantId);
    this.prune(list);
    const found = list.get(id) ?? null;
    list.delete(id);
    return found;
  }

  private tenant(tenantId: string): Map<string, PendingDeletion> {
    let list = this.byTenant.get(tenantId);
    if (!list) this.byTenant.set(tenantId, (list = new Map()));
    return list;
  }

  private prune(list: Map<string, PendingDeletion>): void {
    const now = this.now();
    for (const [id, p] of list) if (now - p.createdAt > CONFIRMATION_TTL_MS) list.delete(id);
  }
}
