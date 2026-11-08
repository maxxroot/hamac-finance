export interface PriceRow {
  assetId: string;
  date: string;
  price: number;
  source: string;
}

/**
 * Fusionne les cours d'un tenant et ceux de la base commune : pour une même date, le cours manuel
 * prime, puis le cours commun, puis l'historique propre au tenant (restauré d'une sauvegarde, adresse
 * personnalisée). Garde le dernier cours de chaque mois, et tous les jours pour les titres de `daily`.
 */
export function mergePrices(own: readonly PriceRow[], shared: readonly PriceRow[], daily: ReadonlySet<string>): PriceRow[] {
  const byDay = new Map<string, PriceRow>();
  const rank = (p: PriceRow, common: boolean) => (p.source === "manuel" ? 2 : common ? 1 : 0);
  const add = (p: PriceRow, common: boolean) => {
    const k = `${p.assetId}|${p.date}`;
    const cur = byDay.get(k);
    if (!cur || rank(p, common) > rank(cur, sharedRows.has(cur))) byDay.set(k, p);
  };
  const sharedRows = new Set(shared);
  for (const p of own) add(p, false);
  for (const p of shared) add(p, true);
  const lastOfMonth = new Map<string, PriceRow>();
  const out: PriceRow[] = [];
  for (const p of byDay.values()) {
    if (daily.has(p.assetId)) {
      out.push(p);
      continue;
    }
    const k = `${p.assetId}|${p.date.slice(0, 7)}`;
    const cur = lastOfMonth.get(k);
    if (!cur || p.date > cur.date) lastOfMonth.set(k, p);
  }
  return [...out, ...lastOfMonth.values()];
}
