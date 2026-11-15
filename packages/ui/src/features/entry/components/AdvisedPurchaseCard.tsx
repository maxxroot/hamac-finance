import { advisedMonthlyPurchase, monthsElapsed, splitByTarget, type AccountState } from "@hamac/core";
import { AccountLink } from "@/shared/components/AccountLink";
import { Amount } from "@/shared/components/Amount";
import { Card, CardTitle } from "@/shared/components/ui";
import { usePortfolio } from "@/shared/lib/portfolio";

/**
 * Achat conseillé ce mois-ci dans un PEA : ses espèces étalées sur la durée choisie, réparties entre les titres
 * pour rapprocher chacun de sa part cible. Affiché sur la page Actions & ETF et sur la page du PEA.
 */
export function AdvisedPurchaseCard({ s, withAccount = false }: { s: AccountState; withAccount?: boolean }) {
  const pf = usePortfolio();
  if (!pf) return null;
  const { params } = pf.data;
  const advised = advisedMonthlyPurchase(s.cash, s.account.monthsToInvest, monthsElapsed(params, pf.today));
  const targets = pf.idx.activeAssets.filter((a) => a.targetWeight && (a.kind === "etf" || a.kind === "etc" || a.kind === "action" || a.kind === "fonds"));
  const split = splitByTarget(
    advised,
    targets.map((a) => ({ assetId: a.id, value: s.positions.find((p) => p.asset.id === a.id)?.value ?? 0, target: a.targetWeight ?? 0 })),
  );
  return (
    <Card>
      <CardTitle hint={`sur ${s.account.monthsToInvest ?? 1} mois`}>Achat conseillé ce mois-ci</CardTitle>
      {withAccount && (
        <p className="-mt-2 mb-2 text-xs text-fg-muted">
          dans <AccountLink account={s.account} />
        </p>
      )}
      <div className="text-2xl font-semibold">
        <Amount value={advised} />
      </div>
      {split.size > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {[...split.entries()]
            .filter(([, v]) => v > 0)
            .map(([id, v]) => (
              <li key={id} className="flex justify-between gap-2">
                <span className="truncate text-fg-muted">{pf.idx.assetById.get(id)?.name}</span>
                <Amount value={v} />
              </li>
            ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-fg-faint">Les espèces sont étalées sur la durée choisie, puis réparties pour se rapprocher des parts cibles.</p>
    </Card>
  );
}
