import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { companySummary, type Company } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Checkbox, Field, FormGrid, Modal, PercentInput, Textarea, TextInput } from "@/components/form";
import { RowActions } from "@/components/RowActions";
import { Pct } from "@/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Button, Card, CardTitle } from "@/components/ui";
import { cn } from "@/lib/cn";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";

/** Sociétés (SCI) : leurs biens, leurs crédits, leur actif net et la valeur des parts détenues. */
export function CompaniesCard() {
  const pf = usePortfolio();
  const del = useMutate("companies.delete", { success: "Société supprimée" });
  const [editing, setEditing] = useState<Company | "new" | null>(null);
  if (!pf) return null;
  const { ws } = pf.idx;
  const hasSci = ws.properties.some((p) => p.ownership === "sci" || p.ownership === "sci_familiale");
  if (ws.companies.length === 0 && !hasSci) return null;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <CardTitle hint="biens et crédits rattachés, à la part de vos parts">Sociétés (SCI)</CardTitle>
        <Button className="h-8" onClick={() => setEditing("new")}>
          <Plus size={14} /> Nouvelle société
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Société</Th>
            <Th align="right">Vos parts</Th>
            <Th align="right">Biens</Th>
            <Th align="right">Crédits</Th>
            <Th align="right">Actif net</Th>
            <Th align="right">Valeur de vos parts</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {ws.companies.length === 0 && <EmptyRow cols={7}>Créez la SCI, puis rattachez-lui ses biens depuis leur fiche (statut « SCI »).</EmptyRow>}
          {ws.companies.map((c) => {
            const s = companySummary(c, ws.properties, ws.loans, pf.today);
            return (
              <Tr key={c.id} className={cn("group", c.archived && "opacity-50")}>
                <Td className="font-medium">
                  {c.name}
                  <div className="text-xs font-normal text-fg-faint">{s.properties.length ? s.properties.map((p) => p.name).join(", ") : "Aucun bien rattaché"}</div>
                </Td>
                <Td align="right">
                  <Pct value={c.share} />
                </Td>
                <Td align="right">
                  <Amount value={s.value} compact />
                </Td>
                <Td align="right">
                  <Amount value={-s.debt} compact />
                </Td>
                <Td align="right">
                  <Amount value={s.net} compact />
                </Td>
                <Td align="right" className="font-medium">
                  <Amount value={s.held} compact />
                </Td>
                <Td className="w-20">
                  <RowActions onEdit={() => setEditing(c)} onDelete={() => confirm(`Supprimer « ${c.name} » ? Ses biens restent, détenus pour la part saisie sur chacun.`) && del.mutate({ id: c.id })} />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <p className="mt-3 text-xs text-fg-faint">Les biens d'une SCI comptent dans votre patrimoine pour la part de vos parts, leurs crédits aussi : loyers, charges et rentabilité suivent la même part.</p>
      <CompanyDialog company={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
    </Card>
  );
}

function CompanyDialog({ open, company, onClose }: Readonly<{ open: boolean; company: Company | null; onClose: () => void }>) {
  const save = useMutate("companies.upsert", { success: company ? "Société mise à jour" : "Société ajoutée" });
  const [d, setD] = useState({ name: "", share: 1, comment: "", archived: false });
  useEffect(() => {
    if (open) setD(company ? { name: company.name, share: company.share, comment: company.comment, archived: company.archived } : { name: "", share: 1, comment: "", archived: false });
  }, [open, company]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={company ? `Modifier « ${company.name} »` : "Nouvelle société"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!d.name.trim() || d.share <= 0 || save.isPending} onClick={() => save.mutate({ ...d, id: company?.id }, { onSuccess: onClose })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={2}>
          <Field label="Nom">{(id) => <TextInput id={id} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="ex. SCI Familiale" autoFocus />}</Field>
          <Field label="Part des parts détenue" help="Ex. 50 % si vous détenez la moitié des parts.">
            {(id) => <PercentInput id={id} value={d.share} onChange={(v) => setD({ ...d, share: v == null ? 1 : Math.min(1, Math.max(0.0001, v)) })} />}
          </Field>
        </FormGrid>
        <Field label="Commentaire">{(id) => <Textarea id={id} value={d.comment} onChange={(e) => setD({ ...d, comment: e.target.value })} placeholder="Associés, régime fiscal, date de création…" />}</Field>
        {company && <Checkbox checked={d.archived} onChange={(v) => setD({ ...d, archived: v })} label="Archivée" />}
      </div>
    </Modal>
  );
}
