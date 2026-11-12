import { createInterface } from "node:readline/promises";
import { postgresProvider } from "@hamac/backend";
import { runCommand } from "./cli/commands";
import { databaseUrl } from "./env";
import { UserStore } from "./auth/users";

/**
 * Administration de l'instance :
 *   node cli.mjs invite [jours]        crée un code d'invitation (7 jours par défaut)
 *   node cli.mjs users                 liste les comptes
 *   node cli.mjs password <e-mail>     change le mot de passe d'un compte
 *   node cli.mjs 2fa-reset <e-mail>    désactive la double authentification d'un compte et ferme ses sessions
 */
const store = await UserStore.open(postgresProvider(databaseUrl(process.env)));

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

runCommand(store, process.argv.slice(2), { log: console.log, ask })
  .catch((e: Error) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => void store.close());
