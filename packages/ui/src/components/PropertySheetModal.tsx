import { Pencil, Printer } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  PROPERTY_KIND_LABELS,
  PROPERTY_OWNERSHIP_LABELS,
  PROPERTY_TYPE_LABELS,
  monthlyRentNow,
  dpeExpiry,
  dpeRentalBan,
  formatEur,
  heldShareLabel,
  loanPayoffAt,
  propertyImprovements,
  propertyProfitability,
  propertySale,
  propertySqm,
  propertySummary,
  propertyYears,
  type Property,
} from "@hamac/core";
import { Amount } from "@/components/Amount";
import { DetailLine as Line } from "@/components/DetailLine";
import { DocumentsCard } from "@/components/DocumentsCard";
import { EnergyDiagram } from "@/components/EnergyDiagram";
import { Modal } from "@/components/form";
import { Pct } from "@/components/Stat";
import { Badge, Button } from "@/components/ui";
import { PropertySheetDialog } from "@/dialogs/PropertySheetDialog";
import { formatDate, formatNumber } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-xs text-fg-faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Figure({ label, sub, children }: { label: string; sub: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold">{children}</div>
      <div className="text-xs text-fg-faint">{sub}</div>
    </div>
  );
}

function Sheet({ property: p, onClose }: { property: Property; onClose: () => void }) {
  const pf = usePortfolio();
  const [editing, setEditing] = useState(false);
  if (!pf) return null;
  const { ws } = pf.idx;
  const rented = p.kind === "locatif";
  const leases = ws.leases.filter((l) => l.propertyId === p.id);
  const improvements = propertyImprovements(ws.propertyExpenses, p.id, pf.today);
  // Part détenue, parts de SCI comprises (le formulaire garde le bien tel que saisi).
  const held = pf.data.properties?.find((x) => x.id === p.id) ?? p;
  const heldLoans = pf.data.loans ?? ws.loans;
  const summary = propertySummary(held, pf.state.netWorth.loans, improvements, pf.today);
  const sale = propertySale(held, improvements, p.saleDate ? loanPayoffAt(heldLoans, p.id, p.saleDate) : 0);
  const years = rented ? propertyYears({ property: held, incomes: ws.propertyIncomes, leases, rents: ws.leaseRents, exceptions: ws.rentExceptions, expenses: ws.propertyExpenses, loans: heldLoans, lots: ws.lots }, pf.today) : [];
  const profit = propertyProfitability(years);
  const monthlyRent = rented ? monthlyRentNow(leases, ws.leaseRents, pf.today) : null;
  const sqm = propertySqm(p, monthlyRent);
  const perSqm = (v: number) => `${formatEur(v)}/m²`;
  const place = [p.address, [p.postalCode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const extras = [p.parking && "Parking", p.cellar && "Cave"].filter(Boolean).join(", ");
  const described = Boolean(place || p.propertyType || p.surface != null || p.rooms != null || p.bedrooms != null || p.floor != null || p.buildYear != null || p.outdoor || p.heating || extras || p.coOwnership);
  const expiry = p.dpeDate ? dpeExpiry(p.dpeDate) : null;
  const ban = rented && p.dpe ? dpeRentalBan(p.dpe, p.postalCode) : null;
  const energyKnown = p.dpe != null || p.ges != null || p.dpeDate != null;
  const filled = described || energyKnown || Boolean(p.comment);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Fiche du bien"
        width="max-w-5xl"
        footer={
          <>
            <Link to={`/impression/bien/${p.id}`} target="_blank" rel="noopener" className="mr-auto inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
              <Printer size={15} /> Imprimer
            </Link>
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
            <Button variant="primary" onClick={() => setEditing(true)}>
              <Pencil size={15} /> {filled ? "Modifier la fiche" : "Compléter la fiche"}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold">{p.name}</h3>
              {p.saleDate && <Badge>Vendu le {formatDate(p.saleDate)}</Badge>}
            </div>
            <p className="text-sm text-fg-muted">
              {PROPERTY_KIND_LABELS[p.kind]} · {PROPERTY_OWNERSHIP_LABELS[p.ownership]}
              {heldShareLabel(held, pf.today) ? ` · ${heldShareLabel(held, pf.today)}` : ""}
            </p>
            {place && <p className="text-sm text-fg-muted">{place}</p>}
          </header>

          {sale ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Figure label="Prix de vente" sub="votre part"><Amount value={sale.price} compact /></Figure>
              <Figure label="Gain réalisé" sub="avant impôt">{sale.gain == null ? "—" : <Amount value={sale.gain} signed compact />}</Figure>
              <Figure label="Reste après frais et crédit" sub="votre part"><Amount value={sale.net} compact /></Figure>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Figure label="Valeur détenue" sub={p.valueDate ? `estimée le ${formatDate(p.valueDate)}` : "part détenue"}><Amount value={summary.heldValue} compact /></Figure>
              <Figure label={improvements > 0 ? "Coût total" : "Coût d'achat"} sub="frais compris, part détenue">{summary.heldCost == null ? "—" : <Amount value={summary.heldCost} compact />}</Figure>
              <Figure label="Gain estimé" sub="avant impôt">{summary.gain == null ? "—" : <Amount value={summary.gain} signed compact />}</Figure>
              <Figure label="Valeur nette" sub="après crédit à votre charge"><Amount value={summary.netValue} compact /></Figure>
            </div>
          )}

          <div className="grid items-start gap-x-10 gap-y-6 md:grid-cols-2">
            <div className="space-y-6">
              <Section title="Caractéristiques">
                {!described && <p className="py-1.5 text-sm text-fg-muted">Ajoutez l'adresse, la surface et les caractéristiques du bien.</p>}
                {p.propertyType && <Line label="Type de bien">{PROPERTY_TYPE_LABELS[p.propertyType]}</Line>}
                {p.surface != null && <Line label="Surface habitable">{formatNumber(p.surface)} m²</Line>}
                {p.rooms != null && <Line label="Pièces">{p.rooms}</Line>}
                {p.bedrooms != null && <Line label="Chambres">{p.bedrooms}</Line>}
                {p.floor != null && <Line label="Étage">{p.floor}</Line>}
                {p.buildYear != null && <Line label="Année de construction">{p.buildYear}</Line>}
                {p.outdoor && <Line label="Extérieur">{p.outdoor}</Line>}
                {extras && <Line label="Annexes">{extras}</Line>}
                {p.heating && <Line label="Chauffage">{p.heating}</Line>}
                {p.coOwnership && <Line label="Copropriété">{p.syndic ? `Oui, syndic ${p.syndic}` : "Oui"}</Line>}
              </Section>
              {sqm && (
                <Section title="Repères au m²">
                  {sqm.purchase != null && <Line label="Prix d'achat au m²">{perSqm(sqm.purchase)}</Line>}
                  <Line label="Valeur au m²">{perSqm(sqm.value)}</Line>
                  {sqm.rent != null && <Line label="Loyer au m² par mois">{perSqm(sqm.rent)}</Line>}
                </Section>
              )}
              {p.comment && (
                <Section title="Notes">
                  <p className="py-1.5 text-sm whitespace-pre-line text-fg-muted">{p.comment}</p>
                </Section>
              )}
            </div>

            <div className="space-y-6">
              <Section title="Énergie">
                {!energyKnown && <p className="py-1.5 text-sm text-fg-muted">DPE non renseigné.</p>}
                {energyKnown && (
                  <>
                    <div className="grid grid-cols-2 gap-4 py-2">
                      <EnergyDiagram kind="dpe" value={p.dpe} />
                      <EnergyDiagram kind="ges" value={p.ges} />
                    </div>
                    {p.dpeDate && <Line label="Réalisé le">{formatDate(p.dpeDate)}</Line>}
                    {expiry && (
                      <Line label="Valable jusqu'au">
                        <span className="inline-flex items-center gap-2">
                          {expiry < pf.today && <Badge tone="negative">Expiré</Badge>}
                          {formatDate(expiry)}
                        </span>
                      </Line>
                    )}
                    {ban && <Line label={ban <= pf.today ? "Location interdite depuis le" : "Location interdite à partir du"}>{formatDate(ban)}</Line>}
                    {!p.dpeReminders && <Line label="Alertes">Désactivées</Line>}
                  </>
                )}
              </Section>
              {rented && (
                <Section title="Rentabilité" hint={profit ? `${profit.year}${profit.partial ? ", année incomplète" : ""} · votre part, avant impôt` : undefined}>
                  {!profit && <p className="py-1.5 text-sm text-fg-muted">Les chiffres apparaîtront dès le premier bail.</p>}
                  {profit && (
                    <>
                      <Line label="Rendement brut"><Pct value={profit.grossYield} digits={2} /></Line>
                      <Line label="Rendement après charges"><Pct value={profit.netYield} digits={2} /></Line>
                      <Line label="Ce qu'il reste par mois, en moyenne">{profit.monthlyRemaining == null ? "—" : <Amount value={profit.monthlyRemaining} signed />}</Line>
                      <Line label="Occupation"><Pct value={profit.occupancy} digits={0} /></Line>
                      <Line label="Loyers perçus depuis l'achat"><Amount value={profit.totalRents} /></Line>
                      <Line label="Capital remboursé depuis l'achat"><Amount value={profit.totalCapital} /></Line>
                    </>
                  )}
                </Section>
              )}
            </div>
          </div>

          <DocumentsCard bare propertyId={p.id} documents={ws.propertyDocuments.filter((d) => d.propertyId === p.id)} />
        </div>
      </Modal>
      <PropertySheetDialog open={editing} property={p} onClose={() => setEditing(false)} />
    </>
  );
}

/** Grande fenêtre de présentation d'un bien. `property` à null : fermée. */
export function PropertySheetModal({ property, onClose }: { property: Property | null; onClose: () => void }) {
  return property ? <Sheet property={property} onClose={onClose} /> : null;
}
