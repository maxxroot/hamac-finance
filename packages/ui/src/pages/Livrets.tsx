import { LIVRET_LABELS } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Movements } from "@/components/Movements";
import { Pct, Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { PageHeader } from "@/components/ui";
import { LivretsStatus } from "@/pages/Synthese";
import { Onboarding } from "@/pages/Onboarding";
import { cn } from "@/lib/cn";
import { usePortfolio } from "@/lib/portfolio";

export function Livrets() {
  const pf = usePortfolio();
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const livrets = pf.state.accounts.filter((a) => a.account.kind === "livret" && !a.account.archived);
  const total = livrets.reduce((s, a) => s + a.value, 0);
  const interest = livrets.reduce((s, a) => s + a.value * (a.account.rate ?? 0), 0);
  const avgRate = total > 0 ? interest / total : null;
  const order = [...livrets].sort((a, b) => a.account.sortOrder - b.account.sortOrder).map((a) => `${a.account.name}${a.account.depositCeiling ? ` (${a.account.depositCeiling.toLocaleString("fr-FR")} €)` : ""}`);

  return (
    <>
      <PageHeader title="Livrets" description="Épargne de précaution. Tout se saisit dans le journal ; ici on règle l'établissement, le taux et le plafond (Paramètres › Comptes)." />
      <StatGrid>
        <Stat label="Total des livrets">
          <Amount value={total} compact />
        </Stat>
        <Stat label="Fourchette du plan" sub="Plancher – plafond (Paramètres › Plan)">
          <span className="text-base">
            <Amount value={pf.state.livrets.floor} compact /> – <Amount value={pf.state.livrets.ceiling} compact />
          </span>
        </Stat>
        <Stat label="Taux moyen pondéré">
          <Pct value={avgRate} />
        </Stat>
        <Stat label="Intérêts estimés sur 1 an">
          <Amount value={interest} compact />
        </Stat>
      </StatGrid>
      <div className="mb-6">
        <LivretsStatus />
      </div>

      <Table className="mb-2">
        <thead>
          <tr>
            <Th>Livret</Th>
            <Th>Établissement</Th>
            <Th align="right">Taux</Th>
            <Th align="right">Plafond</Th>
            <Th align="right">Versement mensuel</Th>
            <Th align="right">Solde</Th>
            <Th align="right">Marge avant plafond</Th>
            <Th align="right">Intérêts / an</Th>
            <Th align="right">Versé net</Th>
            <Th align="right">Intérêts encaissés</Th>
          </tr>
        </thead>
        <tbody>
          {livrets.length === 0 && <EmptyRow cols={10}>Aucun livret : ajoutez-en dans Paramètres › Comptes.</EmptyRow>}
          {livrets.map((a) => {
            const margin = a.account.depositCeiling != null ? a.account.depositCeiling - a.value : null;
            return (
              <Tr key={a.account.id}>
                <Td className="font-medium">
                  {a.account.name}
                  {a.account.livretType && a.account.livretType !== "AUTRE" && a.account.name !== LIVRET_LABELS[a.account.livretType] && <span className="text-fg-muted"> · {LIVRET_LABELS[a.account.livretType]}</span>}
                  {a.account.role && <div className="text-xs font-normal text-fg-faint">{a.account.role}</div>}
                </Td>
                <Td className="text-fg-muted">{(a.account.institutionId && pf.idx.institutionById.get(a.account.institutionId)?.name) || "—"}</Td>
                <Td align="right">
                  <Pct value={a.account.rate} />
                </Td>
                <Td align="right">
                  <Amount value={a.account.depositCeiling} compact />
                </Td>
                <Td align="right">
                  <Amount value={a.currentMonthly} compact />
                </Td>
                <Td align="right" className="font-medium">
                  <Amount value={a.value} />
                </Td>
                <Td align="right" className={cn(margin != null && margin < 0 && "text-negative")} title={margin != null && margin < 0 ? "Au-delà du plafond de dépôt (les intérêts capitalisés peuvent légalement le dépasser)" : undefined}>
                  <Amount value={margin} compact />
                </Td>
                <Td align="right">
                  <Amount value={a.value * (a.account.rate ?? 0)} compact />
                </Td>
                <Td align="right">
                  <Amount value={a.netContrib} />
                </Td>
                <Td align="right">
                  <Amount value={a.interests} />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      {order.length > 1 && <p className="mb-6 text-xs text-fg-faint">Ordre de remplissage : {order.join(" → ")}.</p>}
      <Movements accountIds={livrets.map((a) => a.account.id)} />
    </>
  );
}
