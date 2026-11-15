import { AccountLink } from "@/shared/components/AccountLink";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { DISMEMBERMENT_LABELS, PROPERTY_KIND_LABELS, classEnabled, dismembermentRatio, formatPct, propertyValue, type Property } from "@hamac/core";
import { CompaniesCard } from "@/features/realestate/components/CompaniesCard";
import { Amount } from "@/shared/components/Amount";
import { RowActions } from "@/shared/components/RowActions";
import { Stat, StatGrid } from "@/shared/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/shared/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/shared/components/ui";
import { PropertySheetModal } from "@/features/realestate/components/PropertySheetModal";
import { PropertyDialog } from "@/features/realestate/dialogs/PropertyDialog";
import { cn } from "@/shared/lib/cn";
import { formatDate } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useMutate } from "@/shared/lib/workspace";

/** Biens immobiliers et SCPI. */
export function Immobilier() {
  const pf = usePortfolio();
  const del = useMutate("properties.delete", { success: "Bien supprimé" });
  const [editing, setEditing] = useState<Property | "new" | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  if (!pf) return null;
  const properties = pf.idx.ws.properties;
  const immobilierIn = classEnabled(pf.data.params, "immobilier");
  const scpi = pf.state.accounts.flatMap((a) => a.positions.filter((p) => p.asset.kind === "scpi").map((p) => ({ account: a.account, position: p })));
  const scpiValue = scpi.reduce((s, x) => s + x.position.value, 0);

  return (
    <>
      <PageHeader
        title="Immobilier"
        description="Vos biens et vos SCPI. Le bouton « Fiche du bien » présente chaque bien, son nom ouvre son suivi. Par défaut hors allocation cible : réglable dans Paramètres › Répartition ou sur chaque bien."
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
                <Th />
              </tr>
            </thead>
            <tbody>
              {properties.length === 0 && <EmptyRow cols={7}>Aucun bien. Ajoutez votre résidence ou un investissement locatif.</EmptyRow>}
              {properties.map((p) => {
                // Part détenue, parts de SCI comprises.
                const held = pf.data.properties?.find((x) => x.id === p.id) ?? p;
                return (
                <Tr key={p.id} className={cn("group", p.archived && "opacity-50")}>
                  <Td className="font-medium">
                    <Link to={`/immobilier/${p.id}`} className="hover:text-accent hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs font-normal text-fg-faint">
                      {PROPERTY_KIND_LABELS[p.kind]}
                      {p.saleDate ? ` · vendu le ${formatDate(p.saleDate)}` : ""}
                      {p.valueDate ? ` · estimé le ${formatDate(p.valueDate)}` : ""}
                    </div>
                  </Td>
                  <Td align="right"><Amount value={p.value} compact /></Td>
                  <Td align="right">
                    {formatPct(held.share)}
                    {held.dismemberment !== "pleine" && (
                      <div className="text-xs text-fg-faint">
                        {DISMEMBERMENT_LABELS[held.dismemberment].toLocaleLowerCase("fr-FR")} {formatPct(dismembermentRatio(held, pf.today))}
                      </div>
                    )}
                  </Td>
                  <Td align="right"><Amount value={propertyValue(held, pf.today)} compact /></Td>
                  <Td><Badge tone={(p.inAllocation ?? immobilierIn) ? "accent" : "neutral"}>{(p.inAllocation ?? immobilierIn) ? "Inclus" : "Hors"}</Badge></Td>
                  <Td align="right" className="whitespace-nowrap">
                    <Button className="h-8" aria-label={`Fiche du bien ${p.name}`} onClick={() => setSheetId(p.id)}>
                      Fiche du bien
                    </Button>
                  </Td>
                  <Td className="w-20"><RowActions onEdit={() => setEditing(p)} onDelete={() => confirm(`Supprimer « ${p.name} » ?`) && del.mutate({ id: p.id })} /></Td>
                </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        <CompaniesCard />

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
                    <Td className="text-fg-muted">
                      <AccountLink account={account} />
                    </Td>
                    <Td align="right"><Amount value={p.value} compact /></Td>
                    <Td align="right"><Amount value={p.gain} signed compact /></Td>
                    <Td><Badge tone={p.inAllocation ? "accent" : "neutral"}>{p.inAllocation ? "Inclus" : "Hors"}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </div>

      <PropertySheetModal property={properties.find((p) => p.id === sheetId) ?? null} onClose={() => setSheetId(null)} />
      <PropertyDialog open={editing !== null} property={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </>
  );
}
