import { ShoppingCart, Trash2 } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";
import { countryName, lineKey, maturityLabel, sovereignCountry, type Asset } from "@hamac/core";
import { AccountLink } from "@/shared/components/AccountLink";
import { Amount } from "@/shared/components/Amount";
import { Flag } from "@/shared/components/Flag";
import { Pct } from "@/shared/components/Stat";
import { DetailRow, EmptyRow, ExpandButton, Table, Td, Th, Tr, useExpandedRow } from "@/shared/components/table";
import { Badge } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/numbers";
import { SortTh, useSortable } from "@/shared/lib/sort";
import { useMutate, useWorkspaceIndex } from "@/shared/lib/workspace";
import { BondDetail } from "./_BondDetail";
import type { BondData } from "./_useBondData";

/**
 * L'échelle des lignes : détenues (triables, dépliables), prévues, échues.
 * La colonne « Âge à l'échéance » n'existe qu'en plan retraite.
 */
export function BondTable({ d }: { d: BondData }) {
  const { isOpen, rowProps } = useExpandedRow();
  const delPlan = useMutate("bondPlans.delete");
  const idx = useWorkspaceIndex();
  const accountOf = (id: string | null | undefined) => (id ? idx?.accountById.get(id) : undefined);
  const accountCell = (id: string | null | undefined) => (
    <Td className="whitespace-nowrap">
      <AccountLink account={accountOf(id)} />
    </Td>
  );
  const ladder = useSortable(
    d.held,
    {
      nom: (p) => p.asset.name,
      compte: (p) => accountOf(p.accountId)?.name,
      echeance: (p) => p.bond!.terms.maturityDate,
      coupon: (p) => p.bond!.terms.couponRate,
      nominal: (p) => p.bond!.nominal,
      cout: (p) => p.cost,
      valeur: (p) => p.value,
      pv: (p) => p.gainPct,
      ytm: (p) => p.bond!.ytm,
      age: (p) => p.bond!.ageAtMaturity,
      reste: (p) => p.bond!.yearsLeft,
    },
    { key: "echeance", dir: "asc" },
  );
  const age = d.ageOf;
  const cols = age ? 12 : 11;
  const ageCell = (content?: ReactNode) => (age ? <Td align="right">{content}</Td> : null);

  return (
    <Table className="mb-6">
      <thead>
        <tr>
          <SortTh {...ladder.by("nom")}>Obligation</SortTh>
          <SortTh {...ladder.by("compte")}>Compte</SortTh>
          <SortTh {...ladder.by("echeance")}>Échéance</SortTh>
          <SortTh {...ladder.by("coupon")} align="right">Coupon</SortTh>
          <SortTh {...ladder.by("nominal")} align="right">Nominal</SortTh>
          <SortTh {...ladder.by("cout")} align="right">Coût (frais compris)</SortTh>
          <SortTh {...ladder.by("valeur")} align="right">Valeur</SortTh>
          <SortTh {...ladder.by("pv")} align="right">Plus-value (%)</SortTh>
          <SortTh {...ladder.by("ytm")} align="right">Rendement à l'échéance</SortTh>
          {age && <SortTh {...ladder.by("age")} align="right">Âge à l'échéance</SortTh>}
          <SortTh {...ladder.by("reste")} align="right">Reste</SortTh>
          <Th>Statut</Th>
        </tr>
      </thead>
      <tbody>
        {d.held.length + d.matured.length + d.plans.length === 0 && <EmptyRow cols={cols}>Aucune obligation. Prévoyez vos achats ci-dessous, puis saisissez-les dans le journal.</EmptyRow>}
        {ladder.sorted.map((p) => {
          const key = lineKey(p.accountId, p.asset.id);
          return (
            <Fragment key={key}>
              <Tr {...rowProps(key)}>
                <Td className="font-medium">
                  <ExpandButton open={isOpen(key)} label={p.asset.name} />
                  <BondName asset={p.asset} />
                </Td>
                {accountCell(p.accountId)}
                <Td className="whitespace-nowrap">
                  {maturityLabel(p.bond!.terms.maturityDate)}
                </Td>
                <Td align="right">
                  <Pct value={p.bond!.terms.couponRate} digits={2} />
                </Td>
                <Td align="right">
                  <Amount value={p.bond!.nominal} compact />
                </Td>
                <Td align="right">
                  <Amount value={p.cost} />
                </Td>
                <Td align="right" title={p.priceUsed === "modele" ? "Prix d'achat amorti vers 100 % + coupon couru" : "Cours saisi"}>
                  <Amount value={p.value} />
                </Td>
                <Td align="right">
                  <Amount value={p.gain} signed compact />
                  <div className="text-[11px]">
                    <Pct value={p.gainPct} signed digits={2} />
                  </div>
                </Td>
                <Td align="right">
                  <Pct value={p.bond!.ytm} digits={2} />
                </Td>
                {ageCell(`${p.bond!.ageAtMaturity} ans`)}
                <Td align="right">{p.bond!.yearsLeft.toFixed(1).replace(".", ",")} ans</Td>
                <Td>
                  <Badge tone="positive">Détenue</Badge>
                </Td>
              </Tr>
              {isOpen(key) && (
                <DetailRow cols={cols}>
                  <BondDetail p={p} d={d} />
                </DetailRow>
              )}
            </Fragment>
          );
        })}
        {d.plans.map((b) => (
          <Tr key={b.id} className="group">
            <Td className="font-medium">
              {b.label}
              {b.comment && <div className="text-xs font-normal text-fg-faint">{b.comment}</div>}
            </Td>
            {accountCell(b.accountId)}
            <Td className="text-fg-muted">vers {b.targetYear}</Td>
            <Td />
            <Td align="right">
              <Amount value={b.nominal} compact />
            </Td>
            <Td />
            <Td />
            <Td />
            <Td />
            {ageCell(age && `${age(b.targetYear)} ans`)}
            <Td />
            <Td>
              <div className="flex items-center gap-2">
                <Badge tone="accent">Prévue</Badge>
                {d.cto && (
                  <Link to={`/journal?nouveau=1&compte=${d.cto.account.id}&type=achat&titre=nouveau`} className="text-fg-muted hover:text-accent" title="Saisir l'achat">
                    <ShoppingCart size={14} />
                  </Link>
                )}
                <button className="text-fg-faint opacity-0 group-hover:opacity-100 hover:text-negative" onClick={() => delPlan.mutate({ id: b.id })} aria-label="Supprimer">
                  <Trash2 size={13} />
                </button>
              </div>
            </Td>
          </Tr>
        ))}
        {d.matured.map((p) => {
          const key = lineKey(p.accountId, p.asset.id);
          const received = d.coupons.receivedByLine.get(key) ?? 0;
          return (
            <Tr key={`m-${key}`} className="text-fg-faint">
              <Td>
                <BondName asset={p.asset} struck />
              </Td>
              {accountCell(p.accountId)}
              <Td>{formatDate(p.asset.maturityDate)}</Td>
              <Td align="right">
                <Pct value={p.asset.couponRate} digits={2} />
              </Td>
              <Td />
              <Td />
              <Td />
              <Td align="right" title="Plus-value réalisée au remboursement, puis coupons perçus">
                <Amount value={p.realizedGain} signed />
                {received > 0 && (
                  <div className="text-[11px]">
                    + <Amount value={received} compact /> de coupons perçus
                  </div>
                )}
              </Td>
              <Td align="right" title="Rendement réalisé : prix d'achat, coupons perçus et remboursement au pair">
                <Pct value={d.realizedYield.get(key)} digits={2} />
                <div className="text-[11px]">réalisé</div>
              </Td>
              {ageCell()}
              <Td />
              <Td>
                <Badge>Échue</Badge>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/** Nom d'une obligation, précédé du drapeau de l'État émetteur pour une obligation d'État. */
function BondName({ asset, struck }: { asset: Asset; struck?: boolean }) {
  const country = sovereignCountry(asset);
  return (
    <span className="inline-flex items-center gap-2">
      {country && <Flag code={country} label={`État émetteur : ${countryName(country)}`} />}
      <span className={struck ? "line-through" : undefined}>{asset.name}</span>
    </span>
  );
}
