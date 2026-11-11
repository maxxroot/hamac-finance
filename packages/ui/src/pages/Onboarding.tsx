import { Building2, Settings, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { AddAccountButton } from "@/components/AccountButtons";
import { Card } from "@/components/ui";
import { useWorkspaceIndex } from "@/lib/workspace";

/** Premier lancement : outil vierge, on construit soi-même son plan en trois étapes. */
export function Onboarding() {
  const idx = useWorkspaceIndex();
  const hasInstitutions = (idx?.ws.institutions.length ?? 0) > 0;
  return (
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="font-display text-[2.4rem] leading-tight font-medium tracking-[-0.01em]">Bienvenue dans Hamac</h1>
      <p className="mt-3 text-fg-muted">
        Hamac part d'une page blanche : vous créez vos établissements et vos comptes, puis vous saisissez ce qui s'y trouve. Tout le reste se calcule. Vos données restent sur cet ordinateur.
      </p>
      <div className="mt-8 space-y-4">
        <Step n={1} icon={<Settings size={18} />} title="Votre profil" text="Préparer votre retraite ou simplement gérer votre patrimoine, puis année de naissance, hypothèses de rendement et allocation cible.">
          <Link to="/parametres" className="text-sm text-accent hover:underline">
            Ouvrir Paramètres › Plan
          </Link>
        </Step>
        <Step n={2} icon={<Building2 size={18} />} title="Vos établissements" text="Banque, courtier, assurance-vie, plateforme crypto : les comptes qu'ils proposent et leurs frais.">
          <Link to="/parametres?onglet=Établissements&nouveau=1" className="text-sm text-accent hover:underline">
            {hasInstitutions ? "Ajouter un autre établissement" : "Ajouter un établissement"}
          </Link>
        </Step>
        <Step n={3} icon={<Wallet size={18} />} title="Vos comptes" text="Chaque livret, contrat ou compte, rattaché à son établissement. Ensuite : vos apports initiaux dans le Journal.">
          <div className="flex flex-wrap gap-2">
            <AddAccountButton kind="livret" label="Livret" variant="secondary" />
            <AddAccountButton kind="assurance_vie" label="Assurance-vie" variant="secondary" />
            <AddAccountButton kind="pea" label="PEA" variant="secondary" />
            <AddAccountButton kind="cto" label="Compte-titres" variant="secondary" />
            <AddAccountButton kind="crypto" label="Plateforme crypto" variant="secondary" />
          </div>
        </Step>
      </div>
    </div>
  );
}

function Step({ n, icon, title, text, children }: { n: number; icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <Card className="flex gap-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">{icon}</div>
      <div className="flex-1">
        <div className="text-xs text-fg-faint">Étape {n}</div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 mb-3 text-sm text-fg-muted">{text}</p>
        {children}
      </div>
    </Card>
  );
}
