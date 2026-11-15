import { useMemo } from "react";
import {
  bondBreakdown,
  bondGain,
  bondTaxes,
  couponCheck,
  flowsByYear,
  flowsWithin,
  isRetirementPlan,
  lineKey,
  maturityLadder,
  nextCoupon,
  realizedBondYield,
  retirementYear,
  upcomingBondFlows,
  trajectoryByYear,
  valueTrajectory,
  ageInYear,
  type PositionState,
} from "@hamac/core";
import { usePortfolio } from "@/shared/lib/portfolio";

/** Tout ce que la page Obligations affiche, calculé une fois par espace de travail et par jour. */
export function useBondData() {
  const pf = usePortfolio();
  return useMemo(() => {
    if (!pf) return null;
    const { state, idx, data, today } = pf;
    const params = data.params;
    // Un compte-titres peut détenir des actions comme des obligations : seuls comptent ceux qui ont des obligations.
    const holders = state.accounts.filter((a) => a.positions.some((p) => p.bond) || a.maturedBonds.length);
    const held: PositionState[] = holders.flatMap((a) => a.positions.filter((p) => p.bond));
    const matured: PositionState[] = holders.flatMap((a) => a.maturedBonds);
    const openCtos = state.accounts.filter((a) => a.account.kind === "cto" && !a.account.archived);
    const bondCtos = openCtos.filter((a) => holders.includes(a));
    // Sans obligation encore, la première s'achètera dans l'un des comptes-titres ouverts.
    const ctos = bondCtos.length ? bondCtos : openCtos;
    const retraite = isRetirementPlan(params);
    // Bandeau : les comptes qui détiennent des obligations, sinon ceux où acheter la première.
    const shown = holders.filter((a) => !a.account.archived);

    const costHeld = held.reduce((s, p) => s + p.cost, 0);
    const flows = upcomingBondFlows(held, today);
    const coupons = couponCheck(data.transactions, data.assets, today);
    const missingByLine = new Map<string, number>();
    for (const e of coupons.events) if (e.received == null) missingByLine.set(lineKey(e.accountId, e.assetId), (missingByLine.get(lineKey(e.accountId, e.assetId)) ?? 0) + 1);

    // Coupons qui tombent à la prochaine date : plusieurs lignes peuvent la partager.
    const nextCoupons = held.flatMap((p) => {
      const c = nextCoupon(p.bond!.terms, today);
      return c ? [{ date: c.date, amount: c.amount * p.bond!.nominal }] : [];
    });
    const firstDate = nextCoupons.map((c) => c.date).sort((a, b) => a.localeCompare(b))[0];

    return {
      today,
      params,
      hasAccounts: idx.ws.accounts.length > 0,
      plans: idx.ws.bondPlans,
      held,
      matured,
      ctos,
      cto: ctos[0],
      accounts: shown.length ? shown : openCtos,
      cash: ctos.reduce((s, a) => s + a.cash, 0),
      // Comptes dont les coupons subissent l'acompte de 12,8 % : hors assurance-vie et PER.
      taxAccounts: holders.filter((a) => a.account.kind !== "assurance_vie" && a.account.kind !== "per").map((a) => a.account),
      institutions: data.institutions ?? [],
      retraite,
      ageOf: retraite ? (year: number) => ageInYear(params, year) : null,
      retirementYear: retraite ? retirementYear(params) : null,
      nominalHeld: held.reduce((s, p) => s + (p.bond?.nominal ?? 0), 0),
      costHeld,
      annualCoupons: held.reduce((s, p) => s + (p.bond?.annualCoupon ?? 0), 0),
      ytmAvg: costHeld > 0 ? held.reduce((s, p) => s + (p.bond?.ytm ?? 0) * p.cost, 0) / costHeld : null,
      nextMaturity: held.map((p) => p.bond!.terms.maturityDate).sort((a, b) => a.localeCompare(b))[0],
      upcomingCoupon: firstDate ? { date: firstDate, amount: nextCoupons.filter((c) => c.date === firstDate).reduce((t, c) => t + c.amount, 0) } : null,
      next12: flowsWithin(flows, today, 12),
      flowYears: flowsByYear(flows),
      ladder: maturityLadder(held, idx.ws.bondPlans, today),
      breakdown: bondBreakdown(held),
      trajectory: trajectoryByYear(valueTrajectory(held, today)),
      coupons,
      missingByLine,
      gain: bondGain(held, matured, coupons.receivedByLine),
      taxes: bondTaxes(state.accounts, params, today),
      realizedYield: new Map(matured.map((p) => [lineKey(p.accountId, p.asset.id), realizedBondYield(p, data.transactions)])),
    };
  }, [pf]);
}

export type BondData = NonNullable<ReturnType<typeof useBondData>>;
