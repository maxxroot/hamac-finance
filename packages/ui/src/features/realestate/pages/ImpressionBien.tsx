import { useParams } from "react-router";
import { PROPERTY_KIND_LABELS, PROPERTY_OWNERSHIP_LABELS, PROPERTY_TYPE_LABELS, dpeExpiry, formatEur, formatPct, heldShareLabel, propertyImprovements, propertyProfitability, propertySqm, propertySummary, propertyTotalCost, propertyYears, rentLedgerOf } from "@hamac/core";
import { EnergyDiagram } from "@/features/realestate/components/EnergyDiagram";
import { PrintLine, PrintPage, PrintSection } from "@/shared/components/PrintPage";
import { formatDate, formatNumber } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";

const eur = (v: number | null) => (v == null ? "—" : formatEur(v));
const pct = (v: number | null) => (v == null ? "—" : formatPct(v));

/** Fiche technique du bien et de sa rentabilité, à imprimer. */
export function ImpressionBien() {
  const { id } = useParams();
  const pf = usePortfolio();
  if (!pf) return null;
  const { ws } = pf.idx;
  const p = ws.properties.find((x) => x.id === id);
  if (!p) return <PrintPage>Bien introuvable.</PrintPage>;
  const improvements = propertyImprovements(ws.propertyExpenses, p.id, pf.today);
  const held = pf.data.properties?.find((x) => x.id === p.id) ?? p;
  const heldLoans = pf.data.loans ?? ws.loans;
  const s = propertySummary(held, pf.state.netWorth.loans, improvements, pf.today);
  const sqm = propertySqm(p, null);
  const rented = p.kind === "locatif";
  const years = rented ? propertyYears({ property: held, incomes: ws.propertyIncomes, leases: ws.leases, rents: ws.leaseRents, ledger: rentLedgerOf(ws), expenses: ws.propertyExpenses, loans: heldLoans, lots: ws.lots }, pf.today) : [];
  const profit = propertyProfitability(years);
  const place = [p.address, [p.postalCode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <PrintPage>
      <h1 className="text-xl font-semibold">{p.name}</h1>
      <p className="mb-5 text-neutral-600">
        {PROPERTY_KIND_LABELS[p.kind]} · {PROPERTY_OWNERSHIP_LABELS[p.ownership]} · édité le {formatDate(pf.today)}
      </p>

      <PrintSection title="Description">
        {place && <PrintLine label="Adresse">{place}</PrintLine>}
        {p.propertyType && <PrintLine label="Type de bien">{PROPERTY_TYPE_LABELS[p.propertyType]}</PrintLine>}
        {p.surface != null && <PrintLine label="Surface habitable">{formatNumber(p.surface)} m²</PrintLine>}
        {p.rooms != null && <PrintLine label="Pièces">{p.rooms}</PrintLine>}
        {p.bedrooms != null && <PrintLine label="Chambres">{p.bedrooms}</PrintLine>}
        {p.floor != null && <PrintLine label="Étage">{p.floor}</PrintLine>}
        {p.buildYear != null && <PrintLine label="Année de construction">{p.buildYear}</PrintLine>}
        {p.outdoor && <PrintLine label="Extérieur">{p.outdoor}</PrintLine>}
        {p.heating && <PrintLine label="Chauffage">{p.heating}</PrintLine>}
        {(p.parking || p.cellar) && <PrintLine label="Annexes">{[p.parking && "Parking", p.cellar && "Cave"].filter(Boolean).join(", ")}</PrintLine>}
        {p.dpeDate && <PrintLine label="DPE valable jusqu'au">{formatDate(dpeExpiry(p.dpeDate))}</PrintLine>}
      </PrintSection>

      {(p.dpe || p.ges) && (
        <PrintSection title="Énergie">
          <div className="grid grid-cols-2 gap-6 py-1">
            <EnergyDiagram kind="dpe" value={p.dpe} />
            <EnergyDiagram kind="ges" value={p.ges} />
          </div>
        </PrintSection>
      )}

      <PrintSection title={heldShareLabel(held, pf.today) ? `Valeur et coût (${heldShareLabel(held, pf.today)})` : "Valeur et coût"}>
        <PrintLine label="Valeur détenue">{eur(s.heldValue)}</PrintLine>
        {p.valueDate && <PrintLine label="Estimée le">{formatDate(p.valueDate)}</PrintLine>}
        <PrintLine label="Coût d'achat complet du bien entier">{eur(propertyTotalCost(p))}</PrintLine>
        {improvements > 0 && <PrintLine label="Travaux d'amélioration">{eur(improvements)}</PrintLine>}
        <PrintLine label="Gain estimé avant impôt">{eur(s.gain)}</PrintLine>
        <PrintLine label="Capital restant dû à votre charge">{eur(s.heldDebt)}</PrintLine>
        <PrintLine label="Valeur nette">{eur(s.netValue)}</PrintLine>
        {sqm && <PrintLine label="Valeur au m²">{eur(sqm.value)}</PrintLine>}
      </PrintSection>

      {profit && (
        <PrintSection title={`Rentabilité ${profit.year}, avant impôt`}>
          <PrintLine label="Rendement brut">{pct(profit.grossYield)}</PrintLine>
          <PrintLine label="Rendement après charges">{pct(profit.netYield)}</PrintLine>
          <PrintLine label="Ce qu'il reste par mois, en moyenne">{eur(profit.monthlyRemaining)}</PrintLine>
          <PrintLine label="Occupation">{pct(profit.occupancy)}</PrintLine>
          <PrintLine label="Loyers perçus depuis l'achat">{eur(profit.totalRents)}</PrintLine>
        </PrintSection>
      )}

      {years.length > 0 && (
        <PrintSection title="Résultats par année, votre part">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-neutral-600">
                <th className="py-0.5 font-normal">Année</th>
                <th className="text-right font-normal">Reçu</th>
                <th className="text-right font-normal">Dépenses</th>
                <th className="text-right font-normal">Coût du crédit</th>
                <th className="text-right font-normal">Reste</th>
                <th className="text-right font-normal">Brut</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year}>
                  <td className="py-0.5">{y.year}{y.partial ? " *" : ""}</td>
                  <td className="text-right">{eur(y.rents + y.charges + y.otherIncome)}</td>
                  <td className="text-right">{eur(y.expenses)}</td>
                  <td className="text-right">{eur(y.interest + y.insurance + y.capital)}</td>
                  <td className="text-right">{eur(y.remaining)}</td>
                  <td className="text-right">{pct(y.grossYield)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {years.some((y) => y.partial) && <p className="mt-1 text-xs text-neutral-600">* Année incomplète : rendement ramené à une année entière.</p>}
        </PrintSection>
      )}
    </PrintPage>
  );
}
