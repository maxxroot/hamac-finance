import type { UserStore } from "./users";

export interface CliIo {
  log: (line: string) => void;
  ask: (question: string) => Promise<string>;
}

export async function runCommand(store: UserStore, [cmd, arg]: string[], io: CliIo): Promise<void> {
  const account = async () => {
    const user = arg ? await store.findByEmail(arg) : null;
    if (!user) throw new Error("Compte introuvable.");
    return user;
  };
  switch (cmd) {
    case "invite": {
      const days = Number(arg ?? 7);
      io.log(`Code d'invitation (valable ${days} jours) : ${await store.createInvite(days)}`);
      break;
    }
    case "users":
      for (const u of await store.list()) io.log(`${u.email}\tcréé le ${u.createdAt.slice(0, 10)}`);
      break;
    case "password": {
      const user = await account();
      const pwd = await io.ask("Nouveau mot de passe (10 caractères minimum) : ");
      if (pwd.length < 10) throw new Error("Mot de passe trop court.");
      await store.setPassword(user.id, pwd);
      io.log("Mot de passe changé ; les sessions ouvertes ont été fermées.");
      break;
    }
    case "2fa-reset": {
      const user = await account();
      const wasActive = await store.resetTwoFactor(user.id);
      io.log(`${wasActive ? "Double authentification désactivée" : "La double authentification n'était pas active"} pour ${user.email} ; les sessions ouvertes ont été fermées.`);
      break;
    }
    default:
      io.log("Commandes : invite [jours] · users · password <e-mail> · 2fa-reset <e-mail>");
  }
}
