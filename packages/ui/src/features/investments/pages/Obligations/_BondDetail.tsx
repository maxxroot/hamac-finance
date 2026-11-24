import type { ReactNode } from "react";
import { lineKey, type PositionState } from "@hamac/core";
import { PositionEvolution } from "@/shared/components/AccountEvolution";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import type { BondData } from "./_useBondData";

/** Ligne dépliée d'une obligation détenue : coupon annuel, prix de revient, coupons perçus, performance, rendement net, puis son évolution. */
export function BondDetail({ p, d }: { p: PositionState; d: BondData }) {
  const key = lineKey(p.accountId, p.asset.id);
  const lots = p.bond!.lots;
  const qty = lots.reduce((s, l) => s + l.qty, 0);
  // Prix pied de coupon moyen des achats, frais exclus, en % du nominal (comme sur l'avis d'opéré).
  const buyPrice = qty > 0 ? lots.reduce((s, l) => s + l.clean * l.qty, 0) / qty : null;
  const coupons = d.coupons.receivedByLine.get(key) ?? 0;
  const missing = d.missingByLine.get(key) ?? 0;
  const net = d.taxes.lines.find((l) => l.accountId === p.accountId && l.assetId === p.asset.id)?.netYtm ?? null;
  const perYear = p.bond!.terms.frequency;
  const items: Array<{ label: string; value: ReactNode; hint?: ReactNode }> = [
    { label: "Coupon annuel", value: <Amount value={p.bond!.annualCoupon} currency={p.currency} />, hint: perYear > 1 ? `brut, ${perYear} détachements par an` : "brut, 1 détachement par an" },
    { label: "Prix d'achat", value: buyPrice != null ? `${(buyPrice * 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : "—", hint: lots.length > 1 ? `pied de coupon, moyenne pondérée de ${lots.length} achats` : "pied de coupon, hors frais" },
    { label: "Coupon couru", value: <Amount value={p.bond!.accrued} currency={p.currency} />, hint: "compris dans la valeur" },
    ...(p.currency !== "EUR"
      ? [{ label: "Effet de change", value: <Amount value={p.fxGain} signed />, hint: `dans la plus-value ; 1 € = ${p.fxRate.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} ${p.currency} aujourd'hui` }]
      : []),
    {
      label: "Coupons perçus",
      value: <Amount value={coupons} />,
      hint: missing ? <span className="text-warning">{missing === 1 ? "1 coupon non saisi" : `${missing} coupons non saisis`}</span> : "bruts, d'après le Journal",
    },
    { label: "Performance cumulée", value: <Amount value={p.gain + p.realizedGain + coupons} signed />, hint: "plus-values latentes et réalisées + coupons" },
    { label: "Rendement net de fiscalité", value: <Pct value={net} digits={2} />, hint: <>brut <Pct value={p.bond!.ytm} digits={2} />{p.currency !== "EUR" ? ` en ${p.currency}, hors change` : ""}</> },
  ];
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 @3xl:grid-cols-6">
        {items.map((i) => (
          <div key={i.label}>
            <dt className="text-xs text-fg-muted">{i.label}</dt>
            <dd className="num font-semibold text-fg">{i.value}</dd>
            {i.hint && <dd className="text-[11px] text-fg-faint">{i.hint}</dd>}
          </div>
        ))}
      </dl>
      <PositionEvolution accountId={p.accountId} assetId={p.asset.id} />
    </div>
  );
}
