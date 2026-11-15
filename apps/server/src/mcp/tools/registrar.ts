import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { ToolError } from "../engine";

/**
 * Déclaration d'un outil : le résultat est renvoyé en JSON compact, une `ToolError` devient une erreur d'outil
 * lisible par le modèle, toute autre erreur reste dans les journaux du serveur.
 */

export interface ToolConfig<S extends z.ZodRawShape> {
  title: string;
  description: string;
  inputSchema: S;
  annotations: ToolAnnotations;
}

export type ToolRegistrar = <S extends z.ZodRawShape>(name: string, config: ToolConfig<S>, run: (args: z.output<z.ZodObject<S>>) => Promise<unknown>) => void;

const text = (value: string, isError = false): CallToolResult => ({ content: [{ type: "text", text: value }], ...(isError ? { isError } : {}) });

export function registrar(server: McpServer): ToolRegistrar {
  // Le SDK valide les arguments avec le schéma avant d'appeler l'outil : `args` a déjà ses valeurs par défaut.
  const register = server.registerTool.bind(server) as unknown as (name: string, config: ToolConfig<z.ZodRawShape>, cb: (args: unknown) => Promise<CallToolResult>) => void;
  return (name, config, run) =>
    register(name, config, async (args) => {
      try {
        return text(JSON.stringify(await run(args as never)));
      } catch (err) {
        if (err instanceof ToolError) return text(err.message, true);
        console.error(`[hamac] outil MCP ${name} :`, err);
        return text("Erreur interne du serveur Hamac.", true);
      }
    });
}
