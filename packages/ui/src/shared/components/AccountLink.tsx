import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/shared/lib/cn";
import { stopRowClick } from "@/shared/components/table";
import { accountPath } from "@/shared/nav";

/**
 * Nom d'un compte, cliquable vers sa page de détail. Un clic dessus ne déplie pas la ligne de tableau qui le contient.
 */
export function AccountLink({ account, className, children }: { account: { id: string; name: string } | undefined | null; className?: string; children?: ReactNode }) {
  if (!account) return null;
  return (
    <Link to={accountPath(account.id)} onClick={stopRowClick} className={cn("decoration-fg-faint underline-offset-2 hover:text-accent hover:underline", className)} title={`Voir le compte ${account.name}`}>
      {children ?? account.name}
    </Link>
  );
}
