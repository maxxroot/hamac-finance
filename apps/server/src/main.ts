import { serve } from "@hono/node-server";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { postgresProvider, waitForDatabase } from "@hamac/backend";
import { createApp, type SignupMode } from "./app";

/**
 * Serveur Hamac auto-hébergé.
 *   DATABASE_URL     connexion PostgreSQL (défaut : postgres://hamac:hamac@localhost:5432/hamac)
 *   HAMAC_DATA_DIR   dossier des sauvegardes (défaut : ./data)
 *   HAMAC_PORT       port d'écoute (défaut : 8080)
 *   HAMAC_SIGNUP     invite (défaut) | open | closed
 *   HAMAC_SECURE     1 si le serveur est derrière HTTPS (cookies « Secure »)
 *   HAMAC_UI_DIR     dossier de l'interface construite (défaut : ./ui à côté du serveur)
 */
const here = dirname(fileURLToPath(import.meta.url));
const signup = (process.env.HAMAC_SIGNUP ?? "invite") as SignupMode;
if (!["invite", "open", "closed"].includes(signup)) throw new Error("HAMAC_SIGNUP doit valoir invite, open ou closed.");

if (process.env.HAMAC_SECURE !== "1") console.warn("[hamac] Cookies non sécurisés : placez un proxy HTTPS devant le serveur et activez HAMAC_SECURE=1.");

const provider = postgresProvider(process.env.DATABASE_URL ?? "postgres://hamac:hamac@localhost:5432/hamac");
await waitForDatabase(provider);

const { app, close } = await createApp({
  provider,
  // Sans sa connexion d'administration, l'instance ne peut plus rien faire : Docker la relance.
  onAdminLost: () => {
    console.error("[hamac] connexion à PostgreSQL perdue : arrêt.");
    process.exit(1);
  },
  dataDir: process.env.HAMAC_DATA_DIR ?? join(process.cwd(), "data"),
  signup,
  secureCookies: process.env.HAMAC_SECURE === "1",
  trustProxy: process.env.HAMAC_TRUST_PROXY === "1",
  staticDir: process.env.HAMAC_UI_DIR ?? join(here, "ui"),
  appVersion: process.env.npm_package_version ?? "0.1.0",
  autoRefreshPrices: process.env.HAMAC_PRICES !== "0",
});

const port = Number(process.env.HAMAC_PORT ?? 8080);
const server = serve({ fetch: app.fetch, port, hostname: process.env.HAMAC_HOST ?? "0.0.0.0" }, (info) => {
  console.log(`Hamac écoute sur http://localhost:${info.port} (inscriptions : ${signup})`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    server.close();
    process.removeAllListeners(sig);
    void close().finally(() => process.exit(0));
  });
}
