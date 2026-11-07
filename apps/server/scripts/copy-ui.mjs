// Copie l'interface construite (packages/ui/dist) dans apps/server/dist/ui.
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "../../../packages/ui/dist");
const dst = join(here, "../dist/ui");
if (!existsSync(src)) throw new Error("Interface non construite : lancez d'abord `pnpm --filter @hamac/ui build`.");
cpSync(src, dst, { recursive: true });
console.log("Interface copiée dans apps/server/dist/ui");
