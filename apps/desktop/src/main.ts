import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { IPC_CHANNEL } from "@hamac/api";
import { createBackend, seedDemo, type Backend } from "@hamac/backend";

const DEV_URL = process.env.HAMAC_DEV_URL;
let backend: Backend | null = null;

// Outils de développement / CI :
//  HAMAC_DATA_DIR    → dossier de données isolé (ne touche pas aux vraies données)
//  HAMAC_SMOKE_SHOT  → capture la fenêtre en PNG à ce chemin puis quitte (test de fumée)
//  HAMAC_SMOKE_ROUTE → page à afficher avant la capture (ex. "/parametres")
//  HAMAC_DEMO=1      → remplit une base vide avec un jeu de données fictif
if (process.env.HAMAC_DATA_DIR) app.setPath("userData", process.env.HAMAC_DATA_DIR);
const SMOKE_SHOT = process.env.HAMAC_SMOKE_SHOT;
const SMOKE_ROUTE = process.env.HAMAC_SMOKE_ROUTE ?? "/";

// Une seule instance : deux processus sur le même fichier SQLite, c'est la corruption assurée.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  void app.whenReady().then(start);
}

async function start() {
  const dataDir = app.getPath("userData");
  backend = createBackend({
    databasePath: join(dataDir, "hamac.sqlite"),
    backupsDir: join(dataDir, "sauvegardes"),
    autoRefreshPrices: !SMOKE_SHOT,
    mode: "desktop",
    appVersion: app.getVersion(),
  });

  ipcMain.handle(IPC_CHANNEL, (event, name: unknown, input: unknown) => {
    if (!isTrustedSender(event.senderFrame?.url)) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Origine non autorisée" } };
    }
    return backend!.dispatch(String(name), input);
  });

  if (process.env.HAMAC_DEMO === "1") await seedDemo(backend);

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "Hamac",
    backgroundColor: "#0b0c10",
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Liens externes : navigateur du système ; aucune navigation hors de l'app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!isTrustedSender(url)) e.preventDefault();
  });

  const hash = SMOKE_SHOT ? SMOKE_ROUTE : "/";
  if (DEV_URL) {
    void win.loadURL(`${DEV_URL}#${hash}`);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"), { hash });
  }

  if (SMOKE_SHOT) {
    win.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        const image = await win.webContents.capturePage();
        const { writeFileSync } = await import("node:fs");
        writeFileSync(SMOKE_SHOT, image.toPNG());
        app.quit();
      }, 1500);
    });
  }
}

function isTrustedSender(url: string | undefined): boolean {
  if (!url) return false;
  if (DEV_URL) return url.startsWith(DEV_URL);
  return url.startsWith("file://");
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  backend?.close();
  backend = null;
});
