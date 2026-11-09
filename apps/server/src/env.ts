type Env = Record<string, string | undefined>;

/** Entier lu dans l'environnement. Vide : valeur par défaut ; invalide : le serveur refuse de démarrer. */
export function intFromEnv(env: Env, name: string, fallback: number, min: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) throw new Error(`${name} doit être un nombre entier, ${min} au minimum.`);
  return value;
}

/** Connexion PostgreSQL : DATABASE_URL, sinon la base locale avec le mot de passe du .env. */
export function databaseUrl(env: Env): string {
  return env.DATABASE_URL?.trim() || `postgres://hamac:${encodeURIComponent(env.HAMAC_DB_PASSWORD?.trim() || "hamac")}@localhost:5432/hamac`;
}
