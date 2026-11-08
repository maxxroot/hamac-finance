import { Pencil, Trash2 } from "lucide-react";

/** Boutons modifier / supprimer d'une ligne de tableau, visibles au survol. */
export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
      <button className="rounded p-1.5 text-fg-muted hover:bg-surface-3 hover:text-fg" onClick={onEdit} aria-label="Modifier">
        <Pencil size={14} />
      </button>
      <button className="rounded p-1.5 text-fg-muted hover:bg-negative/15 hover:text-negative" onClick={onDelete} aria-label="Supprimer" title="Supprimer (ou archiver si utilisé)">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
