import { Amount } from "@/shared/components/Amount";
import { Pct, Stat, StatGrid } from "@/shared/components/Stat";
import { formatDate } from "@/shared/lib/numbers";
import type { BondData } from "./_useBondData";

/** Les huit chiffres du haut de page, sur deux rangées : ce que l'on détient et rapporte, puis ce qui arrive. */
export function BondStats({ d }: { d: BondData }) {
  const { taxes, gain, coupons, next12 } = d;
  const cashAlert = d.cash >= d.params.alerts.ctoCashThreshold;
  return (
    <>
      <StatGrid>
        <Stat label="Nominal détenu" sub={<>coût d'achat <Amount value={d.costHeld} compact /></>}>
          <Amount value={d.nominalHeld} compact />
        </Stat>
        <Stat label="Coupons annuels bruts" sub={<>rendement actuariel moyen <Pct value={d.ytmAvg} digits={2} /></>}>
          <Amount value={d.annualCoupons} compact />
        </Stat>
        <Stat label="Rendement net de fiscalité" sub={taxes.netYtm != null ? <>fiscalité restant due <Amount value={taxes.couponTax + taxes.gainTax} compact /></> : "Aucune ligne détenue"} detail={taxes.netYtm != null && <TaxDetail d={d} />}>
          <Pct value={taxes.netYtm} digits={2} />
        </Stat>
        <Stat label="Performance cumulée" sub={<>dont <Amount value={gain.coupons} compact /> de coupons perçus</>}>
          <Amount value={gain.total} signed compact />
        </Stat>
      </StatGrid>
      <StatGrid>
        <Stat label="Flux à 12 mois" sub={next12.redemptions > 0 ? <>dont <Amount value={next12.redemptions} compact /> de remboursements</> : next12.count ? "coupons bruts" : "Aucun flux prévu"}>
          <Amount value={next12.coupons + next12.redemptions} compact />
        </Stat>
        <Stat
          label="Prochaine échéance"
          sub={
            d.upcomingCoupon && (
              <>
                coupon le {formatDate(d.upcomingCoupon.date)} : <Amount value={d.upcomingCoupon.amount} compact /> brut
              </>
            )
          }
        >
          {d.nextMaturity ? formatDate(d.nextMaturity) : "—"}
        </Stat>
        <Stat
          label="Coupons perçus"
          tone={coupons.missing ? "warning" : undefined}
          sub={
            coupons.expected > 0 ? (
              <>
                sur <Amount value={coupons.expected} compact /> échus
                {coupons.missing > 0 && (
                  <>
                    {" "}· <span className="text-warning">{coupons.missing === 1 ? "1 coupon non saisi" : `${coupons.missing} coupons non saisis`}</span>
                  </>
                )}
              </>
            ) : (
              "Aucun coupon échu à ce jour"
            )
          }
        >
          <Amount value={coupons.received} compact />
        </Stat>
        <Stat label="Espèces en attente" tone={cashAlert ? "warning" : undefined} sub={cashAlert ? "De quoi acheter une ligne" : "Compte-titres"}>
          <Amount value={d.cash} compact />
        </Stat>
      </StatGrid>
    </>
  );
}

/** Détail au survol : fiscalité restant due sur les coupons et sur les primes de remboursement, taux effectif de chacun. */
function TaxDetail({ d }: { d: BondData }) {
  const { taxes } = d;
  const rate = (tax: number, base: number) => (base > 0 ? tax / base : null);
  return (
    <div className="space-y-2">
      <div className="font-medium text-fg">Fiscalité restant due jusqu'aux échéances</div>
      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <span>Sur les coupons (<Amount value={taxes.couponsAhead} compact /> bruts)</span>
        <span className="text-right">
          <b className="text-fg"><Amount value={taxes.couponTax} /></b> · <Pct value={rate(taxes.couponTax, taxes.couponsAhead)} />
        </span>
        <span>Sur les primes de remboursement (<Amount value={taxes.gainAhead} compact />)</span>
        <span className="text-right">
          <b className="text-fg"><Amount value={taxes.gainTax} /></b> · <Pct value={rate(taxes.gainTax, taxes.gainAhead)} />
        </span>
      </div>
      <div>
        Rendement actuariel brut <Pct value={d.ytmAvg} digits={2} />, net <Pct value={taxes.netYtm} digits={2} />.
      </div>
      <div className="text-fg-faint">
        Compte-titres : coupons et prime de remboursement imposés à {d.params.tax.tmi < d.params.tax.pfuIncomeTax ? "votre tranche" : "12,8 %"} + prélèvements sociaux.
        {taxes.lifeInsurance && " Assurance-vie : imposition au rachat selon l'ancienneté du contrat, hors abattement annuel."} Une moins-value au remboursement n'est pas imputée.
      </div>
    </div>
  );
}
