import type { Context, Hono } from "hono";
import type { Backend } from "@hamac/backend";
import { TOKEN_DAYS, TOKEN_SCOPES, type TokenScope } from "../auth/apiTokens";
import type { User, UserStore } from "../auth/users";
import { DraftStore } from "../mcp/drafts";
import { handleMcpRequest } from "../mcp/endpoint";
import { callThrough } from "../mcp/engine";

/**
 * Assistants (MCP) : création et révocation des jetons d'accès depuis une session, et la route `/api/mcp`
 * ouverte par ces jetons. Voir docs/assistants-mcp/technique.md et la décision 0009.
 */

export interface McpRoutesDeps {
  enabled: boolean;
  users: UserStore;
  backendFor: (user: User) => Promise<Backend>;
  currentUser: (c: Context) => Promise<User | null>;
  csrfOk: (c: Context) => boolean;
  unauthorized: (c: Context) => Response;
  /** Limiteur des actions sensibles du compte, partagé avec le reste de l'authentification. */
  allow: (key: string) => boolean;
  appVersion: string;
}

/** Requêtes par minute et par jeton : une conversation en fait rarement plus d'une par seconde. */
const PER_MINUTE = 120;
const DISABLED = "Les assistants (MCP) sont désactivés sur cette instance.";

export function mountMcpRoutes(app: Hono, deps: McpRoutesDeps): void {
  const { users } = deps;
  const drafts = new DraftStore();
  const hits = new Map<string, { n: number; reset: number }>();
  const allowCall = (tokenId: string): boolean => {
    const now = Date.now();
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    const h = hits.get(tokenId);
    if (!h || h.reset < now) hits.set(tokenId, { n: 1, reset: now + 60_000 });
    else if (++h.n > PER_MINUTE) return false;
    return true;
  };

  app.get("/api/auth/tokens", async (c) => {
    const user = await deps.currentUser(c);
    if (!user) return deps.unauthorized(c);
    return c.json({ enabled: deps.enabled, tokens: deps.enabled ? await users.tokens.list(user.id) : [] });
  });

  app.post("/api/auth/tokens", async (c) => {
    if (!deps.csrfOk(c)) return c.json({ error: "Requête refusée." }, 403);
    if (!deps.enabled) return c.json({ error: DISABLED }, 403);
    const user = await deps.currentUser(c);
    if (!user) return deps.unauthorized(c);
    if (!deps.allow(`tokens:${user.id}`)) return c.json({ error: "Trop de tentatives : réessayez dans 15 minutes." }, 429);
    const body = (await c.req.json().catch(() => ({}))) as { name?: unknown; scope?: unknown; days?: unknown; password?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const scope = TOKEN_SCOPES.find((s) => s === body.scope);
    const days = TOKEN_DAYS.find((d) => d === body.days);
    if (!name) return c.json({ error: "Donnez un nom au jeton, par exemple celui de l'assistant ou de l'appareil." }, 400);
    if (!scope || !days) return c.json({ error: "Portée ou durée invalide." }, 400);
    // Un jeton vaut une session de longue durée : on redemande le mot de passe, comme pour la double authentification.
    if (!(await users.checkPassword(await users.findById(user.id), typeof body.password === "string" ? body.password : ""))) return c.json({ error: "Mot de passe incorrect." }, 400);
    const created = await users.tokens.create(user.id, name, scope as TokenScope, days);
    if (!created) return c.json({ error: "Nombre maximal de jetons atteint : révoquez-en un d'abord." }, 409);
    return c.json({ token: created.token, ...created.info });
  });

  app.post("/api/auth/tokens/revoke", async (c) => {
    if (!deps.csrfOk(c)) return c.json({ error: "Requête refusée." }, 403);
    const user = await deps.currentUser(c);
    if (!user) return deps.unauthorized(c);
    const body = (await c.req.json().catch(() => ({}))) as { id?: unknown };
    const ok = typeof body.id === "string" && (await users.tokens.revoke(user.id, body.id));
    return ok ? c.json({ ok: true }) : c.json({ error: "Jeton introuvable." }, 404);
  });

  // Jeton dans l'en-tête Authorization seulement : aucun cookie n'est lu, donc aucune requête intersite ne passe.
  app.all("/api/mcp", async (c) => {
    if (!deps.enabled) return c.json({ error: DISABLED }, 404);
    if (c.req.method !== "POST") return c.body(null, 405, { Allow: "POST" });
    const origin = c.req.header("origin");
    // Un navigateur annonce toujours son origine : une page d'un autre site ne doit pas pouvoir appeler la route.
    if (origin && hostOf(origin) !== new URL(c.req.url).host) return c.json({ error: "Origine refusée." }, 403);
    const bearer = /^Bearer\s+(\S+)$/i.exec(c.req.header("authorization") ?? "")?.[1];
    const access = bearer ? await users.tokens.resolve(bearer) : null;
    if (!access) return c.json({ error: "Jeton d'accès absent, expiré ou révoqué." }, 401, { "WWW-Authenticate": 'Bearer realm="hamac"' });
    if (!allowCall(access.tokenId)) return c.json({ error: "Trop de requêtes : réessayez dans une minute." }, 429);
    const backend = await deps.backendFor(access.user);
    return handleMcpRequest(c.req.raw, { call: callThrough((name, input) => backend.dispatch(name, input)), scope: access.scope, tenantId: access.user.tenantId, drafts, appVersion: deps.appVersion });
  });
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}
