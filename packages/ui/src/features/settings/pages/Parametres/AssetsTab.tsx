import { Plus } from "lucide-react";
import { Select } from "@/shared/components/form";
import { useState } from "react";
import { RowActions } from "@/shared/components/RowActions";
import { ASSET_BUCKET, ASSET_KIND_LABELS, BUCKET_LABELS, formatPct, type Asset } from "@hamac/core";
import { EmptyRow, Table, Td, Th, Tr } from "@/shared/components/table";
import { Button } from "@/shared/components/ui";
import { AssetDialog } from "@/features/settings/dialogs/AssetDialog";
import { cn } from "@/shared/lib/cn";
import { formatDate } from "@/shared/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/shared/lib/workspace";
import { SortTh, useSortable } from "@/shared/lib/sort";

export function AssetsTab() {
  const idx = useWorkspaceIndex();
  const del = useMutate("assets.delete", { success: "Actif supprimé" });
  const upsert = useMutate("assets.upsert");
  const [editing, setEditing] = useState<Asset | null>(null);
  const [creating, setCreating] = useState(false);
  const saved = idx?.ws.params.customClasses;
  const assetSort = useSortable(idx?.ws.assets ?? [], {
    nom: (a) => a.name,
    type: (a) => ASSET_KIND_LABELS[a.kind],
    isin: (a) => a.isin,
    cours: (a) => a.priceSource,
    cible: (a) => a.targetWeight,
  });
  if (!idx) return null;
  const equityTargets = idx.activeAssets.filter((a) => a.kind !== "obligation" && a.kind !== "crypto").reduce((s, a) => s + (a.targetWeight ?? 0), 0);
  const patch = (a: Asset, change: Partial<Asset>) => upsert.mutate({ ...a, ...change });
  const allocValue = (a: Asset) => (a.inAllocation == null ? "" : a.inAllocation ? "in" : "out");
  return (
    <div className="space-y-5 pb-20">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-fg-muted">
            Parts cibles des actions :{" "}
            <span className={cn("font-medium", Math.abs(equityTargets - 1) > 0.0001 && equityTargets > 0 ? "text-warning" : "text-fg")}>{formatPct(equityTargets)}</span>
            {Math.abs(equityTargets - 1) > 0.0001 && equityTargets > 0 && " (devrait faire 100 %)"}
          </p>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nouvel actif
          </Button>
        </div>
        <Table>
          <thead>
            <tr>
              <SortTh {...assetSort.by("nom")}>Nom</SortTh>
              <SortTh {...assetSort.by("type")}>Type</SortTh>
              <Th>Classe</Th>
              <Th>Allocation cible</Th>
              <SortTh {...assetSort.by("cours")}>Cours</SortTh>
              <SortTh {...assetSort.by("cible")} align="right">Part cible</SortTh>
              <Th />
            </tr>
          </thead>
          <tbody>
            {idx.ws.assets.length === 0 && <EmptyRow cols={7}>Aucun actif. Ajoutez vos ETF, obligations ou cryptos.</EmptyRow>}
            {assetSort.sorted.map((a) => (
              <Tr key={a.id} className={cn("group", a.archived && "opacity-50")}>
                <Td className="font-medium">
                  {a.name}
                  <div className="font-mono text-xs font-normal text-fg-faint">{a.isin}</div>
                  {a.kind === "obligation" && <div className="text-xs font-normal text-fg-muted">{`${a.couponRate != null ? formatPct(a.couponRate) : "?"} · échéance ${formatDate(a.maturityDate)}`}</div>}
                </Td>
                <Td>{ASSET_KIND_LABELS[a.kind]}</Td>
                <Td>
                  <Select aria-label={`Classe de ${a.name}`} className="h-8 min-w-36 text-xs" value={saved?.some((c) => c.id === a.classId) ? (a.classId ?? "") : ""} onChange={(e) => patch(a, { classId: e.target.value || null })}>
                    <option value="">{BUCKET_LABELS[ASSET_BUCKET[a.kind]]} (par défaut)</option>
                    {saved?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Select aria-label={`Allocation de ${a.name}`} className="h-8 min-w-32 text-xs" value={allocValue(a)} onChange={(e) => patch(a, { inAllocation: e.target.value === "" ? null : e.target.value === "in" })}>
                    <option value="">Par défaut</option>
                    <option value="in">Dans l'allocation</option>
                    <option value="out">Hors allocation</option>
                  </Select>
                </Td>
                <Td className="text-fg-muted">{a.priceSource === "auto" ? `auto${a.symbol ? ` · ${a.symbol}` : ""}` : a.priceSource === "modele" ? "calculé" : "manuel"}</Td>
                <Td align="right">{a.targetWeight != null ? formatPct(a.targetWeight) : "—"}</Td>
                <Td className="w-20">
                  <RowActions onEdit={() => setEditing(a)} onDelete={() => confirm(`Supprimer « ${a.name} » ?`) && del.mutate({ id: a.id })} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
      <AssetDialog open={creating || !!editing} asset={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </div>
  );
}

// ——— Application ———
