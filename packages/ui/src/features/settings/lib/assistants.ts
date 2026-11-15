/** Assistants (MCP) : textes et commandes de branchement de la carte Paramètres › Application. */

export type TokenScope = "read" | "write";

export interface ApiToken {
  id: string;
  name: string;
  scope: TokenScope;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

export const SCOPE_LABELS: Record<TokenScope, string> = {
  read: "Lecture seule",
  write: "Lecture et écriture",
};

export const SCOPE_HELP: Record<TokenScope, string> = {
  read: "L'assistant consulte vos comptes, vos opérations et les contrôles de Hamac. Il ne peut rien modifier.",
  write: "L'assistant peut aussi créer et modifier vos établissements, comptes, titres et opérations, importer des relevés et supprimer, toujours après votre accord.",
};

export const TOKEN_DAYS = [30, 90, 365] as const;

export const DAYS_LABELS: Record<(typeof TOKEN_DAYS)[number], string> = { 30: "30 jours", 90: "90 jours", 365: "1 an" };

/** Adresse de la route MCP de cette instance. */
export const mcpUrl = (origin: string): string => `${origin.replace(/\/+$/, "")}/api/mcp`;

/** Commande Claude Code : le jeton va dans un en-tête, jamais dans l'adresse. */
export function claudeCodeCommand(origin: string, token: string): string {
  return `claude mcp add --transport http hamac ${mcpUrl(origin)} --header "Authorization: Bearer ${token}"`;
}

/** Configuration JSON commune aux clients qui lisent un fichier `mcpServers` (Claude Desktop via un pont, Cursor…). */
export function jsonConfig(origin: string, token: string): string {
  return JSON.stringify({ mcpServers: { hamac: { type: "http", url: mcpUrl(origin), headers: { Authorization: `Bearer ${token}` } } } }, null, 2);
}

/** « jamais », « aujourd'hui », « il y a 3 jours »… sur la date de dernière utilisation. */
export function lastUsedText(iso: string | null, now = new Date()): string {
  if (!iso) return "jamais utilisé";
  const days = Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "utilisé aujourd'hui";
  if (days === 1) return "utilisé hier";
  return `utilisé il y a ${days} jours`;
}
