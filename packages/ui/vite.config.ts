import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Seul le port est lu dans le .env : aucun autre réglage du serveur n'approche l'interface.
  const port = loadEnv(mode, fileURLToPath(new URL("../..", import.meta.url)), "HAMAC_PORT").HAMAC_PORT || "8080";
  return {
    plugins: [react(), tailwindcss()],
    base: "./",
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    // En développement, l'API est servie par apps/server.
    server: { port: 5173, strictPort: true, proxy: { "/api": `http://localhost:${port}` } },
    build: { target: "es2022", outDir: "dist", emptyOutDir: true },
  };
});
