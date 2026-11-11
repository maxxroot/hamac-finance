import { useEffect } from "react";
import { useSetSetting, useSetting } from "@/lib/queries";
import { applyTheme, isThemeChoice, readStoredChoice, type ThemeChoice } from "@/lib/theme";

/**
 * Choix du thème gardé dans le compte : il suit l'utilisateur d'un appareil à l'autre.
 * Le navigateur en garde une copie pour l'appliquer dès le chargement suivant.
 */
export function useThemeChoice(): { choice: ThemeChoice; setChoice: (c: ThemeChoice) => void } {
  const setting = useSetting<unknown>("ui.theme", null);
  const save = useSetSetting("ui.theme");
  const stored = isThemeChoice(setting.value) ? setting.value : null;

  useEffect(() => {
    if (stored) applyTheme(stored);
  }, [stored]);

  return {
    choice: stored ?? readStoredChoice(),
    setChoice: (c) => {
      applyTheme(c);
      save.mutate(c);
    },
  };
}
