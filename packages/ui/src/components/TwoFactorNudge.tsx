import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router";
import { Modal } from "./form";
import { Button } from "./ui";
import { useAccount } from "@/lib/account";
import { cn } from "@/lib/cn";
import { NUDGE_TEXT, TWO_FACTOR_SETUP_LINK, twoFactorNudge } from "@/lib/twoFactor";

/** Bandeau non masquable, tant que la double authentification n'est pas active. */
export function TwoFactorBanner() {
  const account = useAccount();
  const navigate = useNavigate();
  const { banner, admin } = twoFactorNudge(account?.me ?? null, false);
  if (!banner) return null;
  return (
    <div role="alert" className={cn("no-print flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 text-sm lg:px-8", admin ? "border-negative/40 bg-negative/10" : "border-warning/40 bg-warning/10")}>
      <ShieldAlert size={17} className={cn("shrink-0", admin ? "text-negative" : "text-warning")} aria-hidden />
      <span className="min-w-0 flex-1">{admin ? NUDGE_TEXT.bannerAdmin : NUDGE_TEXT.banner}</span>
      <Button className="h-8" onClick={() => navigate(TWO_FACTOR_SETUP_LINK)}>
        Activer la double authentification
      </Button>
    </div>
  );
}

/** Fenêtre affichée une fois par connexion, tant que la double authentification n'est pas active. */
export function TwoFactorPrompt() {
  const account = useAccount();
  const navigate = useNavigate();
  const { modal, admin } = twoFactorNudge(account?.me ?? null, account?.justLoggedIn ?? false);
  if (!account) return null;
  const later = () => account.closeLoginPrompt();
  return (
    <Modal
      open={modal}
      onClose={later}
      title="Protégez votre compte"
      width="max-w-md"
      footer={
        <>
          <button type="button" onClick={later} className="mr-auto text-xs text-fg-faint underline-offset-2 hover:text-fg-muted hover:underline">
            Plus tard
          </button>
          <Button
            variant="primary"
            autoFocus
            onClick={() => {
              later();
              navigate(TWO_FACTOR_SETUP_LINK);
            }}
          >
            Activer maintenant
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-fg-muted">
        <p>{admin ? NUDGE_TEXT.introAdmin : NUDGE_TEXT.intro}</p>
        <p>{NUDGE_TEXT.how}</p>
      </div>
    </Modal>
  );
}
