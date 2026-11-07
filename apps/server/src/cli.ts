import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { UserStore } from "./users";

/**
 * Administration de l'instance :
 *   node cli.mjs invite [jours]        crée un code d'invitation (7 jours par défaut)
 *   node cli.mjs users                 liste les comptes
 *   node cli.mjs password <e-mail>     change le mot de passe d'un compte
 */
const store = new UserStore(join(process.env.HAMAC_DATA_DIR ?? join(process.cwd(), "data"), "comptes.sqlite"));
const [cmd, arg] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case "invite": {
      const days = Number(arg ?? 7);
      console.log(`Code d'invitation (valable ${days} jours) : ${store.createInvite(days)}`);
      break;
    }
    case "users":
      for (const u of store.list()) console.log(`${u.email}\tcréé le ${u.createdAt.slice(0, 10)}`);
      break;
    case "password": {
      const user = arg ? store.findByEmail(arg) : null;
      if (!user) throw new Error("Compte introuvable.");
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const pwd = await rl.question("Nouveau mot de passe (10 caractères minimum) : ");
      rl.close();
      if (pwd.length < 10) throw new Error("Mot de passe trop court.");
      store.setPassword(user.id, pwd);
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
  .finally(() => store.close());
