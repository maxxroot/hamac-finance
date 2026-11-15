import { useWorkspaceIndex } from "@/shared/lib/workspace";
import { AccountLink } from "@/shared/components/AccountLink";
import { useState } from "react";
import { POSITION_MOVE_LABELS, type PositionChange, type PositionMove } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Table, Td, Tr } from "@/shared/components/table";
import { Badge, Card, CardTitle } from "@/shared/components/ui";
import { SortTh, useSortable } from "@/shared/lib/sort";

export const MOVE_ORDER: readonly PositionMove[] = ["nouveau", "renforce", "allege", "vendu", "inchange"];

export const MOVE_TONE: Record<PositionMove, "neutral" | "accent" | null> = { nouveau: "accent", renforce: "accent", allege: "neutral", vendu: "neutral", inchange: null };

/** Singulier et pluriel, pour le résumé au-dessus du tableau. */
export const MOVE_COUNT: Record<PositionMove, readonly [string, string]> = {
  nouveau: ["nouveau titre", "nouveaux titres"],
  renforce: ["renforcé", "renforcés"],
  allege: ["allégé", "allégés"],
  vendu: ["vendu en entier", "vendus en entier"],
  inchange: ["inchangé", "inchangés"],
};

export function PositionsCard({ rows, assetName, accountName }: { rows: readonly PositionChange[]; assetName: (id: string) => string; accountName: (id: string) => string }) {
  const idx = useWorkspaceIndex();
  const [onlyMoved, setOnlyMoved] = useState(true);
  const moved = rows.filter((r) => r.move !== "inchange");
  const shown = onlyMoved && moved.length ? moved : rows;
  const { sorted, by } = useSortable(
    shown,
    {
      mouvement: (p) => MOVE_ORDER.indexOf(p.move),
      titre: (p) => assetName(p.assetId),
      compte: (p) => accountName(p.accountId),
      debut: (p) => p.start?.value ?? 0,
      fin: (p) => p.end?.value ?? 0,
      investi: (p) => (p.end?.cost ?? 0) - (p.start?.cost ?? 0),
    },
    { key: "mouvement", dir: "asc" },
  );
  const counts = MOVE_ORDER.filter((m) => m !== "inchange")
    .map((m) => [m, rows.filter((r) => r.move === m).length] as const)
    .filter(([, n]) => n > 0);
  return (
    <Card>
      <CardTitle
        hint={
          moved.length > 0 && moved.length < rows.length ? (
            <button type="button" className="text-accent hover:underline" onClick={() => setOnlyMoved((v) => !v)}>
              {onlyMoved ? (rows.length - moved.length > 1 ? `Voir aussi les ${rows.length - moved.length} lignes inchangées` : "Voir aussi la ligne inchangée") : "Seulement celles qui ont bougé"}
            </button>
          ) : undefined
        }
      >
        Titres achetés et vendus
      </CardTitle>
      {counts.length > 0 ? (
        <p className="mb-3 text-sm text-fg-muted">{counts.map(([m, n]) => `${n} ${MOVE_COUNT[m][n > 1 ? 1 : 0]}`).join(" · ")}</p>
      ) : (
        <p className="mb-3 text-sm text-fg-muted">Aucun achat ni aucune vente sur la période.</p>
      )}
      <Table>
        <thead>
          <tr>
            <SortTh {...by("titre")}>Titre</SortTh>
            <SortTh {...by("compte")}>Compte</SortTh>
            <SortTh {...by("mouvement")}>Mouvement</SortTh>
            <SortTh {...by("investi")} align="right">Investi en plus</SortTh>
            <SortTh {...by("debut")} align="right">Au début</SortTh>
            <SortTh {...by("fin")} align="right">À la fin</SortTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const tone = MOVE_TONE[p.move];
            const invested = (p.end?.cost ?? 0) - (p.start?.cost ?? 0);
            return (
              <Tr key={`${p.accountId}:${p.assetId}`}>
                <Td className="max-w-64 truncate font-medium">{assetName(p.assetId)}</Td>
                <Td className="max-w-48 truncate text-fg-muted">{idx?.accountById.has(p.accountId) ? <AccountLink account={{ id: p.accountId, name: accountName(p.accountId) }} /> : accountName(p.accountId)}</Td>
                <Td>{tone ? <Badge tone={tone}>{POSITION_MOVE_LABELS[p.move]}</Badge> : <span className="text-xs text-fg-faint">{POSITION_MOVE_LABELS[p.move]}</span>}</Td>
                <Td align="right">{p.move === "inchange" ? <span className="text-fg-faint">—</span> : <Amount value={invested} signed compact className="text-fg" />}</Td>
                <Td align="right"><Amount value={p.start?.value ?? null} compact /></Td>
                <Td align="right" className="font-medium"><Amount value={p.end?.value ?? null} compact /></Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <p className="mt-2 text-xs text-fg-faint">« Investi en plus » : variation du prix de revient. Une vente partielle le réduit à proportion des parts vendues.</p>
    </Card>
  );
}

// ——— Tableau mois par mois ———
