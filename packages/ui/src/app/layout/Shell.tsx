import { Eye, EyeOff, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { auth, useAccount, useThemeChoice } from "@/features/settings";
import { NavLink, Outlet, useLocation } from "react-router";
import { cn } from "@/shared/lib/cn";
import { useSetSetting, useSetting } from "@/shared/lib/queries";
import { readCollapsed, saveCollapsed, sidebarLayout } from "@/app/lib/sidebar";
import { useTheme } from "@/shared/lib/theme";
import { NAV, SETTINGS_ITEM, type NavItem } from "@/shared/nav";
import { HamacMark, Wordmark } from "@/shared/components/Brand";
import { PriceStatus } from "@/app/components/PriceStatus";
import { TwoFactorBanner, TwoFactorPrompt } from "@/app/components/TwoFactorNudge";
import { useWorkspace } from "@/shared/lib/workspace";
import { useWorkspaceSync } from "@/shared/lib/workspaceSync";

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
          "flex items-center rounded-lg py-1.5 text-sm transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold",
          collapsed ? "justify-center px-0" : "gap-3 px-3",
          isActive ? "bg-side-active font-medium text-side-fg" : "text-side-muted hover:bg-side-active/60 hover:text-side-fg",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={collapsed ? 19 : 17} strokeWidth={1.7} className={isActive ? "text-gold" : undefined} />
          {!collapsed && item.label}
        </>
      )}
    </NavLink>
  );
}

const topButton = "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg";

export function Shell() {
  const privacy = useSetting<boolean>("ui.privacyMode", false);
  const setPrivacy = useSetSetting("ui.privacyMode");
  const { setChoice } = useThemeChoice();
  const theme = useTheme();
  const params = useWorkspace().data?.params;
  // Les écritures de l'assistant (MCP) apparaissent sans recharger la page.
  useWorkspaceSync();
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
  const nextTheme = theme === "sombre" ? "clair" : "sombre";

  return (
    <div className={cn("print-flow flex h-full", privacy.value && "privacy")}>
      {overlay && <div className="fixed inset-0 z-30 bg-[#08120e]/55" onClick={() => setPeek(false)} aria-hidden />}
      {/* La largeur réservée reste celle de la barre réduite quand elle passe par-dessus : le contenu ne bouge pas. */}
      <div className={cn("no-print relative shrink-0 transition-[width] duration-200", collapsed || overlay ? "w-16" : "w-60")}>
        <aside className={cn("flex h-full flex-col border-r border-side-line bg-side text-side-fg", overlay ? "absolute inset-y-0 left-0 z-40 w-60 shadow-float" : "w-full")}>
          <div className={cn("flex h-16 shrink-0 items-center gap-2.5", collapsed ? "justify-center" : "px-5")}>
            <HamacMark />
            {!collapsed && <Wordmark />}
          </div>
          <nav className={cn("flex-1 overflow-x-hidden overflow-y-auto pt-2 pb-4", collapsed ? "space-y-3 px-2" : "space-y-5 px-3")}>
            {groups.map((group, i) => (
              <div key={group.label}>
                {collapsed ? i > 0 && <div className="mx-2 mb-3 border-t border-side-line" /> : <div className="mb-1 px-3 text-xs text-side-muted/80">{group.label}</div>}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavEntry key={item.path} item={item} collapsed={collapsed} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className={cn("border-t border-side-line", collapsed ? "p-2" : "p-3")}>
            <NavEntry item={SETTINGS_ITEM} collapsed={collapsed} />
            <WebUser collapsed={collapsed} />
          </div>
        </aside>
      </div>

      <div className="print-flow flex min-w-0 flex-1 flex-col">
        <TwoFactorBanner />
        <div className="no-print flex h-16 shrink-0 items-center gap-1 border-b border-line px-4 lg:px-8">
          <button onClick={toggle} className="-ml-1 rounded-lg p-2 text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label={collapsed ? "Agrandir le menu" : "Réduire le menu"} aria-expanded={!collapsed} title={collapsed ? "Agrandir le menu" : "Réduire le menu"}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <div className="flex-1" />
          <PriceStatus />
          <button onClick={() => setPrivacy.mutate(!privacy.value)} className={topButton} title="Masquer les montants (survoler pour les voir)">
            {privacy.value ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="hidden whitespace-nowrap md:inline">{privacy.value ? "Montants masqués" : "Mode discret"}</span>
          </button>
          <button onClick={() => setChoice(nextTheme)} className={cn(topButton, "px-2.5")} aria-label={theme === "sombre" ? "Passer au thème clair" : "Passer au thème sombre"} title={theme === "sombre" ? "Passer au thème clair" : "Passer au thème sombre"}>
            {theme === "sombre" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        {/* Les mises en page suivent la largeur de cette zone (@3xl:), pas celle de la fenêtre : elles s'adaptent à la barre. */}
        <main className="@container flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[100rem] px-4 py-7 lg:px-10 lg:py-9">
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
    <div className={cn("mt-1 flex items-center gap-2 py-1.5 text-xs text-side-muted", collapsed ? "justify-center" : "justify-between px-3")} title={collapsed ? (email ?? "") : undefined}>
      {!collapsed && (
        <span className="truncate" title={email ?? ""}>
          {email}
        </span>
      )}
      <button
        className="rounded p-1 hover:bg-side-active hover:text-side-fg"
        title="Se déconnecter"
        aria-label="Se déconnecter"
        onClick={() => void auth.logout().finally(() => window.dispatchEvent(new Event("hamac:unauthorized")))}
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
