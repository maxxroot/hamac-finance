/** Statistiques de la page Obligations : flux à venir, échelle, répartition, coupons saisis, gains. */
export { upcomingBondFlows, flowsWithin, flowsByYear, valueTrajectory, trajectoryByYear, type BondFlow, type FlowTotal, type FlowYear, type TrajectoryPoint, type TrajectoryYear } from "./_flows";
export { bondKindOf, maturityLadder, bondBreakdown, type LadderYear, type IssuerShare, type BondBreakdown } from "./_ladder";
export { couponCheck, lineKey, COUPON_GRACE_DAYS, type CouponCheck, type CouponEvent, type CouponYear } from "./_coupons";
export { realizedBondYield } from "./_realized";
export { bondGain, type BondGain } from "./_summary";
