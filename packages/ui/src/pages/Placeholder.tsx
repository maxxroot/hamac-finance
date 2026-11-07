import { Construction } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import type { NavItem } from "@/nav";

const STEPS: Record<number, string> = {
  2: "Étape 2 · Saisie",
  3: "Étape 3 · Calculs",
  4: "Étape 4 · Vues et cours en direct",
  5: "Étape 5 · Contenu et réglages",
};

export function Placeholder({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader title={item.label} description={item.description} />
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <Construction className="text-fg-faint" size={28} strokeWidth={1.6} />
        <p className="text-fg-muted">Cette section arrive bientôt.</p>
        <div className="flex gap-2">
          <Badge tone="accent">{STEPS[item.step]}</Badge>
          <Badge>Onglet du sheet : {item.sheetTab}</Badge>
        </div>
      </Card>
    </>
  );
}
