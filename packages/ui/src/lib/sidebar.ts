/** Réduction de la barre latérale : une préférence d'appareil, gardée dans le navigateur. */

const KEY = "hamac.sidebar.collapsed";

export function readCollapsed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function saveCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(KEY, collapsed ? "1" : "0");
  } catch {
    // Navigation privée : le réglage vaut pour la session en cours.
  }
}

/**
 * Sur grand écran, la barre suit la préférence. Sur écran étroit, elle reste réduite pour laisser
 * la place au contenu ; ouverte à la demande, elle passe par-dessus sans le comprimer.
 */
export function sidebarLayout({ wide, preferCollapsed, peek }: { wide: boolean; preferCollapsed: boolean; peek: boolean }): { collapsed: boolean; overlay: boolean } {
  return wide ? { collapsed: preferCollapsed, overlay: false } : { collapsed: !peek, overlay: peek };
}
