import { Eye, EyeOff, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "@/lib/account";
import { auth } from "@/lib/auth";
import { NavLink, Outlet, useLocation } from "react-router";
import { cn } from "@/lib/cn";
import { useSetSetting, useSetting } from "@/lib/queries";
import { readCollapsed, saveCollapsed, sidebarLayout } from "@/lib/sidebar";
import { NAV, SETTINGS_ITEM, type NavItem } from "@/nav";
import { PriceStatus } from "@/components/PriceStatus";
import { TwoFactorBanner, TwoFactorPrompt } from "@/components/TwoFactorNudge";
import { useWorkspace } from "@/lib/workspace";

/** En dessous, la barre reste réduite pour laisser la place au contenu. */
const WIDE_SCREEN = "(min-width: 1024px)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function NavEntry({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-lg py-1.5 text-sm transition-colors",
          collapsed ? "justify-center px-0" : "gap-3 px-3",
          isActive ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={collapsed ? 19 : 17} strokeWidth={1.8} className={isActive ? "text-accent" : undefined} />
          {!collapsed && item.label}
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

  const wide = useMediaQuery(WIDE_SCREEN);
  const [preferCollapsed, setPreferCollapsed] = useState(readCollapsed);
  const [peek, setPeek] = useState(false);
  const { collapsed, overlay } = sidebarLayout({ wide, preferCollapsed, peek });
  const { pathname } = useLocation();
  // Ouverte par-dessus le contenu : elle se referme dès qu'on a choisi une page.
  useEffect(() => setPeek(false), [pathname, wide]);
  const toggle = () => {
    if (!wide) return setPeek(!peek);
    setPreferCollapsed(!preferCollapsed);
    saveCollapsed(!preferCollapsed);
  };

  return (
    <div className={cn("print-flow flex h-full", privacy.value && "privacy")}>
      {overlay && <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setPeek(false)} aria-hidden />}
      {/* La largeur réservée reste celle de la barre réduite quand elle passe par-dessus : le contenu ne bouge pas. */}
      <div className={cn("no-print relative shrink-0 transition-[width] duration-200", collapsed || overlay ? "w-16" : "w-60")}>
        <aside className={cn("flex h-full flex-col border-r border-line bg-surface", overlay ? "absolute inset-y-0 left-0 z-40 w-60 shadow-2xl" : "w-full")}>
          <div className={cn("flex h-16 shrink-0 items-center gap-2.5", collapsed ? "justify-center" : "px-5")}>
            <HamacMark />
            {!collapsed && <span className="text-lg font-semibold tracking-tight">Hamac</span>}
          </div>
          <nav className={cn("flex-1 overflow-x-hidden overflow-y-auto pb-4", collapsed ? "space-y-3 px-2" : "space-y-5 px-3")}>
            {groups.map((group, i) => (
              <div key={group.label}>
                {collapsed ? i > 0 && <div className="mx-2 mb-3 border-t border-line" /> : <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-fg-faint">{group.label}</div>}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavEntry key={item.path} item={item} collapsed={collapsed} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className={cn("border-t border-line", collapsed ? "p-2" : "p-3")}>
            <NavEntry item={SETTINGS_ITEM} collapsed={collapsed} />
            <WebUser collapsed={collapsed} />
          </div>
        </aside>
      </div>

      <div className="print-flow flex min-w-0 flex-1 flex-col">
        <TwoFactorBanner />
        <div className="no-print flex h-16 shrink-0 items-center gap-2 border-b border-line px-4 lg:px-8">
          <button onClick={toggle} className="-ml-1 rounded-lg p-2 text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label={collapsed ? "Agrandir le menu" : "Réduire le menu"} aria-expanded={!collapsed} title={collapsed ? "Agrandir le menu" : "Réduire le menu"}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <div className="flex-1" />
          <PriceStatus />
          <button
            onClick={() => setPrivacy.mutate(!privacy.value)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
            title="Masquer les montants (survoler pour les voir)"
          >
            {privacy.value ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="hidden whitespace-nowrap md:inline">{privacy.value ? "Montants masqués" : "Mode discret"}</span>
          </button>
        </div>
        {/* Les mises en page suivent la largeur de cette zone (@3xl:), pas celle de la fenêtre : elles s'adaptent à la barre. */}
        <main className="@container flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[100rem] px-4 py-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <TwoFactorPrompt />
    </div>
  );
}

/** Mode web : utilisateur connecté et déconnexion. */
function WebUser({ collapsed }: { collapsed: boolean }) {
  const email = useAccount()?.me.email ?? null;
  return (
    <div className={cn("mt-1 flex items-center gap-2 py-1.5 text-xs text-fg-faint", collapsed ? "justify-center" : "justify-between px-3")} title={collapsed ? (email ?? "") : undefined}>
      {!collapsed && (
        <span className="truncate" title={email ?? ""}>
          {email}
        </span>
      )}
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
