import { AddTransactionButton, EmptyAccount, Movements, Onboarding } from "@/features/entry";
import { Notice } from "@/shared/components/Stat";
import { PageHeader } from "@/shared/components/ui";
import { cn } from "@/shared/lib/cn";
import { CouponsChart, FlowsChart, IssuersChart, LadderChart, TrajectoryChart, YieldChart } from "../../components/BondCharts";
import { DispenseStatus } from "../../components/DispenseStatus";
import { BondStats } from "./_BondStats";
import { BondTable } from "./_BondTable";
import { PlanForm } from "./_PlanForm";
import { useBondData } from "./_useBondData";

export function Obligations() {
  const d = useBondData();
  if (!d) return null;
  if (!d.hasAccounts) return <Onboarding />;
  const { cto, held } = d;
  const charts = held.length > 0 || d.plans.length > 0 || d.coupons.byYear.length > 0;

  return (
    <>
      <PageHeader
        title="Obligations"
        description="Obligations à taux fixe gardées jusqu'à l'échéance : valeur, coupons et rendement calculés, aucun cours nécessaire."
        actions={cto && <AddTransactionButton accountId={cto.account.id} type="achat" assetKinds={["obligation"]} accountKinds={["cto", "assurance_vie"]} />}
      />
      {!cto && (
        <div className="mb-6">
          <EmptyAccount kind="cto" label="Ajouter un compte-titres">
            Les obligations se détiennent dans un compte-titres (ou une assurance-vie). Créez d'abord le compte, rattaché à son courtier.
          </EmptyAccount>
        </div>
      )}
      <BondStats d={d} />
      <DispenseStatus accounts={d.taxAccounts} institutions={d.institutions} params={d.params} today={d.today} />
      <BondTable d={d} />

      {charts && (
        <div className="mb-6 grid gap-5 @3xl:grid-cols-2">
          {d.ladder.length > 0 && <LadderChart ladder={d.ladder} ageOf={d.ageOf} retirementYear={d.retirementYear} />}
          {d.flowYears.length > 0 && <FlowsChart years={d.flowYears} />}
          {d.trajectory.length > 0 && <TrajectoryChart years={d.trajectory} />}
          {d.coupons.byYear.length > 0 && <CouponsChart years={d.coupons.byYear} />}
          {d.breakdown.byIssuer.length > 0 && <IssuersChart breakdown={d.breakdown} />}
          {held.some((p) => p.bond?.ytm != null) && <YieldChart held={held} />}
        </div>
      )}

      <div className="mb-6 grid gap-5 @3xl:grid-cols-3">
        <PlanForm accountId={cto?.account.id ?? null} />
        <Notice>
          <b className="text-fg">Coupon ≠ rendement.</b> Achetée sous le pair, une obligation rapporte plus que son coupon, car l'émetteur rembourse 100 % à l'échéance.
          {d.retraite && " À l'échéance : avant l'âge de sécurisation, racheter une ligne plus longue ; après, transférer vers le fonds euros."} Les coupons se saisissent dans le journal (Intérêts / coupon).
        </Notice>
      </div>
      {d.ctos.length > 0 && <Movements accountIds={d.ctos.map((c) => c.account.id)} limit={15} title="Mouvements des obligations" type="achat" assetKinds={["obligation"]} withCash={false} accountKinds={["cto", "assurance_vie"]} />}
      <p className={cn("mt-2 text-xs text-fg-faint", !held.length && "hidden")}>Valeur « détenue jusqu'à l'échéance » : prix d'achat amorti linéairement vers 100 % + coupon couru. Un cours saisi à la main la remplace.</p>
    </>
  );
}
