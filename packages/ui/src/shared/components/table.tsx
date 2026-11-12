import { ChevronRight } from "lucide-react";
import { useState, type HTMLAttributes, type MouseEvent, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("@container overflow-x-auto rounded-xl border border-line bg-surface", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, align, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: "right" | "center" }) {
  return (
    <th
      {...props}
      className={cn(
        "sticky top-0 border-b border-line bg-surface-2 px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-fg-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    />
  );
}

export function Td({ className, align, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: "right" | "center" }) {
  return (
    <td
      {...props}
      className={cn("border-b border-line/60 px-3 py-2.5 align-middle", align === "right" && "num text-right whitespace-nowrap", align === "center" && "text-center", className)}
    />
  );
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={cn("transition-colors duration-150 hover:bg-surface-2/70", className)} />;
}

export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-10 text-center text-sm text-fg-muted">
        {children}
      </td>
    </tr>
  );
}

/** Une ligne dépliée à la fois. Un double-clic compte pour un seul : sinon il ouvrirait puis refermerait aussitôt. */
export function useExpandedRow() {
  const [opened, setOpened] = useState<string | null>(null);
  return {
    isOpen: (id: string) => opened === id,
    rowProps: (id: string) => ({
      className: "cursor-pointer",
      onClick: (e: MouseEvent) => {
        if (e.detail <= 1) setOpened((o) => (o === id ? null : id));
      },
    }),
  };
}

/** Chevron de la ligne : son clic remonte à la ligne, et il la rend accessible au clavier. */
export function ExpandButton({ open, label }: { open: boolean; label: string }) {
  return (
    <button type="button" aria-expanded={open} aria-label={`${open ? "Masquer" : "Afficher"} le détail : ${label}`} className="mr-1.5 align-middle">
      <ChevronRight size={15} className={cn("inline text-fg-faint transition-transform", open && "rotate-90")} aria-hidden />
    </button>
  );
}

export function DetailRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="border-b border-line/60 bg-surface-2/40 p-3">
        {/* Le tableau peut être plus large que l'écran : le détail reste dans la partie visible. */}
        <div className="sticky left-3 w-[min(100%,calc(100cqw-1.5rem))]">{children}</div>
      </td>
    </tr>
  );
}

/** À poser sur la cellule des boutons : leurs clics, et ceux de leurs fenêtres, ne déplient pas la ligne. */
export const stopRowClick = (e: MouseEvent) => e.stopPropagation();
