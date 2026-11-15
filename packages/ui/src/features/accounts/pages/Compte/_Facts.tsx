import type { ReactNode } from "react";
import { accountAgeYears, describeOrderFees, holdsEuroFunds, monthsBetween, tradeFeeFor, type AccountState } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { Badge, Card, CardTitle } from "@/shared/components/ui";
import { usePortfolio } from "@/shared/lib/portfolio";

/** Caractéristiques du compte : ancienneté, frais, plafonds, et ce qui ne vaut que pour son type. */
export function Facts({ s }: { s: AccountState }) {
  const pf = usePortfolio();
  if (!pf) return null;
  const { account } = s;
  const { params } = pf.data;
  const rows: Array<[string, ReactNode]> = [];
  const ageY = accountAgeYears(account.openedOn, pf.today);
  if (ageY != null) {
    const ageM = monthsBetween(account.openedOn!, pf.today) % 12;
    rows.push(["Ancienneté", `${ageY} an${ageY > 1 ? "s" : ""} et ${ageM} mois`]);
  }
  if (account.share < 1) rows.push(["Part détenue (compte joint)", <Pct key="share" value={account.share} />]);
  if (account.kind === "livret") {
    if (account.depositCeiling) rows.push(["Marge sous le plafond", <Amount key="ceil" value={account.depositCeiling - s.value} />]);
  }
  if (account.kind === "assurance_vie") {
    rows.push(["Clause bénéficiaire", account.beneficiaryClause ? <Badge tone="positive">rédigée</Badge> : <Badge tone="accent">à rédiger</Badge>]);
  }
  if (holdsEuroFunds(account)) {
    const fgap = params.alerts.fgapGuarantee;
    rows.push(["Garantie FGAP", <span key="fgap">marge de <Amount value={fgap - s.value} compact /></span>]);
  }
  if (account.kind === "pea" || account.kind === "pea_pme" || account.kind === "cto" || account.kind === "crypto") {
    const fees = tradeFeeFor(account, pf.idx.institutionById, params);
    rows.push([fees.source.label, fees.order ? describeOrderFees(fees.order) : fees.cryptoRate != null ? <Pct key="crypto" value={fees.cryptoRate} digits={2} /> : "—"]);
    rows.push(["Courtage payé (total)", <Amount key="fees" value={s.fees} />]);
  }
  const ter = s.positions.reduce((t, p) => t + p.value * (p.asset.ter ?? 0), 0);
  if (ter > 0) rows.push(["Frais de gestion des ETF / an", <Amount key="ter" value={ter} />]);
  if (s.dividends > 0) rows.push(["Dividendes reçus", <Amount key="div" value={s.dividends} />]);
  if (s.interests > 0 && account.kind !== "livret") rows.push(["Intérêts reçus", <Amount key="int" value={s.interests} />]);
  if (s.realizedGain !== 0) rows.push(["Plus-values réalisées", <Amount key="real" value={s.realizedGain} signed />]);
  if (rows.length === 0) return null;
  return (
    <Card className="@3xl:col-span-2">
      <CardTitle>Caractéristiques</CardTitle>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="text-right @xl:text-left">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
