import { randomBytes } from "node:crypto";
import type { StatementLine, TxType } from "@hamac/core";

/**
 * Aperçus d'import préparés par `prepare_import`, et importations appliquées qu'on peut encore annuler.
 * En mémoire du serveur, rangés par tenant : un aperçu ne peut être appliqué que par le compte qui l'a préparé.
 * Un redémarrage les perd ; c'est voulu (rien de sensible ne s'accumule) et documenté.
 */

export const DRAFT_TTL_MS = 60 * 60_000;
export const UNDO_TTL_MS = 24 * 3600_000;
const MAX_PER_TENANT = 20;

export interface Draft {
  id: string;
  accountId: string;
  lines: StatementLine[];
  defaultType: TxType | "auto";
  /** Statut de chaque ligne au moment de l'aperçu : l'application refuse s'il a changé. */
  statuses: string[];
  createdAt: number;
  /** Rempli quand l'aperçu est appliqué. */
  applied: { at: number; ids: string[] } | null;
}

export class DraftStore {
  private byTenant = new Map<string, Map<string, Draft>>();

  constructor(private now: () => number = Date.now) {}

  add(tenantId: string, draft: Omit<Draft, "id" | "createdAt" | "applied">): Draft {
    const drafts = this.tenant(tenantId);
    this.prune(drafts);
    // Au-delà du plafond, le plus ancien aperçu non appliqué laisse sa place.
    if (drafts.size >= MAX_PER_TENANT) {
      const oldest = [...drafts.values()].sort((a, b) => Number(a.applied !== null) - Number(b.applied !== null) || a.createdAt - b.createdAt)[0];
      if (oldest) drafts.delete(oldest.id);
    }
    const full: Draft = { ...draft, id: `imp_${randomBytes(9).toString("base64url")}`, createdAt: this.now(), applied: null };
    drafts.set(full.id, full);
    return full;
  }

  get(tenantId: string, id: string): Draft | null {
    const drafts = this.tenant(tenantId);
    this.prune(drafts);
    return drafts.get(id) ?? null;
  }

  markApplied(tenantId: string, id: string, ids: string[]): void {
    const draft = this.get(tenantId, id);
    if (draft) draft.applied = { at: this.now(), ids };
  }

  remove(tenantId: string, id: string): void {
    this.tenant(tenantId).delete(id);
  }

  private tenant(tenantId: string): Map<string, Draft> {
    let drafts = this.byTenant.get(tenantId);
    if (!drafts) this.byTenant.set(tenantId, (drafts = new Map()));
    return drafts;
  }

  private prune(drafts: Map<string, Draft>): void {
    const now = this.now();
    for (const [id, d] of drafts) if (d.applied ? now - d.applied.at > UNDO_TTL_MS : now - d.createdAt > DRAFT_TTL_MS) drafts.delete(id);
  }
}
