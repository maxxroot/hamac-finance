import { describe, expect, it } from "vitest";
import { claudeCodeCommand, jsonConfig, lastUsedText, mcpUrl } from "./assistants";

describe("branchement d'un assistant", () => {
  it("adresse de la route, sans double barre", () => {
    expect(mcpUrl("https://hamac.exemple.fr/")).toBe("https://hamac.exemple.fr/api/mcp");
  });

  it("commande Claude Code et configuration JSON : jeton dans l'en-tête Authorization", () => {
    expect(claudeCodeCommand("https://hamac.exemple.fr", "hamac_abc")).toBe('claude mcp add --transport http hamac https://hamac.exemple.fr/api/mcp --header "Authorization: Bearer hamac_abc"');
    expect(JSON.parse(jsonConfig("https://hamac.exemple.fr", "hamac_abc"))).toEqual({ mcpServers: { hamac: { type: "http", url: "https://hamac.exemple.fr/api/mcp", headers: { Authorization: "Bearer hamac_abc" } } } });
  });

  it("dernière utilisation", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    expect(lastUsedText(null, now)).toBe("jamais utilisé");
    expect(lastUsedText("2026-11-15T08:00:00Z", now)).toBe("utilisé aujourd'hui");
    expect(lastUsedText("2026-11-14T08:00:00Z", now)).toBe("utilisé hier");
    expect(lastUsedText("2026-11-10T08:00:00Z", now)).toBe("utilisé il y a 5 jours");
  });
});
