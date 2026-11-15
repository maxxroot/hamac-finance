import type { ReactNode } from "react";
import { ACCOUNT_KIND_LABELS, type AccountState } from "@hamac/core";
import { AccountLink } from "@/shared/components/AccountLink";
import { Card } from "@/shared/components/ui";
import { usePortfolio } from "@/shared/lib/portfolio";

/**
 * Bandeau des comptes concernés par une page de placement : une carte courte par compte, dont le nom ouvre sa page.
 * La page dit ce que la carte montre du compte (`body`) et ce qu'on peut y faire (`footer`).
 */
export function AccountStrip({ accounts, body, footer }: { accounts: readonly AccountState[]; body: (s: AccountState) => ReactNode; footer?: (s: AccountState) => ReactNode }) {
  const pf = usePortfolio();
  if (!pf || accounts.length === 0) return null;
  return (
    <nav aria-label="Comptes concernés" className="mb-6 grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
      {accounts.map((s) => {
        const inst = s.account.institutionId ? pf.idx.institutionById.get(s.account.institutionId) : undefined;
        return (
          <Card key={s.account.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <AccountLink account={s.account} className="truncate font-medium" />
              <span className="shrink-0 text-xs text-fg-faint">{ACCOUNT_KIND_LABELS[s.account.kind]}</span>
            </div>
            {inst && <span className="truncate text-xs text-fg-muted">{inst.name}</span>}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">{body(s)}</div>
            {footer?.(s)}
          </Card>
        );
      })}
    </nav>
  );
}
