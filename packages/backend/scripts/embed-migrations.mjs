// Embarque les migrations SQL générées par drizzle-kit dans un module TypeScript,
// pour qu'elles voyagent avec le code (app de bureau empaquetée, serveur) sans fichiers annexes.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const journal = JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8"));
const entries = journal.entries
  .sort((a, b) => a.idx - b.idx)
  .map((e) => ({ tag: e.tag, sql: readFileSync(join(root, "drizzle", `${e.tag}.sql`), "utf8") }));

const out = `// Fichier généré par scripts/embed-migrations.mjs — ne pas modifier à la main.
export const migrations: ReadonlyArray<{ tag: string; sql: string }> = ${JSON.stringify(entries, null, 2)};
`;
writeFileSync(join(root, "src/db/migrations.generated.ts"), out);
console.log(`${entries.length} migration(s) embarquée(s).`);
