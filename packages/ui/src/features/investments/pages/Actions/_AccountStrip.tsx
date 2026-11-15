import type { AccountState } from "@hamac/core";
import { AddTransactionButton } from "@/features/entry";
import { AccountStrip as Strip } from "@/shared/components/AccountStrip";
import { Amount } from "@/shared/components/Amount";
import { LISTED_ACCOUNT_KINDS, LISTED_ASSET_KINDS, listed } from "./_listed";

const valueOf = (s: AccountState) => s.positions.filter(listed).reduce((t, p) => t + p.value, 0);
/** Les espèces d'un contrat vont au fonds euros : elles ne sont pas « à investir » en actions. */
const showsCash = (s: AccountState) => s.account.kind !== "assurance_vie" && s.account.kind !== "per" && s.account.kind !== "epargne_salariale";

/** Les comptes qui détiennent ces lignes, en bref : chacun mène à sa page. */
export function AccountStrip({ accounts }: { accounts: AccountState[] }) {
  return (
    <Strip
      accounts={accounts}
      body={(s) => (
        <>
          {valueOf(s) > 0 ? (
            <span>
              <Amount value={valueOf(s)} compact /> <span className="text-fg-muted">en actions</span>
            </span>
          ) : (
            <span className="text-fg-muted">aucune action</span>
          )}
          {showsCash(s) && (
            <span className="text-fg-muted">
              espèces <Amount value={s.cash} compact />
            </span>
          )}
        </>
      )}
      footer={(s) =>
        valueOf(s) === 0 && (
          <AddTransactionButton accountId={s.account.id} type="achat" assetKinds={LISTED_ASSET_KINDS} accountKinds={LISTED_ACCOUNT_KINDS} label="Acheter des actions ou ETF" variant="ghost" className="mt-1 h-8 self-start px-2 text-accent" />
        )
      }
    />
  );
}
