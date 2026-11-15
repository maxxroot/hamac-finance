import { Fragment } from "react";
import { Link } from "react-router";
import { ASSET_KIND_LABELS, type AccountState, type AssetKind } from "@hamac/core";
import { PositionEvolution } from "@/shared/components/AccountEvolution";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { DetailRow, ExpandButton, Table, Td, Tr, useExpandedRow } from "@/shared/components/table";
import { formatQty } from "@/shared/lib/numbers";
import { SortTh, useSortable } from "@/shared/lib/sort";

const COLS = 10;

/** Type du titre : un ETF est un ETF, une action une action. */
const kindLabel = (kind: AssetKind) => (kind === "etc" ? "ETC" : kind === "fonds" ? "Fonds" : ASSET_KIND_LABELS[kind]);

/** Tout ce que détient le compte : chaque titre ou support, puis les projets de crowdlending et les espèces. */
export function Holdings({ s }: { s: AccountState }) {
  const { isOpen, rowProps } = useExpandedRow();
  const share = (v: number) => (s.value > 0 ? v / s.value : null);
  const { sorted, by } = useSortable(
    s.positions,
    {
      titre: (p) => p.asset.name,
      type: (p) => kindLabel(p.asset.kind),
      parts: (p) => p.quantity,
      pru: (p) => p.pru,
      investi: (p) => p.cost,
      cours: (p) => p.price,
      valeur: (p) => p.value,
      pv: (p) => p.gain,
      pvPct: (p) => p.gainPct,
      part: (p) => p.value,
    },
    { key: "valeur", dir: "desc" },
  );
  const crowd = s.crowdProjects.reduce((t, c) => t + c.value, 0);
  const running = s.crowdProjects.filter((c) => c.value > 0).length;
  const cost = s.positions.reduce((t, p) => t + p.cost, 0);
  const gain = s.positions.reduce((t, p) => t + p.gain, 0);

  return (
    <Table className="mb-5">
      <thead>
        <tr>
          <SortTh {...by("titre")}>Titre ou support</SortTh>
          <SortTh {...by("type")}>Type</SortTh>
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
            Part du compte
          </SortTh>
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => (
          <Fragment key={p.asset.id}>
            <Tr {...rowProps(p.asset.id)}>
              <Td className="font-medium">
                <ExpandButton open={isOpen(p.asset.id)} label={p.asset.name} />
                {p.asset.name}
                {p.asset.isin && <div className="ml-[21px] font-mono text-xs font-normal text-fg-faint">{p.asset.isin}</div>}
              </Td>
              <Td>
                {kindLabel(p.asset.kind)}
              </Td>
              {/* Un fonds euros n'a ni parts ni cours : seul son solde compte. */}
              <Td align="right">{p.asset.kind === "fonds_euros" ? "—" : formatQty(p.quantity)}</Td>
              <Td align="right">{p.asset.kind === "fonds_euros" ? "—" : <Amount value={p.pru} />}</Td>
              <Td align="right">
                <Amount value={p.cost} />
              </Td>
              <Td align="right">{p.asset.kind === "fonds_euros" ? "—" : <Amount value={p.price} />}</Td>
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
                <Pct value={share(p.value)} />
              </Td>
            </Tr>
            {isOpen(p.asset.id) && (
              <DetailRow cols={COLS}>
                <PositionEvolution accountId={s.account.id} assetId={p.asset.id} />
              </DetailRow>
            )}
          </Fragment>
        ))}
        {s.crowdProjects.length > 0 && (
          <Tr>
            <Td className="font-medium">
              <Link to="/crowdlending" className="ml-[21px] hover:text-accent hover:underline">
                Projets de crowdlending
              </Link>
              <div className="ml-[21px] text-xs font-normal text-fg-faint">{running} en cours</div>
            </Td>
            <Td>Crowdlending</Td>
            <Td colSpan={4} />
            <Td align="right" className="font-medium">
              <Amount value={crowd} />
            </Td>
            <Td colSpan={2} />
            <Td align="right">
              <Pct value={share(crowd)} />
            </Td>
          </Tr>
        )}
        {Math.abs(s.cash) > 0.005 && (
          <Tr>
            <Td className="pl-[33px] font-medium">Espèces</Td>
            <Td className="text-fg-muted">non investies</Td>
            <Td colSpan={4} />
            <Td align="right" className="font-medium">
              <Amount value={s.cash} />
            </Td>
            <Td colSpan={2} />
            <Td align="right">
              <Pct value={share(s.cash)} />
            </Td>
          </Tr>
        )}
        <tr className="bg-surface-2/60 font-medium">
          <Td>Total</Td>
          <Td colSpan={3} />
          <Td align="right">
            <Amount value={cost} />
          </Td>
          <Td />
          <Td align="right">
            <Amount value={s.value} />
          </Td>
          <Td align="right">
            <Amount value={gain} signed />
          </Td>
          <Td align="right">
            <Pct value={cost > 0 ? gain / cost : null} signed />
          </Td>
          <Td align="right">100 %</Td>
        </tr>
      </tbody>
    </Table>
  );
}
