import { defineConfig } from "tsup";

// Un seul fichier par point d'entrée, dépendances incluses : l'image Docker n'a besoin que de Node.
export default defineConfig({
  entry: { server: "src/main.ts", cli: "src/cli.ts" },
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  noExternal: [/.*/],
  // Garder « node:sqlite » tel quel : ce module n'existe pas sans le préfixe node:.
  removeNodeProtocol: false,
});
