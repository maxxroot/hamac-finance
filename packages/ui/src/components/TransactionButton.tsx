import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AccountKind, AssetKind, TxType } from "@hamac/core";
import { AddAccountButton } from "@/components/AccountButtons";
import { Button, Card } from "@/components/ui";
import { TransactionDialog, type TxPreset } from "@/dialogs/TransactionDialog";
import { cn } from "@/lib/cn";

/** « Nouvelle opération » : la fenêtre du Journal, ouverte sur place et pré-réglée sur le compte de la page. */
export function AddTransactionButton({
  accountId,
  type,
  label = "Nouvelle opération",
  variant = "primary",
  className,
  assetKinds,
  accountKinds,
}: {
  accountId?: string;
  type?: TxType;
  assetKinds?: AssetKind[];
  accountKinds?: AccountKind[];
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const preset: TxPreset = { accountId, type, assetKinds, accountKinds };
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
