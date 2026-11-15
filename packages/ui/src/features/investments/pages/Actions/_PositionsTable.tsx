import { RefreshCw } from "lucide-react";
import { Fragment } from "react";
import type { Asset, PositionState } from "@hamac/core";
import { AccountLink } from "@/shared/components/AccountLink";
import { PositionEvolution } from "@/shared/components/AccountEvolution";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { DetailRow, EmptyRow, ExpandButton, stopRowClick, Table, Td, Tr, useExpandedRow } from "@/shared/components/table";
import { formatDate, formatQty } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { SortTh, useSortable } from "@/shared/lib/sort";

const PRICE_LABEL = { marche: "marché", manuel: "manuel", modele: "calculé", cout: "prix de revient" } as const;
const COLS = 10;
const keyOf = (p: PositionState) => `${p.accountId}:${p.asset.id}`;

/** Toutes les lignes, une par titre et par compte ; la part se calcule sur l'ensemble des lignes. */
export function PositionsTable({ positions, onPrice }: { positions: PositionState[]; onPrice: (a: Asset) => void }) {
  const pf = usePortfolio();
  const { isOpen, rowProps } = useExpandedRow();
  const total = positions.reduce((t, p) => t + p.value, 0);
  const share = (p: PositionState) => (total > 0 ? p.value / total : 0);
  const accountName = (p: PositionState) => pf?.idx.accountById.get(p.accountId)?.name ?? "";
  const { sorted, by } = useSortable(positions, {
    titre: (p) => p.asset.name,
    compte: accountName,
    parts: (p) => p.quantity,
    pru: (p) => p.pru,
    investi: (p) => p.cost,
    cours: (p) => p.price,
    valeur: (p) => p.value,
    pv: (p) => p.gain,
    pvPct: (p) => p.gainPct,
    part: share,
  });
  if (!pf) return null;
  const cost = positions.reduce((t, p) => t + p.cost, 0);
  const gain = positions.reduce((t, p) => t + p.gain, 0);
  return (
    <Table className="mb-5">
      <thead>
        <tr>
          <SortTh {...by("titre")}>Titre</SortTh>
          <SortTh {...by("compte")}>Compte</SortTh>
          <SortTh {...by("parts")} align="right">
            Parts
          </SortTh>
          <SortTh {...by("pru")} align="right">
            PRU
          </SortTh>
          <SortTh {...by("investi")} align="right">
            Investi
          </SortTh>
          <SortTh {...by("cours")} align="right">
            Cours
          </SortTh>
          <SortTh {...by("valeur")} align="right">
            Valeur
          </SortTh>
          <SortTh {...by("pv")} align="right">
            Plus-value
          </SortTh>
          <SortTh {...by("pvPct")} align="right">
            Plus-value (%)
          </SortTh>
          <SortTh {...by("part")} align="right">
            Part
          </SortTh>
        </tr>
      </thead>
      <tbody>
        {positions.length === 0 && <EmptyRow cols={COLS}>Aucune position. Saisissez vos achats dans le journal.</EmptyRow>}
        {sorted.map((p) => (
          <Fragment key={keyOf(p)}>
            <Tr {...rowProps(keyOf(p))} className={`group ${rowProps(keyOf(p)).className}`}>
              <Td className="font-medium">
                <ExpandButton open={isOpen(keyOf(p))} label={`${p.asset.name} (${accountName(p)})`} />
                {p.asset.name}
                {p.asset.isin && <div className="ml-[21px] font-mono text-xs font-normal text-fg-faint">{p.asset.isin}</div>}
              </Td>
              <Td className="whitespace-nowrap">
                <AccountLink account={pf.idx.accountById.get(p.accountId)} />
              </Td>
              <Td align="right">{formatQty(p.quantity)}</Td>
              <Td align="right">
                <Amount value={p.pru} />
              </Td>
              <Td align="right">
                <Amount value={p.cost} />
              </Td>
              <Td align="right" onClick={stopRowClick}>
                <button className="inline-flex items-center gap-1.5 hover:text-accent" onClick={() => onPrice(p.asset)} title="Saisir le cours à la main">
                  <Amount value={p.price} />
                  <RefreshCw size={11} className="text-fg-faint opacity-0 group-hover:opacity-100" />
                </button>
                <div className="text-[11px] text-fg-faint">
                  {PRICE_LABEL[p.priceUsed]}
                  {p.priceDate ? ` · ${formatDate(p.priceDate)}` : ""}
                </div>
              </Td>
              <Td align="right" className="font-medium">
                <Amount value={p.value} />
              </Td>
              <Td align="right">
                <Amount value={p.gain} signed />
              </Td>
              <Td align="right">
                <Pct value={p.gainPct} signed />
              </Td>
              <Td align="right">
                <Pct value={share(p)} />
              </Td>
            </Tr>
            {isOpen(keyOf(p)) && (
              <DetailRow cols={COLS}>
                <PositionEvolution accountId={p.accountId} assetId={p.asset.id} />
              </DetailRow>
            )}
          </Fragment>
        ))}
        {positions.length > 0 && (
          <tr className="bg-surface-2/60 font-medium">
            <Td>Total</Td>
            <Td colSpan={3} />
            <Td align="right">
              <Amount value={cost} />
            </Td>
            <Td />
            <Td align="right">
              <Amount value={total} />
            </Td>
            <Td align="right">
              <Amount value={gain} signed />
            </Td>
            <Td align="right">
              <Pct value={cost > 0 ? gain / cost : null} signed />
            </Td>
            <Td align="right">100 %</Td>
          </tr>
        )}
      </tbody>
    </Table>
  );
}
