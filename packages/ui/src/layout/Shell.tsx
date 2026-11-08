import { Eye, EyeOff, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { auth } from "@/lib/auth";
import { NavLink, Outlet } from "react-router";
import { cn } from "@/lib/cn";
import { useSetSetting, useSetting } from "@/lib/queries";
import { NAV, SETTINGS_ITEM, type NavItem } from "@/nav";
import { PriceStatus } from "@/components/PriceStatus";
import { useWorkspace } from "@/lib/workspace";

function NavEntry({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
          isActive ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={17} strokeWidth={1.8} className={isActive ? "text-accent" : undefined} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

export function Shell() {
  const privacy = useSetting<boolean>("ui.privacyMode", false);
  const setPrivacy = useSetSetting("ui.privacyMode");
  const params = useWorkspace().data?.params;
  const retraite = params?.profile.goal !== "patrimoine";
  const visible = (item: NavItem) => (retraite || !item.retirementOnly) && (!item.module || params?.modules[item.module] !== false);
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length);

  return (
    <div className={cn("flex h-full", privacy.value && "privacy")}>
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <HamacMark />
          <span className="text-lg font-semibold tracking-tight">Hamac</span>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-fg-faint">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavEntry key={item.path} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <NavEntry item={SETTINGS_ITEM} />
          <WebUser />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center justify-end gap-2 border-b border-line px-8">
          <PriceStatus />
          <button
            onClick={() => setPrivacy.mutate(!privacy.value)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
            title="Masquer les montants (survoler pour les voir)"
          >
            {privacy.value ? <EyeOff size={16} /> : <Eye size={16} />}
            {privacy.value ? "Montants masqués" : "Mode discret"}
          </button>
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

/** Mode web : utilisateur connecté et déconnexion. */
function WebUser() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    void auth.me().then(setEmail);
  }, []);
  return (
    <div className="mt-1 flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-fg-faint">
      <span className="truncate" title={email ?? ""}>
        {email}
      </span>
      <button
        className="rounded p-1 hover:bg-surface-2 hover:text-fg"
        title="Se déconnecter"
        onClick={() => void auth.logout().finally(() => window.dispatchEvent(new Event("hamac:unauthorized")))}
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}

/** Logo provisoire : un hamac tendu entre deux points. */
function HamacMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
      <path d="M6 10 C 10 23, 22 23, 26 10" fill="none" stroke="var(--color-accent-fg)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="6" cy="9" r="2" fill="var(--color-accent-fg)" />
      <circle cx="26" cy="9" r="2" fill="var(--color-accent-fg)" />
    </svg>
  );
}
