/**
 * Seule la page de l'application a le droit de naviguer et d'appeler le backend.
 * Tout autre fichier local (HTML déposé sur la fenêtre, par exemple) est refusé.
 */
export function isTrustedUrl(url: string | undefined, rendererUrl: string, devUrl?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (devUrl) return parsed.origin === new URL(devUrl).origin;
    const expected = new URL(rendererUrl);
    return parsed.protocol === expected.protocol && parsed.host === expected.host && parsed.pathname === expected.pathname;
  } catch {
    return false;
  }
}
