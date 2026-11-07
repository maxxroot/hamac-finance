import { defineConfig } from "tsup";

// Tout le code Node (backend, drizzle, zod) est regroupé dans main.cjs :
// l'app empaquetée n'embarque aucun node_modules.
export default defineConfig({
  entry: { main: "src/main.ts", preload: "src/preload.ts" },
  format: ["cjs"],
  outExtension: () => ({ js: ".cjs" }),
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  external: ["electron"],
  // Tout embarquer sauf « electron », fourni par l'exécutable lui-même.
  noExternal: [/^(?!electron$).*/],
  sourcemap: false,
  // Garder « node:sqlite » tel quel : ce module n'existe pas sans le préfixe node:.
  removeNodeProtocol: false,
});
