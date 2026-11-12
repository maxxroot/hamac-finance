import { type SnapshotComparison, type SnapshotTotals } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { Table, Td, Th, Tr } from "@/shared/components/table";
import { Card, CardTitle } from "@/shared/components/ui";
import { cn } from "@/shared/lib/cn";

export function SituationCard({ cmp, startLabel, endLabel, withRealEstate }: { cmp: SnapshotComparison; startLabel: string; endLabel: string; withRealEstate: boolean }) {
  // `money` : de l'argent apporté, ni gagné ni perdu, donc sans couleur. `noPct` : un gain en % de lui-même ne veut rien dire.
  const rows: Array<{ label: string; pick: (t: SnapshotTotals) => number; strong?: boolean; inverse?: boolean; money?: boolean; noPct?: boolean }> = [
    { label: "Patrimoine financier", pick: (t) => t.value, strong: !withRealEstate },
    { label: "Argent versé net", pick: (t) => t.netContrib, money: true },
    { label: "Gain", pick: (t) => t.gain, noPct: true },
    ...(withRealEstate
      ? [
          { label: "Biens (part détenue)", pick: (t: SnapshotTotals) => t.realEstate },
          ...((cmp.start?.otherAssets ?? 0) !== 0 || cmp.end.otherAssets !== 0 ? [{ label: "Autres biens", pick: (t: SnapshotTotals) => t.otherAssets }] : []),
          { label: "Crédits restant dus", pick: (t: SnapshotTotals) => t.debts, inverse: true },
          { label: "Patrimoine net", pick: (t: SnapshotTotals) => t.netWorth, strong: true },
        ]
      : []),
  ];
  return (
    <Card>
      <CardTitle>La situation</CardTitle>
      <Table>
        <thead>
          <tr>
            <Th />
            <Th align="right">{startLabel}</Th>
            <Th align="right">{endLabel}</Th>
            <Th align="right">Écart</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const a = cmp.start ? r.pick(cmp.start) : 0;
            const b = r.pick(cmp.end);
            const pct = cmp.start && a > 0 && !r.inverse && !r.noPct ? (b - a) / a : null;
            return (
              <Tr key={r.label}>
                <Td className={cn(r.strong ? "font-semibold" : "text-fg-muted")}>{r.label}</Td>
                <Td align="right"><Amount value={a} compact /></Td>
                <Td align="right" className={cn(r.strong && "font-semibold")}><Amount value={b} compact /></Td>
                <Td align="right">
                  {r.inverse ? (
                    <Amount value={b - a} compact className={cn(b - a < -0.004 && "text-positive", b - a > 0.004 && "text-negative")} />
                  ) : (
                    <Amount value={b - a} signed compact className={cn(r.money && "text-fg")} />
                  )}
                  {pct != null && <span className="ml-1.5 text-xs text-fg-faint"><Pct value={pct} signed /></span>}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

// ——— Cascade ———
