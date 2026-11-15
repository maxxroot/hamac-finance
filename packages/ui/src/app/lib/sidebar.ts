import type { Account, AccountKind } from "@hamac/core";

/** Réduction de la barre latérale et de la liste des comptes : des préférences d'appareil, gardées dans le navigateur. */

const KEY = "hamac.sidebar.collapsed";
const ACCOUNTS_KEY = "hamac.sidebar.accounts";

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

function saveFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Navigation privée : le réglage vaut pour la session en cours.
  }
}

export const readCollapsed = (): boolean => readFlag(KEY, false);
export const saveCollapsed = (collapsed: boolean): void => saveFlag(KEY, collapsed);
/** La liste des comptes sous « Mes comptes » est dépliée par défaut. */
export const readAccountsOpen = (): boolean => readFlag(ACCOUNTS_KEY, true);
export const saveAccountsOpen = (open: boolean): void => saveFlag(ACCOUNTS_KEY, open);

/** Ordre des comptes dans le menu : les comptes investis d'abord, l'épargne de précaution à la fin. */
const KIND_ORDER: readonly AccountKind[] = ["pea", "pea_pme", "cto", "assurance_vie", "per", "epargne_salariale", "crypto", "crowdlending", "livret"];

/** Comptes listés sous « Mes comptes » : ceux qui ne sont pas archivés, rangés par type puis dans l'ordre choisi. */
export function sidebarAccounts<A extends Pick<Account, "id" | "name" | "kind" | "sortOrder" | "archived">>(accounts: readonly A[]): A[] {
  return accounts
    .filter((a) => !a.archived)
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"));
}

/**
 * Sur grand écran, la barre suit la préférence. Sur écran étroit, elle reste réduite pour laisser
 * la place au contenu ; ouverte à la demande, elle passe par-dessus sans le comprimer.
 */
export function sidebarLayout({ wide, preferCollapsed, peek }: { wide: boolean; preferCollapsed: boolean; peek: boolean }): { collapsed: boolean; overlay: boolean } {
  return wide ? { collapsed: preferCollapsed, overlay: false } : { collapsed: !peek, overlay: peek };
}
