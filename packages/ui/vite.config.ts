import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // En développement, l'API est servie par apps/server.
  server: { port: 5173, strictPort: true, proxy: { "/api": "http://localhost:8080" } },
  build: { target: "es2022", outDir: "dist", emptyOutDir: true },
});
