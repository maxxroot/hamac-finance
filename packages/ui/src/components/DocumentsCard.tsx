import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DOCUMENT_KIND_LABELS, DOCUMENT_KINDS, type DocumentKind, type PropertyDocument } from "@hamac/core";
import type { PropertyDocumentInput } from "@hamac/api";
import { Field, FormGrid, Modal, Select, TextInput } from "@/components/form";
import { RowActions } from "@/components/RowActions";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Button, Card, CardTitle } from "@/components/ui";
import { formatDate } from "@/lib/numbers";
import { useMutate } from "@/lib/workspace";

type DocumentDraft = Required<Omit<PropertyDocumentInput, "id">> & { id?: string };
const emptyDocument = (propertyId: string): DocumentDraft => ({ propertyId, kind: "diagnostic", label: "", date: null, expiresOn: null, location: "" });

function DocumentDialog({ open, propertyId, document: doc, onClose }: { open: boolean; propertyId: string; document: PropertyDocument | null; onClose: () => void }) {
  const [d, setD] = useState<DocumentDraft>(() => emptyDocument(propertyId));
  const save = useMutate("propertyDocuments.upsert", { success: doc ? "Document mis à jour" : "Document ajouté" });
  useEffect(() => {
    if (open) setD(doc ? { ...doc } : emptyDocument(propertyId));
  }, [open, doc, propertyId]);
  const set = <K extends keyof DocumentDraft>(k: K, v: DocumentDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={doc ? "Modifier le document" : "Nouveau document"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={save.isPending || !d.label.trim()} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            {doc ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Type">
            {(id) => (
              <Select id={id} value={d.kind} onChange={(e) => set("kind", e.target.value as DocumentKind)}>
                {DOCUMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {DOCUMENT_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Nom">{(id) => <TextInput id={id} value={d.label} onChange={(e) => set("label", e.target.value)} placeholder="ex. Diagnostic électricité" autoFocus />}</Field>
          <Field label="Date du document">{(id) => <TextInput id={id} type="date" value={d.date ?? ""} onChange={(e) => set("date", e.target.value || null)} />}</Field>
          <Field label="Valable jusqu'au" help="Hamac préviendra 30 jours avant.">{(id) => <TextInput id={id} type="date" value={d.expiresOn ?? ""} onChange={(e) => set("expiresOn", e.target.value || null)} />}</Field>
        </FormGrid>
        <Field label="Où le trouver" help="Dossier, coffre-fort numérique… Hamac ne stocke pas le fichier.">{(id) => <TextInput id={id} value={d.location} onChange={(e) => set("location", e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}

/** Registre des documents du bien. */
export function DocumentsCard({ propertyId, documents, bare }: { propertyId: string; documents: readonly PropertyDocument[]; bare?: boolean }) {
  const [editing, setEditing] = useState<PropertyDocument | "new" | null>(null);
  const del = useMutate("propertyDocuments.delete", { success: "Document supprimé" });
  return (
    <Card className={bare ? "rounded-none border-0 bg-transparent p-0" : undefined}>
      <CardTitle
        hint={
          <Button className="h-8" onClick={() => setEditing("new")}>
            <Plus size={14} /> Nouveau document
          </Button>
        }
      >
        Documents
      </CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Document</Th>
            <Th>Valable jusqu'au</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {documents.length === 0 && <EmptyRow cols={3}>Acte, diagnostics, assurance : notez où les retrouver.</EmptyRow>}
          {documents.map((d) => (
            <Tr key={d.id} className="group">
              <Td>
                <span className="font-medium">{d.label}</span>
                <div className="text-xs text-fg-faint">{[DOCUMENT_KIND_LABELS[d.kind], d.location].filter(Boolean).join(" · ")}</div>
              </Td>
              <Td className="whitespace-nowrap">{d.expiresOn ? formatDate(d.expiresOn) : "—"}</Td>
              <Td className="w-20"><RowActions onEdit={() => setEditing(d)} onDelete={() => confirm(`Supprimer « ${d.label} » ?`) && del.mutate({ id: d.id })} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <DocumentDialog open={editing !== null} propertyId={propertyId} document={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </Card>
  );
}
