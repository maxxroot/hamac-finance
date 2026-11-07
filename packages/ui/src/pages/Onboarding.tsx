import { Sparkles, Wrench } from "lucide-react";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { AccountDialog } from "@/dialogs/AccountDialog";
import { useMutate } from "@/lib/workspace";

/** Premier lancement : base vide. */
export function Onboarding() {
  const starter = useMutate("workspace.createStarter", { success: "Structure créée : il ne reste qu'à saisir vos apports." });
  const [manual, setManual] = useState(false);
  return (
    <div className="mx-auto max-w-3xl py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Bienvenue dans Hamac</h1>
      <p className="mt-3 text-fg-muted">
        Hamac suit votre plan d'épargne retraite : livrets de précaution, fonds euros, obligations, actions et crypto, avec la fiscalité française. Vos données restent sur cet
        ordinateur.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <Sparkles className="text-accent" />
          <div>
            <h2 className="font-semibold">Structure type du plan</h2>
            <p className="mt-1 text-sm text-fg-muted">LEP, LDDS, Livret A, assurance-vie, compte-titres, PEA et crypto, avec leurs plafonds. Vous ajusterez ensuite.</p>
          </div>
          <Button variant="primary" className="mt-auto" onClick={() => starter.mutate(undefined as never)} disabled={starter.isPending}>
            Créer la structure type
          </Button>
        </Card>
        <Card className="flex flex-col gap-4">
          <Wrench className="text-fg-muted" />
          <div>
            <h2 className="font-semibold">Je crée mes comptes</h2>
            <p className="mt-1 text-sm text-fg-muted">Commencez par un premier compte ; les autres s'ajoutent dans Paramètres › Comptes.</p>
          </div>
          <Button className="mt-auto" onClick={() => setManual(true)}>
            Ajouter un compte
          </Button>
        </Card>
      </div>
      <p className="mt-6 text-sm text-fg-faint">Pensez à renseigner votre année de naissance et votre âge de départ dans Paramètres › Plan.</p>
      <AccountDialog open={manual} onClose={() => setManual(false)} />
    </div>
  );
}
