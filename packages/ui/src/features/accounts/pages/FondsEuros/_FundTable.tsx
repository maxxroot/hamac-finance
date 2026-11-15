import { Fragment } from "react";
import { AccountLink } from "@/shared/components/AccountLink";
import { PositionEvolution } from "@/shared/components/AccountEvolution";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { DetailRow, EmptyRow, ExpandButton, Table, Td, Tr, useExpandedRow } from "@/shared/components/table";
import { Badge } from "@/shared/components/ui";
import { SortTh, useSortable } from "@/shared/lib/sort";
import type { FundLine } from "@/features/accounts/lib/fundLines";
import { FundRates } from "./_FundRates";

const COLS = 7;

/** Une ligne par fonds euros et par contrat ; dépliée, elle montre les taux servis et l'évolution du fonds. */
export function FundTable({ lines }: { lines: FundLine[] }) {
  const { isOpen, rowProps } = useExpandedRow();
  const total = lines.reduce((t, l) => t + l.balance, 0);
  const share = (l: FundLine) => (total > 0 ? l.balance / total : null);
  const { sorted, by } = useSortable(lines, {
    fonds: (l) => l.fund.name,
    contrat: (l) => l.s.account.name,
    solde: (l) => l.balance,
    interets: (l) => l.income,
    dernier: (l) => l.lastRate?.rate ?? null,
    moyen: (l) => l.avgRate,
    part: (l) => l.balance,
  });
  return (
    <Table className="mb-6">
      <thead>
        <tr>
          <SortTh {...by("fonds")}>Fonds euros</SortTh>
          <SortTh {...by("contrat")}>Contrat</SortTh>
          <SortTh {...by("solde")} align="right">
            Solde
          </SortTh>
          <SortTh {...by("interets")} align="right">
            Intérêts reçus
          </SortTh>
          <SortTh {...by("dernier")} align="right">
            Dernier taux servi
          </SortTh>
          <SortTh {...by("moyen")} align="right">
            Taux moyen servi
          </SortTh>
          <SortTh {...by("part")} align="right">
            Part
          </SortTh>
        </tr>
      </thead>
      <tbody>
        {lines.length === 0 && <EmptyRow cols={COLS}>Aucun fonds euros : choisissez le fonds euros de chaque contrat dans sa fiche (crayon sur la page du contrat).</EmptyRow>}
        {sorted.map((l) => (
          <Fragment key={l.key}>
            <Tr {...rowProps(l.key)}>
              <Td className="font-medium">
                <ExpandButton open={isOpen(l.key)} label={`${l.fund.name} (${l.s.account.name})`} />
                {l.fund.name}
                {l.isDefault && (
                  <span className="ml-2">
                    <Badge tone="positive">support par défaut</Badge>
                  </span>
                )}
              </Td>
              <Td className="whitespace-nowrap">
                <AccountLink account={l.s.account} />
              </Td>
              <Td align="right" className="font-medium">
                <Amount value={l.balance} />
              </Td>
              <Td align="right">
                <Amount value={l.income} />
              </Td>
              <Td align="right">
                {l.lastRate ? (
                  <>
                    <Pct value={l.lastRate.rate} digits={2} /> <span className="text-xs text-fg-faint">en {l.lastRate.year}</span>
                  </>
                ) : (
                  "—"
                )}
              </Td>
              <Td align="right">
                <Pct value={l.avgRate} digits={2} />
              </Td>
              <Td align="right">
                <Pct value={share(l)} />
              </Td>
            </Tr>
            {isOpen(l.key) && (
              <DetailRow cols={COLS}>
                <div className="grid gap-5 @3xl:grid-cols-[minmax(0,26rem)_1fr]">
                  <FundRates line={l} />
                  <PositionEvolution accountId={l.s.account.id} assetId={l.fund.id} />
                </div>
              </DetailRow>
            )}
          </Fragment>
        ))}
        {lines.length > 1 && (
          <tr className="bg-surface-2/60 font-medium">
            <Td>Total</Td>
            <Td />
            <Td align="right">
              <Amount value={total} />
            </Td>
            <Td align="right">
              <Amount value={lines.reduce((t, l) => t + l.income, 0)} />
            </Td>
            <Td />
            <Td />
            <Td align="right">100 %</Td>
          </tr>
        )}
      </tbody>
    </Table>
  );
}
