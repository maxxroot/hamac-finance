// Copie l'interface construite (packages/ui/dist) dans apps/desktop/renderer pour l'empaquetage.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "../../../packages/ui/dist");
const dst = join(here, "../renderer");
if (!existsSync(src)) throw new Error("Interface non construite : lancez d'abord `pnpm --filter @hamac/ui build`.");
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log("Interface copiée dans apps/desktop/renderer");
