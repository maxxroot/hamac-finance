import { Check } from "lucide-react";
import { Card, CardTitle } from "@/shared/components/ui";
import { cn } from "@/shared/lib/cn";
import { THEME_CHOICES, type ThemeChoice } from "@/shared/lib/theme";
import { useThemeChoice } from "@/features/settings/lib/useThemeChoice";

/** Aperçu miniature de chaque thème : ses vraies couleurs, quel que soit le thème affiché. */
const PREVIEW: Record<Exclude<ThemeChoice, "systeme">, { side: string; bg: string; card: string; line: string; ink: string; accent: string }> = {
  clair: { side: "#173a2e", bg: "#f4efe3", card: "#fbf8f1", line: "#e2d9c6", ink: "#1a2b23", accent: "#b08d4c" },
  sombre: { side: "#0b1511", bg: "#0e1a15", card: "#142420", line: "#263b33", ink: "#ede6d6", accent: "#d0ae6a" },
};

function Preview({ theme }: { theme: keyof typeof PREVIEW }) {
  const c = PREVIEW[theme];
  return (
    <svg viewBox="0 0 120 72" className="block h-full w-full" aria-hidden>
      <rect width="120" height="72" fill={c.bg} />
      <rect width="28" height="72" fill={c.side} />
      <rect x="6" y="8" width="10" height="10" rx="2.5" fill={c.accent} />
      <rect x="6" y="26" width="16" height="3" rx="1.5" fill={c.accent} opacity=".9" />
      <rect x="6" y="34" width="13" height="3" rx="1.5" fill="#efe8d6" opacity=".35" />
      <rect x="6" y="42" width="15" height="3" rx="1.5" fill="#efe8d6" opacity=".35" />
      <rect x="36" y="9" width="40" height="6" rx="2" fill={c.ink} />
      <rect x="36" y="22" width="76" height="20" rx="3" fill={c.card} stroke={c.line} />
      <rect x="41" y="28" width="30" height="7" rx="2" fill={c.ink} opacity=".85" />
      <rect x="36" y="47" width="36" height="18" rx="3" fill={c.card} stroke={c.line} />
      <rect x="76" y="47" width="36" height="18" rx="3" fill={c.card} stroke={c.line} />
    </svg>
  );
}

export function AppearanceCard() {
  const { choice, setChoice } = useThemeChoice();
  return (
    <Card>
      <CardTitle hint="Gardé dans votre compte, sur tous vos appareils">Apparence</CardTitle>
      <div role="radiogroup" aria-label="Thème" className="grid max-w-xl grid-cols-3 gap-3">
        {THEME_CHOICES.map((t) => {
          const on = choice === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChoice(t.value)}
              className={cn(
                "group cursor-pointer rounded-xl border p-1.5 text-left transition-colors duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                on ? "border-accent" : "border-line hover:border-line-strong",
              )}
            >
              <span className="block aspect-[5/3] overflow-hidden rounded-lg border border-line">
                {t.value === "systeme" ? (
                  <span className="grid h-full grid-cols-2">
                    <span className="overflow-hidden">
                      <Preview theme="clair" />
                    </span>
                    <span className="overflow-hidden">
                      <Preview theme="sombre" />
                    </span>
                  </span>
                ) : (
                  <Preview theme={t.value} />
                )}
              </span>
              <span className="mt-2 flex items-center justify-between gap-2 px-1 pb-0.5 text-sm">
                <span className={on ? "font-medium text-fg" : "text-fg-muted"}>{t.label}</span>
                {on && <Check size={15} className="text-accent" aria-hidden />}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
