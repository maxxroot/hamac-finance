import { serve } from "@hono/node-server";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { postgresProvider, waitForDatabase } from "@hamac/backend";
import { createApp, type SignupMode } from "./app";
import { databaseUrl, intFromEnv } from "./env";

/**
 * Serveur Hamac auto-hébergé.
 * Tous les réglages sont documentés dans .env.example.
 *   DATABASE_URL     connexion PostgreSQL (défaut : base locale, mot de passe HAMAC_DB_PASSWORD ou « hamac »)
 *   HAMAC_DATA_DIR   dossier des copies faites avant une migration (défaut : ./data)
 *   HAMAC_PORT       port d'écoute (défaut : 8080)
 *   HAMAC_SIGNUP     invite (défaut) | open | closed
 *   HAMAC_SECURE     1 pour considérer toute requête comme HTTPS (sinon détecté d'après le proxy de confiance)
 *   HAMAC_ALLOW_HTTP 1 pour autoriser le HTTP simple hors de cette machine (déconseillé)
 *   HAMAC_UI_DIR     dossier de l'interface construite (défaut : ./ui à côté du serveur)
 *   HAMAC_PRICES     0 pour ne pas actualiser les cours automatiquement
 *   HAMAC_TWELVEDATA_KEY          clé Twelve Data (facultative, jamais stockée en base)
 *   HAMAC_TWELVEDATA_DAILY_LIMIT  requêtes Twelve Data par jour selon l'offre (défaut : 800)
 *   HAMAC_REFRESH_MINUTES         minutes entre deux actualisations des cours, 10 au minimum (défaut : 30)
 *   HAMAC_SESSION_DAYS            durée d'une session en jours (défaut : 30)
 */
const here = dirname(fileURLToPath(import.meta.url));
const signup = (process.env.HAMAC_SIGNUP ?? "invite") as SignupMode;
if (!["invite", "open", "closed"].includes(signup)) throw new Error("HAMAC_SIGNUP doit valoir invite, open ou closed.");

const allowHttp = process.env.HAMAC_ALLOW_HTTP === "1";
if (allowHttp) console.warn("[hamac] HAMAC_ALLOW_HTTP=1 : hors HTTPS, mots de passe et sessions circulent en clair sur le réseau.");

const market = {
  twelveDataKey: process.env.HAMAC_TWELVEDATA_KEY?.trim() || null,
  twelveDataDailyLimit: intFromEnv(process.env, "HAMAC_TWELVEDATA_DAILY_LIMIT", 800, 1),
  // En dessous, une même source ne serait de toute façon pas réinterrogée.
  refreshMinutes: intFromEnv(process.env, "HAMAC_REFRESH_MINUTES", 30, 10),
};
const sessionDays = intFromEnv(process.env, "HAMAC_SESSION_DAYS", 30, 1);

const provider = postgresProvider(databaseUrl(process.env));
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
  allowHttp,
  trustProxy: process.env.HAMAC_TRUST_PROXY === "1",
  staticDir: process.env.HAMAC_UI_DIR ?? join(here, "ui"),
  appVersion: process.env.npm_package_version ?? "0.1.0",
  autoRefreshPrices: process.env.HAMAC_PRICES !== "0",
  market,
  sessionDays,
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
