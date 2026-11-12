import { Plus, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import {
  FULL_OWNERSHIP,
  OTHER_ASSET_KIND_LABELS,
  canBeDismembered,
  SALE_TAX_SOURCES,
  SALE_TAX_VERIFIED_ON,
  heldShareLabel,
  loanMonthsLeft,
  otherAssetHeldValueAt,
  otherAssetLoan,
  otherAssetSaleTax,
  otherAssetValueAt,
  quickSaleValue,
  type OtherAsset,
} from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Field, MoneyInput, TextInput } from "@/shared/components/form";
import { RowActions } from "@/shared/components/RowActions";
import { Stat, StatGrid } from "@/shared/components/Stat";
import { DetailRow, EmptyRow, ExpandButton, Table, Td, Th, Tr, stopRowClick, useExpandedRow } from "@/shared/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/shared/components/ui";
import { OtherAssetDialog } from "@/features/other-assets/dialogs/OtherAssetDialog";
import { cn } from "@/shared/lib/cn";
import { formatDate, todayIso } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useMutate } from "@/shared/lib/workspace";

/** Or, objets de valeur, véhicules, parts de société, comptes courants et sommes prêtées. */
export function AutresBiens() {
  const pf = usePortfolio();
  const del = useMutate("otherAssets.delete", { success: "Bien supprimé" });
  const [editing, setEditing] = useState<OtherAsset | "new" | null>(null);
  const { isOpen, rowProps } = useExpandedRow();
  if (!pf) return null;
  const { ws } = pf.idx;
  const today = pf.today;
  const rows = ws.otherAssets.map((a) => {
    const held = otherAssetHeldValueAt(a, ws.otherAssetValues, today);
    return { asset: a, whole: otherAssetValueAt(a, ws.otherAssetValues, today), held, quick: quickSaleValue(held, a), tax: a.archived ? null : otherAssetSaleTax(a, ws.otherAssetValues, today) };
  });
  const active = rows.filter((r) => !r.asset.archived);
  const total = (pick: (r: (typeof rows)[number]) => number) => active.reduce((s, r) => s + pick(r), 0);

  return (
    <>
      <PageHeader
        title="Autres biens"
        description="Ce qui n'est ni un compte ni de l'immobilier : or, objets de valeur, véhicules, parts de société, argent prêté. Ils comptent dans le patrimoine net, et dans la répartition seulement si vous leur donnez une classe d'actifs."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Nouveau bien
          </Button>
        }
      />

      <StatGrid>
        <Stat label="Valeur détenue" sub="part détenue">
          <span className="text-2xl">
            <Amount value={pf.state.netWorth.otherAssets} compact />
          </span>
        </Stat>
        <Stat label="En cas de vente rapide" sub="après décote">
          <Amount value={total((r) => r.quick)} compact />
        </Stat>
        <Stat label="Impôt si tout était vendu" sub="estimation, au régime le plus avantageux">
          <Amount value={total((r) => r.tax?.tax ?? 0)} compact />
        </Stat>
      </StatGrid>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <Table className="rounded-none border-0">
            <thead>
              <tr>
                <Th>Bien</Th>
                <Th align="right">Valeur</Th>
                <Th align="right">Valeur détenue</Th>
                <Th align="right">Vente rapide</Th>
                <Th align="right">Impôt à la vente</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={6}>Aucun bien. Ajoutez vos pièces d'or, une voiture, des parts de société ou une somme prêtée.</EmptyRow>}
              {rows.map((r) => {
                const a = r.asset;
                const label = heldShareLabel(canBeDismembered(a.kind) ? a : { ...a, ...FULL_OWNERSHIP }, today);
                const delay = loanMonthsLeft(a, today) ?? a.saleDelayMonths;
                return (
                  <Fragment key={a.id}>
                    <Tr {...rowProps(a.id)} className={cn("group cursor-pointer", a.archived && "opacity-50")}>
                      <Td className="font-medium">
                        <ExpandButton open={isOpen(a.id)} label={a.name} />
                        {a.name}
                        <div className="ml-[21px] text-xs font-normal text-fg-faint">
                          {OTHER_ASSET_KIND_LABELS[a.kind]}
                          {label && ` · ${label}`}
                          {otherAssetLoan(a) ? " · selon l'échéancier" : a.valueDate ? ` · estimé le ${formatDate(a.valueDate)}` : ""}
                        </div>
                      </Td>
                      <Td align="right">
                        <Amount value={r.whole} compact />
                      </Td>
                      <Td align="right" className="font-medium">
                        <Amount value={r.held} compact />
                      </Td>
                      <Td align="right">
                        <Amount value={r.quick} compact />
                        {delay != null && <div className="text-xs text-fg-faint">{delay === 0 ? "immédiat" : `${delay} mois`}</div>}
                      </Td>
                      <Td align="right">{r.tax == null ? "—" : r.tax.exempt ? <Badge tone="positive">Exonéré</Badge> : r.tax.tax == null ? <span className="text-xs text-fg-faint">non estimé</span> : <Amount value={r.tax.tax} compact />}</Td>
                      <Td className="w-20" onClick={stopRowClick}>
                        <RowActions onEdit={() => setEditing(a)} onDelete={() => confirm(`Supprimer « ${a.name} » et ses estimations ?`) && del.mutate({ id: a.id })} />
                      </Td>
                    </Tr>
                    {isOpen(a.id) && (
                      <DetailRow cols={6}>
                        <Detail asset={a} tax={r.tax} />
                      </DetailRow>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-fg-faint">
        Impôt à la vente : règles vérifiées le {formatDate(SALE_TAX_VERIFIED_ON)}. Sources :{" "}
        {SALE_TAX_SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-accent">
              {s.label}
            </a>
          </span>
        ))}
        . Estimation sans valeur officielle.
      </p>

      <OtherAssetDialog open={editing !== null} asset={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </>
  );
}

/** Détail d'un bien : impôt à la vente par régime, estimations passées. */
function Detail({ asset: a, tax }: Readonly<{ asset: OtherAsset; tax: ReturnType<typeof otherAssetSaleTax> | null }>) {
  const pf = usePortfolio()!;
  const values = pf.idx.ws.otherAssetValues.filter((v) => v.assetId === a.id).sort((x, y) => y.date.localeCompare(x.date));
  const add = useMutate("otherAssetValues.add", { success: "Estimation enregistrée" });
  const remove = useMutate("otherAssetValues.delete", { success: "Estimation supprimée" });
  const [date, setDate] = useState(todayIso());
  const [value, setValue] = useState<number | null>(null);
  const scheduled = otherAssetLoan(a) != null;

  return (
    <div className="grid gap-5 @3xl:grid-cols-2">
      <section>
        <CardTitle>Impôt si vendu aujourd'hui</CardTitle>
        {tax == null ? (
          <p className="text-sm text-fg-muted">Bien archivé.</p>
        ) : (
          <>
            {tax.options.length > 0 && (
              <ul className="mb-2 space-y-1.5 text-sm">
                {tax.options.map((o) => (
                  <li key={o.regime} className={cn(tax.best === o && "font-medium")}>
                    {o.label} : <Amount value={o.tax} />
                    {tax.best === o && tax.options.length > 1 && <Badge tone="positive">le plus avantageux</Badge>}
                    <div className="text-xs font-normal text-fg-faint">{o.detail}</div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-fg-muted">{tax.note}</p>
          </>
        )}
        {a.comment && <p className="mt-3 text-xs text-fg-faint">{a.comment}</p>}
      </section>
      {!scheduled && (
        <section>
          <CardTitle hint="la plus récente est la valeur du bien">Estimations</CardTitle>
          <ul className="mb-3 space-y-1 text-sm">
            {a.valueDate && (
              <li>
                {formatDate(a.valueDate)} : <Amount value={a.value} /> <span className="text-xs text-fg-faint">(actuelle)</span>
              </li>
            )}
            {values.map((v) => (
              <li key={v.id} className="flex items-center gap-2">
                {formatDate(v.date)} : <Amount value={v.value} />
                <button type="button" className="rounded p-1 text-fg-faint hover:text-negative" aria-label={`Supprimer l'estimation du ${formatDate(v.date)}`} onClick={() => remove.mutate({ id: v.id })}>
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Date">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Valeur du bien entier">{(id) => <MoneyInput id={id} value={value} onChange={setValue} />}</Field>
            <Button disabled={value == null || !date || add.isPending} onClick={() => value != null && add.mutate({ assetId: a.id, date, value }, { onSuccess: () => setValue(null) })}>
              Ajouter l'estimation
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
