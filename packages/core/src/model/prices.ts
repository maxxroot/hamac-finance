import type { Asset, PricePoint } from "./domain";

/**
 * Carnet de cours : dernier cours connu à une date donnée.
 * Règle unique : le point le plus récent l'emporte ; à date égale, un cours manuel l'emporte.
 */
export class PriceBook {
  private byAsset = new Map<string, PricePoint[]>();

  constructor(points: readonly PricePoint[], assets: readonly Asset[] = []) {
    for (const p of points) {
      const list = this.byAsset.get(p.assetId) ?? [];
      list.push(p);
      this.byAsset.set(p.assetId, list);
    }
    // Cours manuel saisi sur la fiche du titre, s'il n'est pas déjà dans l'historique.
    for (const a of assets) {
      if (a.manualPrice == null) continue;
      const list = this.byAsset.get(a.id) ?? [];
      const date = a.manualPriceDate ?? "1900-01-01";
      if (!list.some((p) => p.date === date && p.source === "manuel")) list.push({ assetId: a.id, date, price: a.manualPrice, source: "manuel" });
      this.byAsset.set(a.id, list);
    }
    for (const list of this.byAsset.values()) {
      list.sort((x, y) => (x.date === y.date ? (x.source === "manuel" ? 1 : 0) - (y.source === "manuel" ? 1 : 0) : x.date.localeCompare(y.date)));
    }
  }

  /** Dernier point à ou avant `date`. */
  at(assetId: string, date: string): PricePoint | null {
    const list = this.byAsset.get(assetId);
    if (!list?.length) return null;
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].date <= date) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found >= 0 ? list[found] : null;
  }

  history(assetId: string): readonly PricePoint[] {
    return this.byAsset.get(assetId) ?? [];
  }
}
