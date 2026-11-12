import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AccountKind, AssetKind, TxType } from "@hamac/core";
import { AddAccountButton } from "@/features/entry/components/AccountButtons";
import { Button, Card } from "@/shared/components/ui";
import { TransactionDialog, type TxPreset } from "@/features/entry/dialogs/TransactionDialog";
import { cn } from "@/shared/lib/cn";

/** « Nouvelle opération » : la fenêtre du Journal, ouverte sur place et pré-réglée sur le compte de la page. */
export function AddTransactionButton({
  accountId,
  type,
  label = "Nouvelle opération",
  variant = "primary",
  className,
  assetKinds,
  accountKinds,
  assetId,
}: {
  accountId?: string;
  type?: TxType;
  assetKinds?: AssetKind[];
  accountKinds?: AccountKind[];
  /** Titre ou support présélectionné (voir TxPreset). */
  assetId?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const preset: TxPreset = { accountId, type, assetKinds, accountKinds, assetId };
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)} disabled={!accountId}>
        <Plus size={16} /> {label}
      </Button>
      {open && <TransactionDialog open preset={preset} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Page de placement sans compte : on propose de créer le premier. */
export function EmptyAccount({ kind, label, children }: { kind: AccountKind; label: string; children: ReactNode }) {
  return (
    <Card className={cn("flex flex-col items-start gap-3 py-8")}>
      <p className="text-sm text-fg-muted">{children}</p>
      <AddAccountButton kind={kind} label={label} />
    </Card>
  );
}
