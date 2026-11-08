import { Plus } from "lucide-react";
import { useState } from "react";
import { PROPERTY_KIND_LABELS, formatPct, propertyValue, type Property } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { RowActions } from "@/components/RowActions";
import { Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { PropertyDialog } from "@/dialogs/PropertyDialog";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

/** Biens immobiliers et SCPI. */
export function Immobilier() {
  const pf = usePortfolio();
  const del = useMutate("properties.delete", { success: "Bien supprimé" });
  const [editing, setEditing] = useState<Property | "new" | null>(null);
  if (!pf) return null;
  const properties = pf.idx.ws.properties;
  const scpi = pf.state.accounts.flatMap((a) => a.positions.filter((p) => p.asset.kind === "scpi").map((p) => ({ account: a.account, position: p })));
  const scpiValue = scpi.reduce((s, x) => s + x.position.value, 0);

  return (
    <>
      <PageHeader
        title="Immobilier"
        description="Vos biens et vos SCPI. Ils restent hors allocation cible, sauf choix contraire."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Nouveau bien
          </Button>
        }
      />

      <StatGrid>
        <Stat label="Biens immobiliers" sub="part détenue">
          <span className="text-2xl">
            <Amount value={pf.state.netWorth.realEstate} compact />
          </span>
        </Stat>
        <Stat label="SCPI" sub="dans le patrimoine financier">
          <Amount value={scpiValue} compact />
        </Stat>
      </StatGrid>

      <div className="space-y-5">
        <Card>
          <CardTitle>Biens</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Bien</Th>
                <Th align="right">Valeur</Th>
                <Th align="right">Part</Th>
                <Th align="right">Valeur détenue</Th>
                <Th>Allocation</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {properties.length === 0 && <EmptyRow cols={6}>Aucun bien. Ajoutez votre résidence ou un investissement locatif.</EmptyRow>}
              {properties.map((p) => (
                <Tr key={p.id} className={cn("group", p.archived && "opacity-50")}>
                  <Td className="font-medium">
                    {p.name}
                    <div className="text-xs font-normal text-fg-faint">
                      {PROPERTY_KIND_LABELS[p.kind]}
                      {p.valueDate ? ` · estimé le ${formatDate(p.valueDate)}` : ""}
                    </div>
                  </Td>
                  <Td align="right"><Amount value={p.value} compact /></Td>
                  <Td align="right">{formatPct(p.share)}</Td>
                  <Td align="right"><Amount value={propertyValue(p)} compact /></Td>
                  <Td><Badge tone={p.inAllocation ? "accent" : "neutral"}>{p.inAllocation ? "Dedans" : "Hors"}</Badge></Td>
                  <Td className="w-20"><RowActions onEdit={() => setEditing(p)} onDelete={() => confirm(`Supprimer « ${p.name} » ?`) && del.mutate({ id: p.id })} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {scpi.length > 0 && (
          <Card>
            <CardTitle hint="détenues sur vos comptes">SCPI</CardTitle>
            <Table>
              <thead>
                <tr>
                  <Th>SCPI</Th>
                  <Th>Compte</Th>
                  <Th align="right">Valeur</Th>
                  <Th align="right">Gain / perte</Th>
                  <Th>Allocation</Th>
                </tr>
              </thead>
              <tbody>
                {scpi.map(({ account, position: p }) => (
                  <Tr key={`${account.id}-${p.asset.id}`}>
                    <Td className="font-medium">{p.asset.name}</Td>
                    <Td className="text-fg-muted">{account.name}</Td>
                    <Td align="right"><Amount value={p.value} compact /></Td>
                    <Td align="right"><Amount value={p.gain} signed compact /></Td>
                    <Td><Badge tone={p.inAllocation ? "accent" : "neutral"}>{p.inAllocation ? "Dedans" : "Hors"}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </div>

      <PropertyDialog open={editing !== null} property={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </>
  );
}
