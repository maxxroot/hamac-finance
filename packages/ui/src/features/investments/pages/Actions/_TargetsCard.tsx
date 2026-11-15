import type { PositionState } from "@hamac/core";
import { Pct } from "@/shared/components/Stat";
import { Card, CardTitle } from "@/shared/components/ui";
import { usePortfolio } from "@/shared/lib/portfolio";

/**
 * Part réelle de chaque titre face à sa part cible. La cible vaut pour l'ensemble des comptes :
 * un titre détenu dans le PEA et dans un compte-titres est additionné.
 */
export function TargetsCard({ positions }: { positions: PositionState[] }) {
  const pf = usePortfolio();
  if (!pf) return null;
  const total = positions.reduce((t, p) => t + p.value, 0);
  const byAsset = new Map<string, number>();
  for (const p of positions) byAsset.set(p.asset.id, (byAsset.get(p.asset.id) ?? 0) + p.value);
  const assets = pf.idx.activeAssets.filter((a) => a.targetWeight != null && a.targetWeight > 0);
  for (const a of assets) if (!byAsset.has(a.id)) byAsset.set(a.id, 0);
  const rows = [...byAsset.entries()]
    .map(([id, value]) => {
      const asset = pf.idx.assetById.get(id)!;
      const share = total > 0 ? value / total : 0;
      return { id, name: asset.name, share, target: asset.targetWeight ?? null };
    })
    .filter((r) => r.target != null)
    .sort((a, b) => (b.target ?? 0) - (a.target ?? 0));
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardTitle hint="tous comptes confondus">Parts cibles</CardTitle>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-fg-faint">
            <th className="pb-1 text-left font-normal">Titre</th>
            <th className="pb-1 text-right font-normal">Réelle</th>
            <th className="pb-1 text-right font-normal">Cible</th>
            <th className="pb-1 text-right font-normal">Écart</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="max-w-40 truncate py-1 text-fg-muted" title={r.name}>
                {r.name}
              </td>
              <td className="py-1 text-right">
                <Pct value={r.share} />
              </td>
              <td className="py-1 text-right">
                <Pct value={r.target} />
              </td>
              <td className="py-1 text-right">
                <Pct value={r.share - (r.target ?? 0)} signed />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
