import type { Me } from "./auth";

/** Logique d'affichage de la double authentification, séparée des composants pour être testée. */

/** Page qui ouvre directement l'activation. */
export const TWO_FACTOR_SETUP_LINK = "/parametres?onglet=Application&activer2fa=1";

export interface Nudge {
  /** Fenêtre « Protégez votre compte », une fois par connexion. */
  modal: boolean;
  /** Bandeau sur toutes les pages. */
  banner: boolean;
  admin: boolean;
}

/** Sans clé de sécurité sur le serveur, l'activation échouerait : inutile d'y pousser. */
export function twoFactorNudge(me: Pick<Me, "isAdmin" | "twoFactor"> | null, justLoggedIn: boolean): Nudge {
  const exposed = !!me && !me.twoFactor.enabled && me.twoFactor.available;
  return { modal: exposed && justLoggedIn, banner: exposed, admin: exposed && !!me?.isAdmin };
}

export const NUDGE_TEXT = {
  banner: "Votre compte contient des données financières et n'est protégé que par un mot de passe.",
  bannerAdmin: "Ce compte administrateur protège toute l'instance, et seul un mot de passe le défend.",
  intro: "Ce compte contient vos données financières. Un mot de passe seul ne suffit pas : s'il est volé ou deviné, n'importe qui peut entrer.",
  introAdmin: "Vous utilisez le compte administrateur : il protège toute l'instance et les données financières qu'elle contient. Un mot de passe seul ne suffit pas : s'il est volé ou deviné, tout le monde en subit les conséquences.",
  how: "Avec la double authentification, il faut aussi un code à 6 chiffres affiché par une application sur votre téléphone. Cela prend deux minutes.",
} as const;

export function cleanAppCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

/** Met le code de secours en forme pendant la saisie : majuscules et tiret au milieu. */
export function cleanRecoveryCode(value: string): string {
  const chars = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return chars.length > 4 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars;
}

export function loginCodeReady(code: string, recovery: boolean): boolean {
  return recovery ? /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) : /^\d{6}$/.test(code);
}

/** Clé en groupes de quatre, plus facile à recopier à la main. */
export function groupKey(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? "";
}

export function recoveryCodesFile(email: string, codes: readonly string[], when: Date): string {
  return [
    "Hamac : codes de secours",
    `Compte : ${email}`,
    `Créés le : ${when.toLocaleDateString("fr-FR")}`,
    "",
    "Chaque code ne sert qu'une seule fois, si vous n'avez plus accès à votre application.",
    "Gardez ce fichier à l'abri, comme un mot de passe.",
    "",
    ...codes,
    "",
  ].join("\n");
}

export function recoveryCodesLeftText(count: number): string {
  if (count === 0) return "Il ne vous reste aucun code de secours : créez-en de nouveaux.";
  return count === 1 ? "Il vous reste 1 code de secours." : `Il vous reste ${count} codes de secours.`;
}
