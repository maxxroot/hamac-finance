// Lance Electron en retirant ELECTRON_RUN_AS_NODE, que le terminal intégré de VS Code
// (lui-même une app Electron) transmet à ses enfants : sans ça, Electron démarrerait
// en simple Node et l'API `electron` serait introuvable.
//
// Option --watch (développement) : redémarre Electron quand le processus principal
// (dist/main.cjs, recompilé par `tsup --watch`) change, pour que le backend suive le code.
import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const electronPath = createRequire(import.meta.url)("electron");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const watchMode = process.argv.includes("--watch");
const args = process.argv.slice(2).filter((a) => a !== "--watch");
const dist = join(dirname(fileURLToPath(import.meta.url)), "../dist");

let child = null;
let restarting = false;

function start() {
  child = spawn(electronPath, [".", ...args], { stdio: "inherit", env });
  child.on("close", (code) => {
    if (restarting) {
      restarting = false;
      start();
    } else process.exit(code ?? 0);
  });
}

start();

if (watchMode) {
  let timer = null;
  watch(dist, (_event, file) => {
    if (!file || !/^(main|preload)\.cjs$/.test(file)) return;
    clearTimeout(timer);
    // On attend que tsup ait fini d'écrire les deux fichiers.
    timer = setTimeout(() => {
      if (!existsSync(join(dist, "main.cjs")) || !existsSync(join(dist, "preload.cjs"))) return;
      console.log("\n[hamac] Backend modifié : redémarrage d'Electron…\n");
      restarting = true;
      child?.kill();
    }, 500);
  });
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child?.kill(sig));
