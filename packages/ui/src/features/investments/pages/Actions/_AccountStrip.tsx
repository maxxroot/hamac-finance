import { ACCOUNT_KIND_LABELS, type AccountState } from "@hamac/core";
import { AddTransactionButton } from "@/features/entry";
import { AccountLink } from "@/shared/components/AccountLink";
import { Amount } from "@/shared/components/Amount";
import { Card } from "@/shared/components/ui";
import { usePortfolio } from "@/shared/lib/portfolio";
import { LISTED_ACCOUNT_KINDS, LISTED_ASSET_KINDS, listed } from "./_listed";

/** Les comptes qui détiennent ces lignes, en bref : chacun mène à sa page. */
export function AccountStrip({ accounts }: { accounts: AccountState[] }) {
  const pf = usePortfolio();
  if (!pf) return null;
  return (
    <nav aria-label="Comptes concernés" className="mb-6 grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
      {accounts.map((s) => {
        const value = s.positions.filter(listed).reduce((t, p) => t + p.value, 0);
        const inst = s.account.institutionId ? pf.idx.institutionById.get(s.account.institutionId) : undefined;
        return (
          <Card key={s.account.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <AccountLink account={s.account} className="truncate font-medium" />
              <span className="shrink-0 text-xs text-fg-faint">{ACCOUNT_KIND_LABELS[s.account.kind]}</span>
            </div>
            {inst && <span className="truncate text-xs text-fg-muted">{inst.name}</span>}
            <div className="mt-1 flex items-center justify-between gap-3 text-sm">
              {value > 0 ? (
                <span>
                  <Amount value={value} compact /> <span className="text-fg-muted">en actions</span>
                </span>
              ) : (
                <span className="text-fg-muted">aucune action</span>
              )}
              {s.account.kind !== "assurance_vie" && s.account.kind !== "per" && s.account.kind !== "epargne_salariale" && (
                <span className="text-fg-muted">
                  espèces <Amount value={s.cash} compact />
                </span>
              )}
            </div>
            {value === 0 && (
              <AddTransactionButton accountId={s.account.id} type="achat" assetKinds={LISTED_ASSET_KINDS} accountKinds={LISTED_ACCOUNT_KINDS} label="Acheter des actions ou ETF" variant="ghost" className="mt-1 h-8 self-start px-2 text-accent" />
            )}
          </Card>
        );
      })}
    </nav>
  );
}
