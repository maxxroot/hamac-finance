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
  // pg-native est facultatif et absent de l'image.
  external: ["pg-native"],
  // Les dépendances CommonJS (pg) appellent require sur les modules de Node : rétabli dans le module ESM.
  banner: { js: "import { createRequire as __hamacRequire } from 'node:module'; const require = __hamacRequire(import.meta.url);" },
  removeNodeProtocol: false,
});
