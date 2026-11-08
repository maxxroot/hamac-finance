import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PROPERTY_KIND_LABELS, formatPct, propertyValue, type Loan, type Property } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Stat, StatGrid } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { LoanDialog, PropertyDialog } from "@/dialogs/RealEstateDialogs";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
      <button className="rounded p-1.5 text-fg-muted hover:bg-surface-3 hover:text-fg" onClick={onEdit} aria-label="Modifier">
        <Pencil size={14} />
      </button>
      <button className="rounded p-1.5 text-fg-muted hover:bg-negative/15 hover:text-negative" onClick={onDelete} aria-label="Supprimer">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/** Biens immobiliers, SCPI et crédits : ce qui fait passer du patrimoine financier au patrimoine net. */
export function Immobilier() {
  const pf = usePortfolio();
  const delProperty = useMutate("properties.delete", { success: "Bien supprimé" });
  const delLoan = useMutate("loans.delete", { success: "Crédit supprimé" });
  const [property, setProperty] = useState<Property | "new" | null>(null);
  const [loan, setLoan] = useState<Loan | "new" | null>(null);
  if (!pf) return null;
  const { netWorth } = pf.state;
  const properties = pf.idx.ws.properties;
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const scpi = pf.state.accounts.flatMap((a) => a.positions.filter((p) => p.asset.kind === "scpi").map((p) => ({ account: a.account, position: p })));
  const debtOf = (id: string) => netWorth.loans.filter((l) => l.loan.propertyId === id).reduce((s, l) => s + l.balance, 0);

  return (
    <>
      <PageHeader title="Immobilier et crédits" description="Vos biens et vos crédits, en plus du patrimoine financier. Les biens restent hors allocation cible, sauf choix contraire." />

      <StatGrid>
        <Stat label="Patrimoine net" sub="financier + immobilier − crédits">
          <span className="text-2xl">
            <Amount value={netWorth.net} compact />
          </span>
        </Stat>
        <Stat label="Biens immobiliers" sub="part détenue">
          <Amount value={netWorth.realEstate} compact />
        </Stat>
        <Stat label="Crédits restant dus">
          <Amount value={netWorth.debts} compact />
        </Stat>
        <Stat label="Mensualités" sub="assurance comprise">
          <Amount value={netWorth.monthlyLoans} compact />
        </Stat>
      </StatGrid>

      <div className="space-y-5">
        <Card>
          <CardTitle
            hint={
              <Button variant="ghost" className="h-7 text-xs" onClick={() => setProperty("new")}>
                <Plus size={13} /> Nouveau bien
              </Button>
            }
          >
            Biens
          </CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Bien</Th>
                <Th align="right">Valeur</Th>
                <Th align="right">Part</Th>
                <Th align="right">Valeur détenue</Th>
                <Th align="right">Crédit restant</Th>
                <Th>Allocation</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {properties.length === 0 && <EmptyRow cols={7}>Aucun bien. Ajoutez votre résidence ou un investissement locatif.</EmptyRow>}
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
                  <Td align="right">{debtOf(p.id) ? <Amount value={debtOf(p.id)} compact /> : "—"}</Td>
                  <Td><Badge tone={p.inAllocation ? "accent" : "neutral"}>{p.inAllocation ? "Dedans" : "Hors"}</Badge></Td>
                  <Td className="w-20"><Actions onEdit={() => setProperty(p)} onDelete={() => confirm(`Supprimer « ${p.name} » ?`) && delProperty.mutate({ id: p.id })} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardTitle
            hint={
              <Button variant="ghost" className="h-7 text-xs" onClick={() => setLoan("new")}>
                <Plus size={13} /> Nouveau crédit
              </Button>
            }
          >
            Crédits
          </CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Crédit</Th>
                <Th align="right">Taux</Th>
                <Th align="right">Mensualité</Th>
                <Th align="right">Capital restant dû</Th>
                <Th align="right">Échéances restantes</Th>
                <Th>Fin</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {netWorth.loans.length === 0 && <EmptyRow cols={7}>Aucun crédit en cours.</EmptyRow>}
              {netWorth.loans.map((l) => (
                <Tr key={l.loan.id} className="group">
                  <Td className="font-medium">
                    {l.loan.name}
                    {l.loan.propertyId && <div className="text-xs font-normal text-fg-faint">{propertyName.get(l.loan.propertyId)}</div>}
                  </Td>
                  <Td align="right">{formatPct(l.loan.rate)}</Td>
                  <Td align="right"><Amount value={l.monthly} /></Td>
                  <Td align="right">
                    <span className="inline-flex items-center gap-2">
                      {l.fromManualBalance && <Badge>d'après relevé</Badge>}
                      <Amount value={l.balance} />
                    </span>
                  </Td>
                  <Td align="right">{l.paymentsLeft}</Td>
                  <Td className="whitespace-nowrap text-fg-muted">{formatDate(l.endDate)}</Td>
                  <Td className="w-20"><Actions onEdit={() => setLoan(l.loan)} onDelete={() => confirm(`Supprimer « ${l.loan.name} » ?`) && delLoan.mutate({ id: l.loan.id })} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {scpi.length > 0 && (
          <Card>
            <CardTitle hint="comptées dans le patrimoine financier">SCPI</CardTitle>
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

      <PropertyDialog open={property !== null} property={property === "new" ? null : property} onClose={() => setProperty(null)} />
      <LoanDialog open={loan !== null} loan={loan === "new" ? null : loan} properties={properties.filter((p) => !p.archived)} onClose={() => setLoan(null)} />
    </>
  );
}
