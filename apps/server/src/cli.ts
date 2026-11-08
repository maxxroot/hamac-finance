import { createInterface } from "node:readline/promises";
import { postgresProvider } from "@hamac/backend";
import { UserStore } from "./users";

/**
 * Administration de l'instance :
 *   node cli.mjs invite [jours]        crée un code d'invitation (7 jours par défaut)
 *   node cli.mjs users                 liste les comptes
 *   node cli.mjs password <e-mail>     change le mot de passe d'un compte
 */
const store = await UserStore.open(postgresProvider(process.env.DATABASE_URL ?? "postgres://hamac:hamac@localhost:5432/hamac"));
const [cmd, arg] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case "invite": {
      const days = Number(arg ?? 7);
      console.log(`Code d'invitation (valable ${days} jours) : ${await store.createInvite(days)}`);
      break;
    }
    case "users":
      for (const u of await store.list()) console.log(`${u.email}\tcréé le ${u.createdAt.slice(0, 10)}`);
      break;
    case "password": {
      const user = arg ? await store.findByEmail(arg) : null;
      if (!user) throw new Error("Compte introuvable.");
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const pwd = await rl.question("Nouveau mot de passe (10 caractères minimum) : ");
      rl.close();
      if (pwd.length < 10) throw new Error("Mot de passe trop court.");
      await store.setPassword(user.id, pwd);
      console.log("Mot de passe changé ; les sessions ouvertes ont été fermées.");
      break;
    }
    default:
      console.log("Commandes : invite [jours] · users · password <e-mail>");
  }
}

main()
  .catch((e: Error) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => void store.close());
