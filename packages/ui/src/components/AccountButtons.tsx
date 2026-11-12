import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { accountNoun, type Account, type AccountKind } from "@hamac/core";
import { Button } from "@/components/ui";
import { AccountDialog } from "@/dialogs/AccountDialog";

/** Bouton « Ajouter un livret / contrat / PEA… » ouvrant la fiche de compte pré-réglée. */
export function AddAccountButton({ kind, label, variant = "primary" }: { kind: AccountKind; label: string; variant?: "primary" | "secondary" | "ghost" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus size={16} /> {label}
      </Button>
      <AccountDialog open={open} onClose={() => setOpen(false)} defaultKind={kind} />
    </>
  );
}

/** Petit bouton crayon pour modifier un compte depuis sa page. */
export function EditAccountButton({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="rounded p-1.5 text-fg-faint hover:bg-surface-3 hover:text-fg" onClick={() => setOpen(true)} aria-label={`Modifier ${account.name}`} title={`Modifier le ${accountNoun(account.kind)}`}>
        <Pencil size={14} />
      </button>
      <AccountDialog open={open} onClose={() => setOpen(false)} account={account} />
    </>
  );
}
