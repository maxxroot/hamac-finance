// Lance Electron en retirant ELECTRON_RUN_AS_NODE, que le terminal intégré de VS Code
// (lui-même une app Electron) transmet à ses enfants : sans ça, Electron démarrerait
// en simple Node et l'API `electron` serait introuvable.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const electronPath = createRequire(import.meta.url)("electron");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [".", ...process.argv.slice(2)], { stdio: "inherit", env });
child.on("close", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
