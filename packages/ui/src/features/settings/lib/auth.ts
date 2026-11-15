import type { ApiToken, TokenScope } from "./assistants";

/** Authentification du mode web (le bureau n'en a pas besoin). */
export class AuthError extends Error {
  constructor(
    message: string,
    /** La connexion doit reprendre au mot de passe. */
    readonly restart = false,
  ) {
    super(message);
  }
}

async function post<T = { email?: string }>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Hamac": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; restart?: boolean };
  if (!res.ok) throw new AuthError(json.error ?? `Erreur ${res.status}`, json.restart === true);
  return json;
}

export interface TwoFactorStatus {
  enabled: boolean;
  /** Faux si la clé de sécurité du serveur est absente ou invalide. */
  available: boolean;
  recoveryCodesLeft: number;
}

export interface Me {
  email: string;
  isAdmin: boolean;
  twoFactor: TwoFactorStatus;
}

/** Soit la session est ouverte, soit il reste à saisir un code. */
export type LoginResult = { email: string; challenge?: undefined } | { twoFactor: true; challenge: string; email?: undefined };

export const auth = {
  async me(): Promise<Me | null> {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  },
  async config(): Promise<{ signup: "invite" | "open" | "closed"; firstUser: boolean }> {
    return (await fetch("/api/auth/config")).json();
  },
  login: (email: string, password: string) => post<LoginResult>("/api/auth/login", { email, password }),
  submitCode: (challenge: string, code: string, recovery: boolean) => post<{ email: string }>("/api/auth/login/code", { challenge, code, recovery }),
  signup: (email: string, password: string, invite?: string) => post("/api/auth/signup", { email, password, invite }),
  logout: () => post("/api/auth/logout"),
  changePassword: (current: string, next: string) => post("/api/auth/password", { current, next }),
  tokens: {
    async list(): Promise<{ enabled: boolean; tokens: ApiToken[] }> {
      const res = await fetch("/api/auth/tokens", { credentials: "include" });
      if (!res.ok) throw new AuthError("Impossible de lire les jetons d'accès.");
      return (await res.json()) as { enabled: boolean; tokens: ApiToken[] };
    },
    create: (name: string, scope: TokenScope, days: number, password: string) => post<ApiToken & { token: string }>("/api/auth/tokens", { name, scope, days, password }),
    revoke: (id: string) => post<{ ok: true }>("/api/auth/tokens/revoke", { id }),
  },
  twoFactor: {
    setup: (password: string) => post<{ secret: string; uri: string }>("/api/auth/2fa/setup", { password }),
    confirm: (code: string) => post<{ recoveryCodes: string[] }>("/api/auth/2fa/confirm", { code }),
    disable: (password: string, code: string) => post("/api/auth/2fa/disable", { password, code }),
    regenerate: (password: string, code: string) => post<{ recoveryCodes: string[] }>("/api/auth/2fa/recovery-codes", { password, code }),
  },
};
